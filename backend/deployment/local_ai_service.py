from __future__ import annotations

import base64
import hmac
import os
import time
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from fastapi import FastAPI, File, Header, HTTPException, UploadFile


MODEL_ROOT = Path(os.environ["PEARLIX_LOCAL_AI_MODEL_ROOT"]).resolve()
SERVICE_TOKEN = os.environ.get("PEARLIX_LOCAL_AI_TOKEN", "").strip()
DEVICE = os.environ.get("PEARLIX_LOCAL_AI_DEVICE", "cpu").strip().lower()
REMOTE_CONTRACT_VERSION = "pearlix-dentex-remote-v1"

if not SERVICE_TOKEN:
    raise RuntimeError("PEARLIX_LOCAL_AI_TOKEN is required.")
if DEVICE not in {"cpu", "cuda"}:
    raise RuntimeError("PEARLIX_LOCAL_AI_DEVICE must be cpu or cuda.")

if not settings.configured:
    settings.configure(
        PEARLIX_AI_MODEL_ROOT=str(MODEL_ROOT),
        PEARLIX_AI_DETECTOR_PATH="weights/detector_yolo_fdi_seg_v1-3_best.pt",
        PEARLIX_AI_CLASSIFIER_PATH="weights/classifier_exp1_epoch12.pt",
        PEARLIX_AI_FDI_MAP_PATH="contract/fdi_class_map.json",
        PEARLIX_AI_DEVICE=DEVICE,
        PEARLIX_AI_MAX_CONCURRENT_INFERENCES=1,
    )

from apps.ai_results.adapters.dentex import DentexConfig, DentexInferenceAdapter  # noqa: E402
from apps.ai_results.model_contract import MAX_IMAGE_INPUT_BYTES, PIPELINE_VERSION  # noqa: E402
from apps.ai_results.result_types import ImageInput  # noqa: E402
from apps.xrays.image_validation import ImageValidationError, validate_image_upload  # noqa: E402
from apps.xrays.request_limits import BoundedASGIRequestBodyMiddleware  # noqa: E402


app = FastAPI(
    title="Pearlix DENTEX Local AI",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(BoundedASGIRequestBodyMiddleware)
_adapter = DentexInferenceAdapter(DentexConfig.from_settings())


def _authorize(authorization: str | None) -> None:
    expected = f"Bearer {SERVICE_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _serialize_result(result) -> dict:
    return {
        "contract_version": REMOTE_CONTRACT_VERSION,
        "model_version": result.model_version,
        "teeth": [
            {
                "fdi_tooth_id": tooth.tooth.fdi_tooth_id,
                "detector_confidence": tooth.tooth.detector_confidence,
                "bbox_xyxy": list(tooth.tooth.bbox_xyxy),
                "model_scores": tooth.scores.to_json(),
            }
            for tooth in result.teeth
        ],
        "runtime": result.pipeline_metadata.get("runtime", {}),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "pearlix-dentex-local-ai",
        "model_version": PIPELINE_VERSION,
        "device": DEVICE,
    }


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    _authorize(authorization)
    content_type = (image.content_type or "").lower()
    if content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=415, detail="Only JPEG and PNG panoramic X-rays are supported.")

    content = await image.read(MAX_IMAGE_INPUT_BYTES + 1)
    if not content or len(content) > MAX_IMAGE_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 10 MiB.")
    extension = ".png" if content_type == "image/png" else ".jpg"
    try:
        validated = validate_image_upload(
            SimpleUploadedFile(f"panoramic{extension}", content, content_type=content_type),
            maximum_bytes=MAX_IMAGE_INPUT_BYTES,
        )
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail="The panoramic X-ray image is invalid.") from exc

    started = time.perf_counter()
    try:
        result = _adapter.analyze(ImageInput(content=validated.content, content_type=validated.content_type))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Locked DENTEX inference failed.") from exc
    if result.model_version != PIPELINE_VERSION:
        raise HTTPException(status_code=500, detail="Inference returned an unexpected model version.")

    payload = _serialize_result(result)
    payload.setdefault("runtime", {})["remote_wall_seconds"] = round(time.perf_counter() - started, 4)
    overlay = base64.b64encode(result.overlay_png).decode("ascii") if result.overlay_png else None
    return {"payload": payload, "overlay_png_base64": overlay}
