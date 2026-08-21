from __future__ import annotations

import json
import ipaddress
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from django.core.files.uploadedfile import SimpleUploadedFile

from django.conf import settings

from apps.ai_results.adapters.base import (
    InferenceConfigurationError,
    InferenceImageInvalidError,
    InferenceRuntimeError,
)
from apps.ai_results.model_contract import PIPELINE_VERSION, locked_pipeline_metadata
from apps.ai_results.result_types import (
    DetectedTooth,
    ImageInput,
    PipelineResult,
    ToothScores,
    apply_locked_policy,
)
from apps.xrays.image_validation import ImageValidationError, validate_image_upload


REMOTE_CONTRACT_VERSION = "pearlix-dentex-remote-v1"
DEFAULT_REMOTE_API_NAME = "/analyze"
REMOTE_CONNECT_TIMEOUT_SECONDS = 10
REMOTE_READ_TIMEOUT_SECONDS = 120
REMOTE_TOTAL_TIMEOUT_SECONDS = 150
MAX_REMOTE_JSON_BYTES = 256 * 1024
MAX_REMOTE_RUNTIME_METADATA_BYTES = 16 * 1024
MAX_REMOTE_TOOTH_ROWS = 32
MAX_REMOTE_OVERLAY_BYTES = 20 * 1024 * 1024
SPACE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


@dataclass(frozen=True)
class RemoteInferenceConfig:
    service_url: str
    hf_token: str
    api_name: str = DEFAULT_REMOTE_API_NAME

    @classmethod
    def from_settings(cls) -> "RemoteInferenceConfig":
        service_url = str(getattr(settings, "AI_SERVICE_URL", "") or "").strip().rstrip("/")
        hf_token = str(getattr(settings, "AI_SERVICE_TOKEN", "") or "").strip()
        api_name = DEFAULT_REMOTE_API_NAME
        if not service_url or not hf_token:
            raise InferenceConfigurationError("The separate AI service configuration is incomplete.")
        is_space_id = bool(SPACE_ID_PATTERN.fullmatch(service_url))
        parsed = urlsplit(service_url)
        is_https = parsed.scheme == "https" and bool(parsed.hostname) and not any((parsed.username, parsed.password, parsed.query, parsed.fragment))
        if is_https:
            try:
                address = ipaddress.ip_address(parsed.hostname)
            except ValueError:
                address = None
            if address is not None and not address.is_global:
                is_https = False
        if not (is_https or is_space_id):
            raise InferenceConfigurationError(
                "The separate AI service reference must be an HTTPS URL or Hugging Face Space ID."
            )
        if not api_name.startswith("/"):
            raise InferenceConfigurationError("The separate AI service API name is invalid.")
        return cls(service_url=service_url, hf_token=hf_token, api_name=api_name)


def _load_remote_payload(raw: Any) -> dict:
    if isinstance(raw, dict):
        payload = raw
    elif isinstance(raw, str):
        if len(raw.encode("utf-8")) > MAX_REMOTE_JSON_BYTES:
            raise InferenceRuntimeError("The AI service JSON response exceeded the size limit.")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise InferenceRuntimeError("The AI service returned invalid JSON.") from exc
    else:
        raise InferenceRuntimeError("The AI service returned an unsupported payload.")
    if not isinstance(payload, dict):
        raise InferenceRuntimeError("The AI service returned an invalid payload envelope.")
    try:
        encoded = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise InferenceRuntimeError("The AI service returned invalid JSON values.") from exc
    if len(encoded) > MAX_REMOTE_JSON_BYTES:
        raise InferenceRuntimeError("The AI service JSON response exceeded the size limit.")
    return payload


def _read_overlay_bytes(raw: Any) -> bytes | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, dict):
        raw = raw.get("path") or raw.get("name") or raw.get("url")
    if not isinstance(raw, str) or not raw:
        raise InferenceRuntimeError("The AI service returned an invalid overlay reference.")
    path = Path(raw)
    if not path.is_file():
        raise InferenceRuntimeError("The AI service overlay could not be downloaded.")
    try:
        with path.open("rb") as handle:
            data = handle.read(MAX_REMOTE_OVERLAY_BYTES + 1)
        if len(data) > MAX_REMOTE_OVERLAY_BYTES:
            raise InferenceRuntimeError("The AI service overlay exceeded the size limit.")
        try:
            validated = validate_image_upload(
                SimpleUploadedFile("overlay.png", data, content_type="image/png"),
                require_png=True,
                maximum_bytes=MAX_REMOTE_OVERLAY_BYTES,
            )
        except ImageValidationError as exc:
            raise InferenceRuntimeError("The AI service overlay is invalid.") from exc
        return validated.content
    finally:
        path.unlink(missing_ok=True)


def pipeline_result_from_remote(payload: dict, overlay_png: bytes | None) -> PipelineResult:
    if payload.get("contract_version") != REMOTE_CONTRACT_VERSION:
        raise InferenceRuntimeError("The AI service contract version is unsupported.")
    if payload.get("model_version") != PIPELINE_VERSION:
        raise InferenceRuntimeError("The AI service model version differs from the locked Pearlix pipeline.")
    rows = payload.get("teeth")
    if not isinstance(rows, list):
        raise InferenceRuntimeError("The AI service teeth payload is invalid.")
    if len(rows) > MAX_REMOTE_TOOTH_ROWS:
        raise InferenceRuntimeError("The AI service returned too many tooth rows.")

    teeth = []
    for row in rows:
        if not isinstance(row, dict):
            raise InferenceRuntimeError("The AI service returned an invalid tooth row.")
        try:
            tooth = DetectedTooth(
                fdi_tooth_id=str(row["fdi_tooth_id"]),
                detector_confidence=float(row["detector_confidence"]),
                bbox_xyxy=tuple(row["bbox_xyxy"]),
            )
            scores = ToothScores.from_mapping(row["model_scores"])
            # The remote service is not trusted to make final decisions. Pearlix
            # reapplies its code-locked thresholds/review band/hierarchy locally.
            teeth.append(apply_locked_policy(tooth, scores))
        except (KeyError, TypeError, ValueError) as exc:
            raise InferenceRuntimeError("The AI service returned a tooth row outside the locked contract.") from exc

    metadata = locked_pipeline_metadata()
    runtime = payload.get("runtime")
    if isinstance(runtime, dict):
        try:
            runtime_size = len(json.dumps(runtime, allow_nan=False, separators=(",", ":")).encode("utf-8"))
        except (TypeError, ValueError) as exc:
            raise InferenceRuntimeError("The AI service runtime metadata is invalid.") from exc
        if runtime_size > MAX_REMOTE_RUNTIME_METADATA_BYTES:
            raise InferenceRuntimeError("The AI service runtime metadata exceeded the size limit.")
        metadata["remote_runtime"] = runtime
    metadata["remote_service"] = {
        "contract_version": REMOTE_CONTRACT_VERSION,
        "transport": "hugging-face-gradio",
    }

    return PipelineResult(
        result_summary="Research-only AI analysis completed.",
        model_version=PIPELINE_VERSION,
        teeth=tuple(teeth),
        overall_confidence=None,
        pipeline_metadata=metadata,
        overlay_png=overlay_png,
    )


class RemoteInferenceAdapter:
    model_version = PIPELINE_VERSION

    def __init__(self, config: RemoteInferenceConfig):
        self.config = config

    def analyze(self, image: ImageInput) -> PipelineResult:
        if not isinstance(image, ImageInput):
            raise TypeError("RemoteInferenceAdapter requires ImageInput.")
        content_type = image.content_type.lower()
        suffix = ".png" if content_type == "image/png" else ".jpg" if content_type == "image/jpeg" else None
        if suffix is None:
            raise InferenceImageInvalidError("The image content type is unsupported.")

        try:
            from gradio_client import Client, handle_file
            import httpx
        except ImportError as exc:
            raise InferenceConfigurationError("The remote AI transport dependencies are unavailable.") from exc

        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(prefix="pearlix-remote-ai-", suffix=suffix, delete=False) as handle:
                handle.write(image.content)
                handle.flush()
                temporary_path = Path(handle.name)

            client = Client(
                self.config.service_url,
                token=self.config.hf_token,
                verbose=False,
                httpx_kwargs={
                    "timeout": httpx.Timeout(
                        REMOTE_READ_TIMEOUT_SECONDS,
                        connect=REMOTE_CONNECT_TIMEOUT_SECONDS,
                        write=REMOTE_CONNECT_TIMEOUT_SECONDS,
                        pool=REMOTE_CONNECT_TIMEOUT_SECONDS,
                    )
                },
            )
            executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pearlix-remote-ai")
            future = executor.submit(
                client.predict,
                image=handle_file(str(temporary_path)),
                api_name=self.config.api_name,
            )
            try:
                result = future.result(timeout=REMOTE_TOTAL_TIMEOUT_SECONDS)
            except FutureTimeoutError as exc:
                future.cancel()
                raise InferenceRuntimeError("The separate AI service request timed out.") from exc
            finally:
                executor.shutdown(wait=False, cancel_futures=True)
            if not isinstance(result, (tuple, list)) or len(result) != 2:
                raise InferenceRuntimeError("The AI service returned the wrong output shape.")
            payload = _load_remote_payload(result[0])
            overlay_png = _read_overlay_bytes(result[1])
            return pipeline_result_from_remote(payload, overlay_png)
        except (InferenceConfigurationError, InferenceImageInvalidError, InferenceRuntimeError):
            raise
        except Exception as exc:
            raise InferenceRuntimeError("The separate AI service request failed.") from exc
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)


_REMOTE_ADAPTER: RemoteInferenceAdapter | None = None
_REMOTE_CONFIG: RemoteInferenceConfig | None = None


def get_remote_adapter() -> RemoteInferenceAdapter:
    global _REMOTE_ADAPTER, _REMOTE_CONFIG
    config = RemoteInferenceConfig.from_settings()
    if _REMOTE_ADAPTER is None or _REMOTE_CONFIG != config:
        _REMOTE_ADAPTER = RemoteInferenceAdapter(config)
        _REMOTE_CONFIG = config
    return _REMOTE_ADAPTER
