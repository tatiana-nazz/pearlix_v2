from __future__ import annotations

import importlib
import json
import math
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from django.conf import settings

from apps.ai_results.adapters.base import (
    InferenceConfigurationError,
    InferenceImageInvalidError,
    InferenceRuntimeError,
)
from apps.ai_results.model_contract import (
    CLASSIFIER_CHECKPOINT_EPOCH,
    CLASSIFIER_IMAGE_SIZE,
    CLASSIFIER_SHA256,
    CROP_PADDING_RATIO,
    DETECTOR_CONFIDENCE_THRESHOLD,
    DETECTOR_IOU_THRESHOLD,
    DETECTOR_SHA256,
    DISEASE_CLASSES,
    FDI_MAP_SHA256,
    FDI_TOOTH_IDS,
    INPUT_GEOMETRY,
    NORMALIZATION_MEAN,
    NORMALIZATION_STD,
    PIPELINE_VERSION,
    THRESHOLDS,
    TORCH_VERSION,
    TORCHVISION_VERSION,
    ULTRALYTICS_VERSION,
    ModelIntegrityError,
    locked_pipeline_metadata,
    verify_trusted_artifact,
)
from apps.ai_results.overlay import render_overlay_png
from apps.ai_results.result_types import (
    DetectedTooth,
    ImageInput,
    PipelineResult,
    ToothScores,
    apply_locked_policy,
)


_CONTENT_TYPE_SUFFIXES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
}


@dataclass(frozen=True)
class DentexConfig:
    model_root: str
    detector_path: str
    classifier_path: str
    fdi_map_path: str
    device: str
    max_concurrent_inferences: int

    @classmethod
    def from_settings(cls) -> "DentexConfig":
        values = {
            "model_root": str(getattr(settings, "PEARLIX_AI_MODEL_ROOT", "") or "").strip(),
            "detector_path": str(getattr(settings, "PEARLIX_AI_DETECTOR_PATH", "") or "").strip(),
            "classifier_path": str(getattr(settings, "PEARLIX_AI_CLASSIFIER_PATH", "") or "").strip(),
            "fdi_map_path": str(getattr(settings, "PEARLIX_AI_FDI_MAP_PATH", "") or "").strip(),
        }
        if not all(values.values()):
            raise InferenceConfigurationError("The Dentex artifact configuration is incomplete.")

        device = str(getattr(settings, "PEARLIX_AI_DEVICE", "cpu") or "cpu").strip().lower()
        if device not in {"cpu", "cuda"}:
            raise InferenceConfigurationError("The configured AI device is unsupported.")
        try:
            max_concurrent = int(getattr(settings, "PEARLIX_AI_MAX_CONCURRENT_INFERENCES", 1))
        except (TypeError, ValueError) as exc:
            raise InferenceConfigurationError("The AI concurrency setting is invalid.") from exc
        if max_concurrent < 1:
            raise InferenceConfigurationError("The AI concurrency setting must be positive.")
        return cls(
            **values,
            device=device,
            max_concurrent_inferences=max_concurrent,
        )


@dataclass(frozen=True)
class RawDetection:
    detector_index: int
    fdi_tooth_id: str
    detector_confidence: float
    bbox_xyxy: tuple[float, float, float, float]


@dataclass(frozen=True)
class RuntimeModules:
    torch: Any
    torchvision: Any
    models: Any
    transforms: Any
    nn: Any
    numpy: Any
    cv2: Any
    image_module: Any
    image_ops: Any
    yolo_class: Any
    package_versions: Mapping[str, str]


@dataclass(frozen=True)
class ModelBundle:
    detector: Any
    classifier: Any
    classifier_transform: Any
    class_id_to_fdi: Mapping[str, str]
    runtime: RuntimeModules
    device: str
    detector_load_seconds: float
    classifier_load_seconds: float
    bundle_load_seconds: float


def square_padding(width: int, height: int) -> tuple[int, int, int, int]:
    side = max(int(width), int(height))
    left = (side - int(width)) // 2
    top = (side - int(height)) // 2
    return left, top, side - int(width) - left, side - int(height) - top


class PadToSquare:
    def __init__(self, fill: int = 0, *, image_ops=None):
        self.fill = int(fill)
        self._image_ops = image_ops

    def __call__(self, image):
        image_ops = self._image_ops
        if image_ops is None:
            image_ops = importlib.import_module("PIL.ImageOps")
        return image_ops.expand(image, border=square_padding(*image.size), fill=self.fill)


def validate_fdi_class_map(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise InferenceConfigurationError("The FDI class map must be a JSON object.")
    required = {"fdi_tooth_id_to_class_id", "class_id_to_fdi_tooth_id", "class_names"}
    if not required.issubset(payload):
        raise InferenceConfigurationError("The FDI class map is missing required fields.")

    class_names = payload["class_names"]
    if class_names != list(FDI_TOOTH_IDS):
        raise InferenceConfigurationError("The FDI class-name order differs from the locked contract.")

    expected_forward = {fdi: index for index, fdi in enumerate(FDI_TOOTH_IDS)}
    raw_forward = payload["fdi_tooth_id_to_class_id"]
    if raw_forward != expected_forward:
        raise InferenceConfigurationError("The FDI forward map differs from the locked contract.")

    expected_reverse = {str(index): fdi for index, fdi in enumerate(FDI_TOOTH_IDS)}
    raw_reverse = payload["class_id_to_fdi_tooth_id"]
    if raw_reverse != expected_reverse:
        raise InferenceConfigurationError("The FDI reverse map differs from the locked contract.")
    return {
        "fdi_tooth_id_to_class_id": expected_forward,
        "class_id_to_fdi_tooth_id": expected_reverse,
        "class_names": list(FDI_TOOTH_IDS),
    }


def normalize_detector_names(raw_names: object) -> list[str]:
    if isinstance(raw_names, dict):
        try:
            indexed = sorted((int(index), str(name)) for index, name in raw_names.items())
        except (TypeError, ValueError) as exc:
            raise InferenceConfigurationError("Detector class names are invalid.") from exc
        if [index for index, _ in indexed] != list(range(len(indexed))):
            raise InferenceConfigurationError("Detector class indexes are not contiguous.")
        return [name for _, name in indexed]
    if isinstance(raw_names, Sequence) and not isinstance(raw_names, (str, bytes)):
        return [str(name) for name in raw_names]
    raise InferenceConfigurationError("Detector class names are invalid.")


def validate_detector_names(raw_names: object, expected_names: Sequence[str]) -> None:
    if normalize_detector_names(raw_names) != [str(name) for name in expected_names]:
        raise InferenceConfigurationError("Detector class order differs from the verified FDI map.")


def normalize_detector_result(yolo_result: object, class_id_to_fdi: Mapping[str, str]) -> list[RawDetection]:
    boxes = getattr(yolo_result, "boxes", None)
    if boxes is None:
        return []
    detections = []
    for detector_index in range(len(boxes)):
        box = boxes[detector_index]
        class_id = int(box.cls.item())
        fdi = class_id_to_fdi.get(str(class_id))
        if fdi not in FDI_TOOTH_IDS:
            continue
        confidence = float(box.conf.item())
        coordinates = box.xyxy.cpu().numpy().reshape(-1).astype(float)
        if len(coordinates) < 4:
            raise ValueError("Detector returned an invalid bounding box.")
        bbox = tuple(float(value) for value in coordinates[:4])
        if not math.isfinite(confidence) or not all(math.isfinite(value) for value in bbox):
            raise ValueError("Detector returned non-finite output.")
        detections.append(
            RawDetection(
                detector_index=detector_index,
                fdi_tooth_id=fdi,
                detector_confidence=confidence,
                bbox_xyxy=bbox,
            )
        )
    return detections


def filter_duplicate_fdi_detections(detections: Sequence[RawDetection]) -> tuple[list[RawDetection], int]:
    strongest: dict[str, RawDetection] = {}
    for detection in detections:
        current = strongest.get(detection.fdi_tooth_id)
        if current is None or detection.detector_confidence > current.detector_confidence:
            strongest[detection.fdi_tooth_id] = detection
    retained = sorted(strongest.values(), key=lambda item: item.detector_index)
    return retained, len(detections) - len(retained)


def crop_with_bbox(image_rgb, bbox_xyxy: Sequence[float], padding_ratio: float = CROP_PADDING_RATIO):
    image_height, image_width = image_rgb.shape[:2]
    x1, y1, x2, y2 = [float(value) for value in bbox_xyxy[:4]]
    box_width = max(1.0, x2 - x1)
    box_height = max(1.0, y2 - y1)
    pad_x = box_width * float(padding_ratio)
    pad_y = box_height * float(padding_ratio)
    x1i = max(0, min(math.floor(x1 - pad_x), image_width - 1))
    y1i = max(0, min(math.floor(y1 - pad_y), image_height - 1))
    x2i = max(1, min(math.ceil(x2 + pad_x), image_width))
    y2i = max(1, min(math.ceil(y2 + pad_y), image_height))
    return image_rgb[y1i:y2i, x1i:x2i].copy()


def _numbers_match(actual: object, expected: Sequence[float]) -> bool:
    if not isinstance(actual, (list, tuple)) or len(actual) != len(expected):
        return False
    try:
        return all(
            math.isclose(float(value), float(target), rel_tol=1e-9, abs_tol=1e-9)
            for value, target in zip(actual, expected)
        )
    except (TypeError, ValueError):
        return False


def validate_classifier_checkpoint_metadata(checkpoint: object) -> float:
    if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
        raise InferenceConfigurationError("The classifier checkpoint is not metadata-rich.")
    if checkpoint.get("model_name") != "efficientnet_v2_s":
        raise InferenceConfigurationError("The classifier architecture metadata is invalid.")
    label_names = checkpoint.get("label_names")
    if not isinstance(label_names, (list, tuple)) or tuple(label_names) != DISEASE_CLASSES:
        raise InferenceConfigurationError("The classifier label order is invalid.")
    try:
        image_size = int(checkpoint.get("image_size", -1))
        best_epoch = int(checkpoint.get("best_epoch", -1))
    except (TypeError, ValueError) as exc:
        raise InferenceConfigurationError("The classifier numeric metadata is invalid.") from exc
    if image_size != CLASSIFIER_IMAGE_SIZE[0]:
        raise InferenceConfigurationError("The classifier image-size metadata is invalid.")
    try:
        crop_padding = float(checkpoint.get("crop_padding_ratio", math.nan))
    except (TypeError, ValueError) as exc:
        raise InferenceConfigurationError("The classifier crop metadata is invalid.") from exc
    if not math.isclose(crop_padding, CROP_PADDING_RATIO, rel_tol=1e-9, abs_tol=1e-9):
        raise InferenceConfigurationError("The classifier crop metadata is invalid.")
    if checkpoint.get("input_geometry") != INPUT_GEOMETRY:
        raise InferenceConfigurationError("The classifier input geometry is invalid.")
    if checkpoint.get("operating_thresholds") != dict(THRESHOLDS):
        raise InferenceConfigurationError("The classifier operating thresholds are invalid.")
    if best_epoch != CLASSIFIER_CHECKPOINT_EPOCH:
        raise InferenceConfigurationError("The classifier epoch differs from the final operating policy.")
    if not _numbers_match(checkpoint.get("normalization_mean"), NORMALIZATION_MEAN):
        raise InferenceConfigurationError("The classifier normalization mean is invalid.")
    if not _numbers_match(checkpoint.get("normalization_std"), NORMALIZATION_STD):
        raise InferenceConfigurationError("The classifier normalization standard deviation is invalid.")
    head_metadata = checkpoint.get("classifier_head", {})
    if not isinstance(head_metadata, dict):
        raise InferenceConfigurationError("The classifier head metadata is invalid.")
    try:
        dropout = float(head_metadata.get("dropout", 0.3))
    except (TypeError, ValueError) as exc:
        raise InferenceConfigurationError("The classifier dropout metadata is invalid.") from exc
    if not math.isfinite(dropout) or not 0 <= dropout < 1:
        raise InferenceConfigurationError("The classifier dropout metadata is invalid.")
    return dropout


def _version_base(version: object) -> str:
    return str(version).split("+", 1)[0]


def validate_runtime_device(device: str, torch_module) -> None:
    if device == "cuda" and not torch_module.cuda.is_available():
        raise InferenceConfigurationError("CUDA was requested but is unavailable.")


def _import_runtime() -> RuntimeModules:
    torch = importlib.import_module("torch")
    torchvision = importlib.import_module("torchvision")
    ultralytics = importlib.import_module("ultralytics")
    numpy = importlib.import_module("numpy")
    cv2 = importlib.import_module("cv2")
    pil = importlib.import_module("PIL")
    image_module = importlib.import_module("PIL.Image")
    image_ops = importlib.import_module("PIL.ImageOps")
    models = importlib.import_module("torchvision.models")
    transforms = importlib.import_module("torchvision.transforms")
    nn = importlib.import_module("torch.nn")
    yolo_class = getattr(importlib.import_module("ultralytics"), "YOLO")

    if _version_base(torch.__version__) != TORCH_VERSION:
        raise InferenceConfigurationError("The installed Torch version differs from the locked runtime.")
    if _version_base(torchvision.__version__) != TORCHVISION_VERSION:
        raise InferenceConfigurationError("The installed TorchVision version differs from the locked runtime.")
    if str(ultralytics.__version__) != ULTRALYTICS_VERSION:
        raise InferenceConfigurationError("The installed Ultralytics version differs from the locked runtime.")
    return RuntimeModules(
        torch=torch,
        torchvision=torchvision,
        models=models,
        transforms=transforms,
        nn=nn,
        numpy=numpy,
        cv2=cv2,
        image_module=image_module,
        image_ops=image_ops,
        yolo_class=yolo_class,
        package_versions={
            "torch": str(torch.__version__),
            "torchvision": str(torchvision.__version__),
            "ultralytics": str(ultralytics.__version__),
            "numpy": str(numpy.__version__),
            "pillow": str(pil.__version__),
            "opencv": str(cv2.__version__),
        },
    )


def _load_checkpoint(torch_module, checkpoint_path: Path, device: str):
    try:
        return torch_module.load(checkpoint_path, map_location=device, weights_only=False)
    except TypeError:
        return torch_module.load(checkpoint_path, map_location=device)


def _load_model_bundle_uncached(config: DentexConfig) -> ModelBundle:
    started = time.perf_counter()
    detector_path = verify_trusted_artifact(
        trusted_root=config.model_root,
        configured_path=config.detector_path,
        expected_sha256=DETECTOR_SHA256,
    )
    classifier_path = verify_trusted_artifact(
        trusted_root=config.model_root,
        configured_path=config.classifier_path,
        expected_sha256=CLASSIFIER_SHA256,
    )
    fdi_map_path = verify_trusted_artifact(
        trusted_root=config.model_root,
        configured_path=config.fdi_map_path,
        expected_sha256=FDI_MAP_SHA256,
    )

    runtime = _import_runtime()
    validate_runtime_device(config.device, runtime.torch)

    with fdi_map_path.open("r", encoding="utf-8") as handle:
        fdi_map = validate_fdi_class_map(json.load(handle))

    detector_started = time.perf_counter()
    detector = runtime.yolo_class(str(detector_path))
    detector_load_seconds = time.perf_counter() - detector_started
    validate_detector_names(detector.names, fdi_map["class_names"])

    classifier_started = time.perf_counter()
    checkpoint = _load_checkpoint(runtime.torch, classifier_path, config.device)
    dropout = validate_classifier_checkpoint_metadata(checkpoint)
    classifier = runtime.models.efficientnet_v2_s(weights=None)
    in_features = classifier.classifier[1].in_features
    classifier.classifier[1] = runtime.nn.Sequential(
        runtime.nn.Dropout(p=dropout),
        runtime.nn.Linear(in_features, len(DISEASE_CLASSES)),
    )
    classifier.load_state_dict(checkpoint["model_state_dict"], strict=True)
    classifier = classifier.to(config.device).eval()
    classifier_transform = runtime.transforms.Compose(
        [
            PadToSquare(fill=0, image_ops=runtime.image_ops),
            runtime.transforms.Resize(CLASSIFIER_IMAGE_SIZE),
            runtime.transforms.ToTensor(),
            runtime.transforms.Normalize(mean=list(NORMALIZATION_MEAN), std=list(NORMALIZATION_STD)),
        ]
    )
    classifier_load_seconds = time.perf_counter() - classifier_started
    return ModelBundle(
        detector=detector,
        classifier=classifier,
        classifier_transform=classifier_transform,
        class_id_to_fdi=fdi_map["class_id_to_fdi_tooth_id"],
        runtime=runtime,
        device=config.device,
        detector_load_seconds=detector_load_seconds,
        classifier_load_seconds=classifier_load_seconds,
        bundle_load_seconds=time.perf_counter() - started,
    )


_MODEL_BUNDLE: ModelBundle | None = None
_MODEL_BUNDLE_CONFIG: DentexConfig | None = None
_MODEL_LOAD_LOCK = threading.Lock()


def load_model_bundle(config: DentexConfig) -> ModelBundle:
    global _MODEL_BUNDLE, _MODEL_BUNDLE_CONFIG
    if _MODEL_BUNDLE is not None and _MODEL_BUNDLE_CONFIG == config:
        return _MODEL_BUNDLE
    with _MODEL_LOAD_LOCK:
        if _MODEL_BUNDLE is not None and _MODEL_BUNDLE_CONFIG == config:
            return _MODEL_BUNDLE
        try:
            bundle = _load_model_bundle_uncached(config)
        except InferenceConfigurationError:
            raise
        except (ModelIntegrityError, FileNotFoundError, json.JSONDecodeError, ImportError) as exc:
            raise InferenceConfigurationError("The Dentex runtime could not be configured safely.") from exc
        except Exception as exc:
            raise InferenceConfigurationError("The verified Dentex model bundle could not be initialized.") from exc
        _MODEL_BUNDLE = bundle
        _MODEL_BUNDLE_CONFIG = config
        return bundle


def tooth_scores_from_model_output(values: Sequence[float]) -> ToothScores:
    if len(values) != len(DISEASE_CLASSES):
        raise ValueError("Classifier returned the wrong number of scores.")
    normalized = tuple(float(value) for value in values)
    if not all(math.isfinite(value) and 0 <= value <= 1 for value in normalized):
        raise ValueError("Classifier returned invalid model scores.")
    return ToothScores(normalized)


def score_crop(crop_rgb, bundle: ModelBundle) -> ToothScores:
    runtime = bundle.runtime
    image = runtime.image_module.fromarray(crop_rgb)
    tensor = bundle.classifier_transform(image).unsqueeze(0).to(bundle.device)
    use_amp = bundle.device == "cuda"
    with runtime.torch.no_grad():
        with runtime.torch.cuda.amp.autocast(enabled=use_amp):
            logits = bundle.classifier(tensor)
        scores = runtime.torch.sigmoid(logits.float()).cpu().numpy().reshape(-1)
    return tooth_scores_from_model_output(scores)


class DentexInferenceAdapter:
    model_version = PIPELINE_VERSION

    def __init__(self, config: DentexConfig):
        self.config = config
        self._inference_guard = threading.BoundedSemaphore(config.max_concurrent_inferences)

    def ensure_ready(self) -> ModelBundle:
        return load_model_bundle(self.config)

    def analyze(self, image: ImageInput) -> PipelineResult:
        if not isinstance(image, ImageInput):
            raise TypeError("DentexInferenceAdapter requires ImageInput.")
        suffix = _CONTENT_TYPE_SUFFIXES.get(image.content_type.lower())
        if suffix is None:
            raise InferenceImageInvalidError("The image content type is unsupported.")
        try:
            with self._inference_guard:
                return self._analyze_guarded(image, suffix=suffix)
        except InferenceImageInvalidError:
            raise
        except Exception as exc:
            raise InferenceRuntimeError("Dentex inference failed.") from exc

    def _analyze_guarded(self, image: ImageInput, *, suffix: str) -> PipelineResult:
        bundle = self.ensure_ready()
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(prefix="pearlix-ai-", suffix=suffix, delete=False) as handle:
                handle.write(image.content)
                handle.flush()
                temporary_path = Path(handle.name)

            runtime = bundle.runtime
            image_bgr = runtime.cv2.imread(str(temporary_path), runtime.cv2.IMREAD_COLOR)
            if image_bgr is None:
                raise InferenceImageInvalidError("OpenCV could not decode the uploaded image.")
            image_rgb = runtime.cv2.cvtColor(image_bgr, runtime.cv2.COLOR_BGR2RGB)

            detector_results = bundle.detector.predict(
                source=str(temporary_path),
                conf=DETECTOR_CONFIDENCE_THRESHOLD,
                iou=DETECTOR_IOU_THRESHOLD,
                verbose=False,
            )
            first_result = detector_results[0] if detector_results else None
            detector_box_count = len(first_result.boxes) if first_result is not None and first_result.boxes is not None else 0
            normalized = (
                normalize_detector_result(first_result, bundle.class_id_to_fdi)
                if first_result is not None
                else []
            )
            retained, duplicates_removed = filter_duplicate_fdi_detections(normalized)

            teeth = []
            for detection in retained:
                crop_rgb = crop_with_bbox(image_rgb, detection.bbox_xyxy)
                if getattr(crop_rgb, "size", 0) == 0:
                    continue
                tooth = DetectedTooth(
                    fdi_tooth_id=detection.fdi_tooth_id,
                    detector_confidence=detection.detector_confidence,
                    bbox_xyxy=detection.bbox_xyxy,
                )
                teeth.append(apply_locked_policy(tooth, score_crop(crop_rgb, bundle)))
            tooth_decisions = tuple(teeth)
            overlay_png = render_overlay_png(image_rgb, tooth_decisions, cv2_module=runtime.cv2)
            metadata = locked_pipeline_metadata()
            metadata["runtime"] = {
                "device": bundle.device,
                "package_versions": dict(bundle.runtime.package_versions),
                "detector_box_count": detector_box_count,
                "duplicate_fdi_detections_removed": duplicates_removed,
                "retained_teeth": len(tooth_decisions),
            }
            return PipelineResult(
                result_summary="Research-only AI analysis completed.",
                model_version=self.model_version,
                teeth=tooth_decisions,
                overall_confidence=None,
                pipeline_metadata=metadata,
                overlay_png=overlay_png,
            )
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)


_DENTEX_ADAPTER: DentexInferenceAdapter | None = None
_DENTEX_ADAPTER_CONFIG: DentexConfig | None = None
_ADAPTER_LOAD_LOCK = threading.Lock()


def get_dentex_adapter() -> DentexInferenceAdapter:
    global _DENTEX_ADAPTER, _DENTEX_ADAPTER_CONFIG
    config = DentexConfig.from_settings()
    if _DENTEX_ADAPTER is not None and _DENTEX_ADAPTER_CONFIG == config:
        return _DENTEX_ADAPTER
    with _ADAPTER_LOAD_LOCK:
        if _DENTEX_ADAPTER is not None and _DENTEX_ADAPTER_CONFIG == config:
            return _DENTEX_ADAPTER
        adapter = DentexInferenceAdapter(config)
        adapter.ensure_ready()
        _DENTEX_ADAPTER = adapter
        _DENTEX_ADAPTER_CONFIG = config
        return adapter


def reset_dentex_caches() -> None:
    global _DENTEX_ADAPTER, _DENTEX_ADAPTER_CONFIG, _MODEL_BUNDLE, _MODEL_BUNDLE_CONFIG
    with _ADAPTER_LOAD_LOCK:
        _DENTEX_ADAPTER = None
        _DENTEX_ADAPTER_CONFIG = None
        with _MODEL_LOAD_LOCK:
            _MODEL_BUNDLE = None
            _MODEL_BUNDLE_CONFIG = None
