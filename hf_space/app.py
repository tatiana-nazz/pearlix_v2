from __future__ import annotations

import base64
import tempfile
import time
from pathlib import Path
from uuid import uuid4

import gradio as gr
import spaces
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from fastapi import FastAPI, File, HTTPException, UploadFile


MODEL_ROOT = Path("/models")
DETECTOR_REL = "weights/detector_yolo_fdi_seg_v1-3_best.pt"
CLASSIFIER_REL = "weights/classifier_exp1_epoch12.pt"
FDI_MAP_REL = "contract/fdi_class_map.json"
REMOTE_CONTRACT_VERSION = "pearlix-dentex-remote-v1"

if not settings.configured:
    settings.configure(
        PEARLIX_AI_MODEL_ROOT=str(MODEL_ROOT),
        PEARLIX_AI_DETECTOR_PATH=DETECTOR_REL,
        PEARLIX_AI_CLASSIFIER_PATH=CLASSIFIER_REL,
        PEARLIX_AI_FDI_MAP_PATH=FDI_MAP_REL,
        PEARLIX_AI_DEVICE="cuda",
        PEARLIX_AI_MAX_CONCURRENT_INFERENCES=1,
    )

from apps.ai_results.adapters.dentex import (  # noqa: E402
    DentexConfig,
    DentexInferenceAdapter,
    reset_dentex_caches,
)
from apps.ai_results.model_contract import MAX_IMAGE_INPUT_BYTES, PIPELINE_VERSION  # noqa: E402
from apps.ai_results.result_types import ImageInput  # noqa: E402
from apps.xrays.image_validation import ImageValidationError, validate_image_upload  # noqa: E402

MAX_REMOTE_OVERLAY_BYTES = 20 * 1024 * 1024
MAX_REMOTE_TOOTH_ROWS = 32


def _content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    raise ValueError("Only JPEG and PNG panoramic X-rays are supported.")


def _serialize_result(result) -> dict:
    if len(result.teeth) > MAX_REMOTE_TOOTH_ROWS:
        raise RuntimeError("Inference returned too many tooth rows.")
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


@spaces.GPU(duration=45)
def _analyze_on_gpu(image_path: str):
    started = time.perf_counter()
    path = Path(image_path)
    if not path.is_file():
        raise RuntimeError("Uploaded image is unavailable.")
    if path.stat().st_size <= 0 or path.stat().st_size > MAX_IMAGE_INPUT_BYTES:
        raise RuntimeError("Image must be between 1 byte and 10 MiB.")

    content_type = _content_type(path)
    try:
        validated = validate_image_upload(
            SimpleUploadedFile(path.name, path.read_bytes(), content_type=content_type)
        )
    except ImageValidationError as exc:
        raise RuntimeError("The uploaded image is malformed or exceeds safe decoded-image limits.") from exc

    adapter = DentexInferenceAdapter(DentexConfig.from_settings())
    try:
        result = adapter.analyze(
            ImageInput(content=validated.content, content_type=validated.content_type)
        )
        if result.model_version != PIPELINE_VERSION:
            raise RuntimeError("Inference returned an unexpected locked model version.")
        payload = _serialize_result(result)
        payload.setdefault("runtime", {})["remote_wall_seconds"] = round(
            time.perf_counter() - started, 4
        )
        overlay_png = None
        if result.overlay_png is not None:
            try:
                validated_overlay = validate_image_upload(
                    SimpleUploadedFile(
                        "overlay.png", result.overlay_png, content_type="image/png"
                    ),
                    require_png=True,
                    maximum_bytes=MAX_REMOTE_OVERLAY_BYTES,
                )
            except ImageValidationError as exc:
                raise RuntimeError("Inference overlay failed validation.") from exc
            overlay_png = validated_overlay.content
        return payload, overlay_png
    finally:
        # ZeroGPU leases are short-lived. Do not retain CUDA model references
        # after a request; the next call revalidates and reloads the locked bundle.
        reset_dentex_caches()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


def _write_temp_image(content: bytes, suffix: str) -> Path:
    with tempfile.NamedTemporaryFile(
        prefix="pearlix-space-input-", suffix=suffix, delete=False
    ) as handle:
        handle.write(content)
        handle.flush()
        return Path(handle.name)


def _validated_upload(file_name: str, content_type: str, content: bytes):
    if content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG and PNG panoramic X-rays are supported.",
        )
    if not content or len(content) > MAX_IMAGE_INPUT_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image must be between 1 byte and 10 MiB.",
        )
    suffix = ".png" if content_type == "image/png" else ".jpg"
    try:
        return validate_image_upload(
            SimpleUploadedFile(
                f"panoramic{suffix}", content, content_type=content_type
            ),
            maximum_bytes=MAX_IMAGE_INPUT_BYTES,
        )
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="The panoramic X-ray image is invalid.",
        ) from exc


api = FastAPI(
    title="Pearlix DENTEX AI",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@api.get("/health")
def health():
    return {
        "status": "ok",
        "service": "pearlix-dentex-hf-ai",
        "model_version": PIPELINE_VERSION,
        "device": "cuda",
    }


@api.post("/analyze")
def analyze_api(image: UploadFile = File(...)):
    # The publisher always creates this Space as private. Hugging Face's private
    # Space gateway authenticates the Authorization: Bearer <HF token> header
    # sent by the Pearlix backend before this application receives the request.
    content_type = (image.content_type or "").lower()
    content = image.file.read(MAX_IMAGE_INPUT_BYTES + 1)
    validated = _validated_upload(image.filename or "panoramic", content_type, content)
    temporary_path = _write_temp_image(validated.content, validated.extension)
    try:
        payload, overlay_png = _analyze_on_gpu(str(temporary_path))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Locked DENTEX inference failed.") from exc
    finally:
        temporary_path.unlink(missing_ok=True)

    overlay = base64.b64encode(overlay_png).decode("ascii") if overlay_png else None
    return {"payload": payload, "overlay_png_base64": overlay}


def analyze(image):
    """Human-facing Gradio demo wrapper; production Pearlix uses /analyze."""
    if not image:
        raise gr.Error("Upload a panoramic X-ray first.")
    try:
        payload, overlay_png = _analyze_on_gpu(str(image))
    except Exception as exc:
        raise gr.Error(str(exc)) from exc
    overlay_path = None
    if overlay_png:
        overlay_path = Path(tempfile.gettempdir()) / f"pearlix-overlay-{uuid4().hex}.png"
        overlay_path.write_bytes(overlay_png)
    return payload, str(overlay_path) if overlay_path else None


with gr.Blocks(title="Pearlix DENTEX AI", delete_cache=(3600, 3600)) as demo:
    gr.Markdown(
        "# Pearlix DENTEX AI\n"
        "Research/demo inference service. **Not a clinical diagnosis.** "
        "This private Space is called only by the Pearlix backend."
    )
    image = gr.File(label="Panoramic X-ray", file_types=["image"], type="filepath")
    run = gr.Button("Run research inference", variant="primary")
    payload = gr.JSON(label="Locked raw model contract")
    overlay = gr.File(label="Annotated overlay")
    run.click(analyze, inputs=[image], outputs=[payload, overlay], api_name="gradio_analyze")


demo.queue(default_concurrency_limit=1)
app = gr.mount_gradio_app(api, demo, path="/ui")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
