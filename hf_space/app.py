from __future__ import annotations

import tempfile
import time
from pathlib import Path
from uuid import uuid4

import gradio as gr
import spaces
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile


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
    raise gr.Error("Only JPEG and PNG panoramic X-rays are supported.")


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
        raise gr.Error("Uploaded image is unavailable.")
    if path.stat().st_size <= 0 or path.stat().st_size > MAX_IMAGE_INPUT_BYTES:
        raise gr.Error("Image must be between 1 byte and 10 MiB.")

    content_type = _content_type(path)
    try:
        validated = validate_image_upload(
            SimpleUploadedFile(path.name, path.read_bytes(), content_type=content_type)
        )
    except ImageValidationError as exc:
        raise gr.Error("The uploaded image is malformed or exceeds safe decoded-image limits.") from exc
    content = validated.content
    adapter = DentexInferenceAdapter(DentexConfig.from_settings())
    overlay_path = None
    try:
        result = adapter.analyze(ImageInput(content=content, content_type=content_type))
        if result.model_version != PIPELINE_VERSION:
            raise RuntimeError("Inference returned an unexpected locked model version.")
        payload = _serialize_result(result)
        payload.setdefault("runtime", {})["remote_wall_seconds"] = round(time.perf_counter() - started, 4)
        if result.overlay_png is not None:
            try:
                validated_overlay = validate_image_upload(
                    SimpleUploadedFile("overlay.png", result.overlay_png, content_type="image/png"),
                    require_png=True,
                    maximum_bytes=MAX_REMOTE_OVERLAY_BYTES,
                )
            except ImageValidationError as exc:
                raise RuntimeError("Inference overlay failed validation.") from exc
            overlay_path = Path(tempfile.gettempdir()) / f"pearlix-overlay-{uuid4().hex}.png"
            overlay_path.write_bytes(validated_overlay.content)
        return payload, str(overlay_path) if overlay_path else None
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


def analyze(image):
    if not image:
        raise gr.Error("Upload a panoramic X-ray first.")
    return _analyze_on_gpu(str(image))


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
    run.click(analyze, inputs=[image], outputs=[payload, overlay], api_name="analyze")


if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch()
