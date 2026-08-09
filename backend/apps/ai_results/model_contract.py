from __future__ import annotations

import hashlib
import re
from pathlib import Path
from types import MappingProxyType


DETECTOR_NAME = "yolo_fdi_seg_v1-3"
DETECTOR_SHA256 = "29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b"
DETECTOR_CONFIDENCE_THRESHOLD = 0.35
DETECTOR_IOU_THRESHOLD = 0.50
DETECTOR_EXPLICIT_IMAGE_SIZE = None
TORCH_VERSION = "2.11.0"
TORCHVISION_VERSION = "0.26.0"
ULTRALYTICS_VERSION = "8.4.48"

FDI_MAP_SHA256 = "72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec"
FDI_TOOTH_IDS = (
    "11", "12", "13", "14", "15", "16", "17", "18",
    "21", "22", "23", "24", "25", "26", "27", "28",
    "31", "32", "33", "34", "35", "36", "37", "38",
    "41", "42", "43", "44", "45", "46", "47", "48",
)

CLASSIFIER_ARCHITECTURE = "EfficientNetV2-S"
CLASSIFIER_EXPERIMENT = 1
CLASSIFIER_CHECKPOINT_EPOCH = 12
CLASSIFIER_SHA256 = "aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a"

DISEASE_CLASSES = (
    "Any Caries",
    "Deep Caries",
    "Impacted",
    "Periapical Lesion",
)
CLASS_THRESHOLDS = (
    ("Any Caries", 0.44),
    ("Deep Caries", 0.50),
    ("Impacted", 0.50),
    ("Periapical Lesion", 0.50),
)
THRESHOLDS = MappingProxyType(dict(CLASS_THRESHOLDS))
ANY_CARIES_REVIEW_MIN = 0.30
HIERARCHY_RULE = "Deep Caries positive forces Any Caries positive."
MODEL_SCORE_SEMANTICS = "UNCALIBRATED_MODEL_SCORE"

CROP_SOURCE = "detector_bounding_box"
CROP_PADDING_RATIO = 0.02
INPUT_COLOR = "RGB"
INPUT_GEOMETRY = "black_square_letterbox_then_resize"
CLASSIFIER_IMAGE_SIZE = (384, 384)
NORMALIZATION_MEAN = (0.485, 0.456, 0.406)
NORMALIZATION_STD = (0.229, 0.224, 0.225)
CLASSIFIER_ACTIVATION = "sigmoid"
DUPLICATE_FDI_POLICY = "retain_highest_detector_confidence"

OVERLAY_GEOMETRY = "bounding_box_outline"
OVERLAY_BOX_FILL = False
OVERLAY_DRAW_NORMAL_TEETH = False
OVERLAY_UPPER_JAW_LABEL_POSITION = "above"
OVERLAY_LOWER_JAW_LABEL_POSITION = "below"
OVERLAY_OUTPUT = "RGB_ANNOTATED_FULL_IMAGE_PNG"

PIPELINE_VERSION = "dentex-yolo_fdi_seg_v1-3__exp1-e12__thr-044-050-050-050"
FINDINGS_SCHEMA_VERSION = "pearlix-dentex-findings-v1"
MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024

_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class ModelIntegrityError(ValueError):
    """Raised when an operator-configured model artifact is not trusted."""


def stream_sha256(path: str | Path, *, chunk_size: int = 1024 * 1024) -> str:
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive.")
    artifact = Path(path)
    if not artifact.is_file():
        raise ModelIntegrityError("Configured model artifact is not a regular file.")
    digest = hashlib.sha256()
    with artifact.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_trusted_artifact(*, trusted_root: str | Path, configured_path: str | Path) -> Path:
    try:
        root = Path(trusted_root).expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ModelIntegrityError("Trusted model root is unavailable.") from exc
    if not root.is_dir():
        raise ModelIntegrityError("Trusted model root is not a directory.")

    candidate = Path(configured_path).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    try:
        artifact = candidate.resolve(strict=True)
        artifact.relative_to(root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise ModelIntegrityError("Configured model artifact is outside the trusted root or unavailable.") from exc
    if not artifact.is_file():
        raise ModelIntegrityError("Configured model artifact is not a regular file.")
    return artifact


def verify_trusted_artifact(
    *,
    trusted_root: str | Path,
    configured_path: str | Path,
    expected_sha256: str,
) -> Path:
    expected = expected_sha256.strip().lower()
    if not _SHA256_PATTERN.fullmatch(expected):
        raise ModelIntegrityError("Expected model SHA-256 is invalid.")
    artifact = resolve_trusted_artifact(trusted_root=trusted_root, configured_path=configured_path)
    if stream_sha256(artifact) != expected:
        raise ModelIntegrityError("Configured model artifact failed SHA-256 verification.")
    return artifact


def locked_pipeline_metadata() -> dict:
    return {
        "detector": {
            "name": DETECTOR_NAME,
            "sha256": DETECTOR_SHA256,
            "confidence_threshold": DETECTOR_CONFIDENCE_THRESHOLD,
            "iou_threshold": DETECTOR_IOU_THRESHOLD,
            "explicit_image_size": DETECTOR_EXPLICIT_IMAGE_SIZE,
            "fdi_map_sha256": FDI_MAP_SHA256,
            "duplicate_fdi_policy": DUPLICATE_FDI_POLICY,
        },
        "classifier": {
            "architecture": CLASSIFIER_ARCHITECTURE,
            "experiment": CLASSIFIER_EXPERIMENT,
            "checkpoint_epoch": CLASSIFIER_CHECKPOINT_EPOCH,
            "sha256": CLASSIFIER_SHA256,
            "class_order": list(DISEASE_CLASSES),
            "thresholds": dict(CLASS_THRESHOLDS),
            "activation": CLASSIFIER_ACTIVATION,
        },
        "review": {
            "label": "Any Caries",
            "min_inclusive": ANY_CARIES_REVIEW_MIN,
            "max_exclusive": THRESHOLDS["Any Caries"],
            "is_positive": False,
        },
        "hierarchy": HIERARCHY_RULE,
        "preprocessing": {
            "crop_source": CROP_SOURCE,
            "crop_padding_ratio": CROP_PADDING_RATIO,
            "input_color": INPUT_COLOR,
            "input_geometry": INPUT_GEOMETRY,
            "classifier_image_size": list(CLASSIFIER_IMAGE_SIZE),
            "normalization_mean": list(NORMALIZATION_MEAN),
            "normalization_std": list(NORMALIZATION_STD),
        },
        "overlay": {
            "geometry": OVERLAY_GEOMETRY,
            "box_fill": OVERLAY_BOX_FILL,
            "draw_normal_teeth": OVERLAY_DRAW_NORMAL_TEETH,
            "upper_jaw_labels": OVERLAY_UPPER_JAW_LABEL_POSITION,
            "lower_jaw_labels": OVERLAY_LOWER_JAW_LABEL_POSITION,
            "output": OVERLAY_OUTPUT,
        },
    }
