from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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


REMOTE_CONTRACT_VERSION = "pearlix-dentex-remote-v1"
DEFAULT_REMOTE_API_NAME = "/analyze"


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
        is_https = service_url.startswith("https://")
        is_space_id = service_url.count("/") == 1 and not service_url.startswith("/") and " " not in service_url
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
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise InferenceRuntimeError("The AI service returned invalid JSON.") from exc
    else:
        raise InferenceRuntimeError("The AI service returned an unsupported payload.")
    if not isinstance(payload, dict):
        raise InferenceRuntimeError("The AI service returned an invalid payload envelope.")
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
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise InferenceRuntimeError("The AI service overlay is not a PNG file.")
    return data


def pipeline_result_from_remote(payload: dict, overlay_png: bytes | None) -> PipelineResult:
    if payload.get("contract_version") != REMOTE_CONTRACT_VERSION:
        raise InferenceRuntimeError("The AI service contract version is unsupported.")
    if payload.get("model_version") != PIPELINE_VERSION:
        raise InferenceRuntimeError("The AI service model version differs from the locked Pearlix pipeline.")
    rows = payload.get("teeth")
    if not isinstance(rows, list):
        raise InferenceRuntimeError("The AI service teeth payload is invalid.")

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
        except ImportError as exc:
            raise InferenceConfigurationError("The Gradio client dependency is unavailable.") from exc

        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(prefix="pearlix-remote-ai-", suffix=suffix, delete=False) as handle:
                handle.write(image.content)
                handle.flush()
                temporary_path = Path(handle.name)

            client = Client(self.config.service_url, token=self.config.hf_token, verbose=False)
            result = client.predict(
                image=handle_file(str(temporary_path)),
                api_name=self.config.api_name,
            )
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
