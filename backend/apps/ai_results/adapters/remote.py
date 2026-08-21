from __future__ import annotations

import base64
import binascii
import ipaddress
import json
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile

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
MAX_REMOTE_OVERLAY_BASE64_BYTES = 4 * ((MAX_REMOTE_OVERLAY_BYTES + 2) // 3)
MAX_REMOTE_HTTPS_RESPONSE_BYTES = MAX_REMOTE_JSON_BYTES + MAX_REMOTE_OVERLAY_BASE64_BYTES + 4096
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


def _validate_overlay_png(data: bytes | None) -> bytes | None:
    if data is None:
        return None
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
        return _validate_overlay_png(data)
    finally:
        path.unlink(missing_ok=True)


def _decode_overlay_base64(raw: Any) -> bytes | None:
    if raw is None or raw == "":
        return None
    if not isinstance(raw, str):
        raise InferenceRuntimeError("The AI service returned an invalid overlay payload.")
    if len(raw) > MAX_REMOTE_OVERLAY_BASE64_BYTES:
        raise InferenceRuntimeError("The AI service overlay exceeded the size limit.")
    try:
        data = base64.b64decode(raw, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise InferenceRuntimeError("The AI service returned invalid overlay encoding.") from exc
    return _validate_overlay_png(data)


def pipeline_result_from_remote(payload: dict, overlay_png: bytes | None, *, transport: str = "remote") -> PipelineResult:
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
        "transport": transport,
    }

    try:
        return PipelineResult(
            result_summary="Research-only AI analysis completed.",
            model_version=PIPELINE_VERSION,
            teeth=tuple(teeth),
            overall_confidence=None,
            pipeline_metadata=metadata,
            overlay_png=overlay_png,
        )
    except ValueError as exc:
        raise InferenceRuntimeError("The AI service response violated the locked result contract.") from exc


def _run_with_total_timeout(callable_):
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pearlix-remote-ai")
    future = executor.submit(callable_)
    try:
        return future.result(timeout=REMOTE_TOTAL_TIMEOUT_SECONDS)
    except FutureTimeoutError as exc:
        future.cancel()
        raise InferenceRuntimeError("The separate AI service request timed out.") from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


class RemoteInferenceAdapter:
    model_version = PIPELINE_VERSION

    def __init__(self, config: RemoteInferenceConfig):
        self.config = config

    def _analyze_https(self, image: ImageInput, suffix: str) -> PipelineResult:
        try:
            import httpx
        except ImportError as exc:
            raise InferenceConfigurationError("The HTTP client dependency is unavailable.") from exc

        def request_bytes() -> bytes:
            timeout = httpx.Timeout(
                REMOTE_READ_TIMEOUT_SECONDS,
                connect=REMOTE_CONNECT_TIMEOUT_SECONDS,
                write=REMOTE_CONNECT_TIMEOUT_SECONDS,
                pool=REMOTE_CONNECT_TIMEOUT_SECONDS,
            )
            with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
                with client.stream(
                    "POST",
                    f"{self.config.service_url}{self.config.api_name}",
                    headers={"Authorization": f"Bearer {self.config.hf_token}"},
                    files={"image": (f"panoramic{suffix}", image.content, image.content_type)},
                ) as response:
                    if response.status_code in {401, 403}:
                        raise InferenceConfigurationError("The separate AI service rejected its bearer token.")
                    if response.status_code >= 300:
                        raise InferenceRuntimeError(
                            f"The separate AI service returned HTTP {response.status_code}."
                        )
                    declared_length = response.headers.get("content-length")
                    if declared_length is not None:
                        try:
                            if int(declared_length) > MAX_REMOTE_HTTPS_RESPONSE_BYTES:
                                raise InferenceRuntimeError("The AI service response exceeded the size limit.")
                        except ValueError as exc:
                            raise InferenceRuntimeError("The AI service returned an invalid content length.") from exc
                    chunks = []
                    received = 0
                    for chunk in response.iter_bytes():
                        received += len(chunk)
                        if received > MAX_REMOTE_HTTPS_RESPONSE_BYTES:
                            raise InferenceRuntimeError("The AI service response exceeded the size limit.")
                        chunks.append(chunk)
                    return b"".join(chunks)

        try:
            raw_response = _run_with_total_timeout(request_bytes)
        except (InferenceConfigurationError, InferenceRuntimeError):
            raise
        except Exception as exc:
            raise InferenceRuntimeError("The separate AI service request failed.") from exc
        try:
            envelope = json.loads(raw_response)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise InferenceRuntimeError("The AI service returned invalid JSON.") from exc
        if not isinstance(envelope, dict):
            raise InferenceRuntimeError("The AI service returned an invalid response envelope.")
        payload = _load_remote_payload(envelope.get("payload"))
        overlay_png = _decode_overlay_base64(envelope.get("overlay_png_base64"))
        return pipeline_result_from_remote(payload, overlay_png, transport="https-json")

    def _analyze_hf_space(self, image: ImageInput, suffix: str) -> PipelineResult:
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
            result = _run_with_total_timeout(
                lambda: client.predict(
                    image=handle_file(str(temporary_path)),
                    api_name=self.config.api_name,
                )
            )
            if not isinstance(result, (tuple, list)) or len(result) != 2:
                raise InferenceRuntimeError("The AI service returned the wrong output shape.")
            payload = _load_remote_payload(result[0])
            overlay_png = _read_overlay_bytes(result[1])
            return pipeline_result_from_remote(payload, overlay_png, transport="hugging-face-gradio")
        except (InferenceConfigurationError, InferenceImageInvalidError, InferenceRuntimeError):
            raise
        except Exception as exc:
            raise InferenceRuntimeError("The separate AI service request failed.") from exc
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def analyze(self, image: ImageInput) -> PipelineResult:
        if not isinstance(image, ImageInput):
            raise TypeError("RemoteInferenceAdapter requires ImageInput.")
        content_type = image.content_type.lower()
        suffix = ".png" if content_type == "image/png" else ".jpg" if content_type == "image/jpeg" else None
        if suffix is None:
            raise InferenceImageInvalidError("The image content type is unsupported.")
        if self.config.service_url.startswith("https://"):
            return self._analyze_https(image, suffix)
        return self._analyze_hf_space(image, suffix)


_REMOTE_ADAPTER: RemoteInferenceAdapter | None = None
_REMOTE_CONFIG: RemoteInferenceConfig | None = None


def get_remote_adapter() -> RemoteInferenceAdapter:
    global _REMOTE_ADAPTER, _REMOTE_CONFIG
    config = RemoteInferenceConfig.from_settings()
    if _REMOTE_ADAPTER is None or _REMOTE_CONFIG != config:
        _REMOTE_ADAPTER = RemoteInferenceAdapter(config)
        _REMOTE_CONFIG = config
    return _REMOTE_ADAPTER
