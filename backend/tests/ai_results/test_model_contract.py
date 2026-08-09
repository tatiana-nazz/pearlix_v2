import hashlib

import pytest

from apps.ai_results.model_contract import (
    ANY_CARIES_REVIEW_MIN,
    CLASSIFIER_ACTIVATION,
    CLASSIFIER_ARCHITECTURE,
    CLASSIFIER_CHECKPOINT_EPOCH,
    CLASSIFIER_EXPERIMENT,
    CLASSIFIER_IMAGE_SIZE,
    CLASSIFIER_SHA256,
    CROP_PADDING_RATIO,
    CROP_SOURCE,
    DETECTOR_CONFIDENCE_THRESHOLD,
    DETECTOR_EXPLICIT_IMAGE_SIZE,
    DETECTOR_IOU_THRESHOLD,
    DETECTOR_NAME,
    DETECTOR_SHA256,
    DISEASE_CLASSES,
    DUPLICATE_FDI_POLICY,
    FDI_MAP_SHA256,
    FDI_TOOTH_IDS,
    INPUT_COLOR,
    INPUT_GEOMETRY,
    MODEL_SCORE_SEMANTICS,
    NORMALIZATION_MEAN,
    NORMALIZATION_STD,
    OVERLAY_BOX_FILL,
    OVERLAY_DRAW_NORMAL_TEETH,
    OVERLAY_GEOMETRY,
    OVERLAY_LOWER_JAW_LABEL_POSITION,
    OVERLAY_OUTPUT,
    OVERLAY_UPPER_JAW_LABEL_POSITION,
    PIPELINE_VERSION,
    THRESHOLDS,
    ModelIntegrityError,
    resolve_trusted_artifact,
    stream_sha256,
    verify_trusted_artifact,
)


def test_locked_model_and_preprocessing_contract_is_exact():
    assert DETECTOR_NAME == "yolo_fdi_seg_v1-3"
    assert DETECTOR_SHA256 == "29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b"
    assert DETECTOR_CONFIDENCE_THRESHOLD == 0.35
    assert DETECTOR_IOU_THRESHOLD == 0.50
    assert DETECTOR_EXPLICIT_IMAGE_SIZE is None
    assert FDI_MAP_SHA256 == "72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec"
    assert FDI_TOOTH_IDS == (
        "11", "12", "13", "14", "15", "16", "17", "18",
        "21", "22", "23", "24", "25", "26", "27", "28",
        "31", "32", "33", "34", "35", "36", "37", "38",
        "41", "42", "43", "44", "45", "46", "47", "48",
    )

    assert CLASSIFIER_ARCHITECTURE == "EfficientNetV2-S"
    assert CLASSIFIER_EXPERIMENT == 1
    assert CLASSIFIER_CHECKPOINT_EPOCH == 12
    assert CLASSIFIER_SHA256 == "aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a"
    assert DISEASE_CLASSES == ("Any Caries", "Deep Caries", "Impacted", "Periapical Lesion")
    assert dict(THRESHOLDS) == {
        "Any Caries": 0.44,
        "Deep Caries": 0.50,
        "Impacted": 0.50,
        "Periapical Lesion": 0.50,
    }
    assert ANY_CARIES_REVIEW_MIN == 0.30
    assert MODEL_SCORE_SEMANTICS == "UNCALIBRATED_MODEL_SCORE"

    assert CROP_SOURCE == "detector_bounding_box"
    assert CROP_PADDING_RATIO == 0.02
    assert INPUT_COLOR == "RGB"
    assert INPUT_GEOMETRY == "black_square_letterbox_then_resize"
    assert CLASSIFIER_IMAGE_SIZE == (384, 384)
    assert NORMALIZATION_MEAN == (0.485, 0.456, 0.406)
    assert NORMALIZATION_STD == (0.229, 0.224, 0.225)
    assert CLASSIFIER_ACTIVATION == "sigmoid"
    assert DUPLICATE_FDI_POLICY == "retain_highest_detector_confidence"
    assert PIPELINE_VERSION == "dentex-yolo_fdi_seg_v1-3__exp1-e12__thr-044-050-050-050"


def test_locked_overlay_contract_is_bbox_only_rgb_png():
    assert OVERLAY_GEOMETRY == "bounding_box_outline"
    assert OVERLAY_BOX_FILL is False
    assert OVERLAY_DRAW_NORMAL_TEETH is False
    assert OVERLAY_UPPER_JAW_LABEL_POSITION == "above"
    assert OVERLAY_LOWER_JAW_LABEL_POSITION == "below"
    assert OVERLAY_OUTPUT == "RGB_ANNOTATED_FULL_IMAGE_PNG"


def test_integrity_helpers_stream_hash_and_verify_file_under_trusted_root(tmp_path):
    trusted_root = tmp_path / "models"
    trusted_root.mkdir()
    artifact = trusted_root / "tiny.bin"
    artifact.write_bytes(b"tiny model fixture")
    expected = hashlib.sha256(b"tiny model fixture").hexdigest()

    assert stream_sha256(artifact, chunk_size=3) == expected
    assert resolve_trusted_artifact(trusted_root=trusted_root, configured_path="tiny.bin") == artifact.resolve()
    assert verify_trusted_artifact(
        trusted_root=trusted_root,
        configured_path=artifact,
        expected_sha256=expected,
    ) == artifact.resolve()


def test_integrity_helpers_reject_escape_hash_mismatch_and_non_files(tmp_path):
    trusted_root = tmp_path / "models"
    trusted_root.mkdir()
    artifact = trusted_root / "tiny.bin"
    artifact.write_bytes(b"fixture")
    outside = tmp_path / "outside.bin"
    outside.write_bytes(b"outside")

    with pytest.raises(ModelIntegrityError):
        resolve_trusted_artifact(trusted_root=trusted_root, configured_path=outside)
    with pytest.raises(ModelIntegrityError):
        verify_trusted_artifact(
            trusted_root=trusted_root,
            configured_path=artifact,
            expected_sha256="0" * 64,
        )
    with pytest.raises(ModelIntegrityError):
        stream_sha256(trusted_root)
