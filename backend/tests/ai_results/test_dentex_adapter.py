import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from apps.ai_results import services
from apps.ai_results.adapters import dentex
from apps.ai_results.adapters.base import InferenceConfigurationError, InferenceImageInvalidError
from apps.ai_results.adapters.dentex import (
    DentexConfig,
    DentexInferenceAdapter,
    ModelBundle,
    RawDetection,
    RuntimeModules,
    crop_with_bbox,
    filter_duplicate_fdi_detections,
    load_model_bundle,
    normalize_detector_result,
    normalize_detector_names,
    reset_dentex_caches,
    square_padding,
    tooth_scores_from_model_output,
    validate_classifier_checkpoint_metadata,
    validate_detector_names,
    validate_fdi_class_map,
    validate_runtime_device,
)
from apps.ai_results.model_contract import DISEASE_CLASSES, FDI_TOOTH_IDS, PIPELINE_VERSION
from apps.ai_results.result_types import ImageInput, PipelineResult, ToothScores
from apps.clinic.models import ClinicSettings


class FakeArray(list):
    def cpu(self):
        return self

    def numpy(self):
        return self

    def reshape(self, *_args):
        return self

    def astype(self, *_args):
        return self


class FakeScalar:
    def __init__(self, value):
        self.value = value

    def item(self):
        return self.value


class FakeBox:
    def __init__(self, class_id, confidence, bbox):
        self.cls = FakeScalar(class_id)
        self.conf = FakeScalar(confidence)
        self.xyxy = FakeArray(bbox)


class FakeCrop:
    size = 1

    def copy(self):
        return self


class FakeImageArray:
    shape = (100, 200, 3)

    def __init__(self):
        self.last_slice = None

    def __getitem__(self, key):
        self.last_slice = key
        return FakeCrop()

    def copy(self):
        return self


def valid_fdi_map():
    return {
        "fdi_tooth_id_to_class_id": {fdi: index for index, fdi in enumerate(FDI_TOOTH_IDS)},
        "class_id_to_fdi_tooth_id": {str(index): fdi for index, fdi in enumerate(FDI_TOOTH_IDS)},
        "class_names": list(FDI_TOOTH_IDS),
    }


def valid_checkpoint_metadata():
    return {
        "model_state_dict": {"fixture": "state"},
        "model_name": "efficientnet_v2_s",
        "label_names": list(DISEASE_CLASSES),
        "image_size": 384,
        "crop_padding_ratio": 0.02,
        "input_geometry": "black_square_letterbox_then_resize",
        "operating_thresholds": {
            "Any Caries": 0.44,
            "Deep Caries": 0.50,
            "Impacted": 0.50,
            "Periapical Lesion": 0.50,
        },
        "best_epoch": 12,
        "normalization_mean": [0.485, 0.456, 0.406],
        "normalization_std": [0.229, 0.224, 0.225],
        "classifier_head": {"dropout": 0.25},
    }


def config(max_concurrent=1):
    return DentexConfig(
        model_root="trusted",
        detector_path="detector.pt",
        classifier_path="classifier.pt",
        fdi_map_path="map.json",
        device="cpu",
        max_concurrent_inferences=max_concurrent,
    )


def test_dentex_configuration_parsing_uses_operator_settings(settings):
    settings.PEARLIX_AI_MODEL_ROOT = "trusted-root"
    settings.PEARLIX_AI_DETECTOR_PATH = "weights/detector.pt"
    settings.PEARLIX_AI_CLASSIFIER_PATH = "weights/classifier.pt"
    settings.PEARLIX_AI_FDI_MAP_PATH = "contract/map.json"
    settings.PEARLIX_AI_DEVICE = "CPU"
    settings.PEARLIX_AI_MAX_CONCURRENT_INFERENCES = 2

    parsed = DentexConfig.from_settings()

    assert parsed.device == "cpu"
    assert parsed.max_concurrent_inferences == 2
    assert parsed.detector_path == "weights/detector.pt"


def test_dentex_configuration_rejects_missing_paths_cuda_fallback_and_bad_concurrency(settings):
    settings.PEARLIX_AI_MODEL_ROOT = ""
    with pytest.raises(InferenceConfigurationError):
        DentexConfig.from_settings()

    settings.PEARLIX_AI_MODEL_ROOT = "trusted"
    settings.PEARLIX_AI_DETECTOR_PATH = "detector"
    settings.PEARLIX_AI_CLASSIFIER_PATH = "classifier"
    settings.PEARLIX_AI_FDI_MAP_PATH = "map"
    settings.PEARLIX_AI_DEVICE = "auto"
    with pytest.raises(InferenceConfigurationError):
        DentexConfig.from_settings()

    settings.PEARLIX_AI_DEVICE = "cpu"
    settings.PEARLIX_AI_MAX_CONCURRENT_INFERENCES = 0
    with pytest.raises(InferenceConfigurationError):
        DentexConfig.from_settings()


def test_fdi_map_and_detector_names_require_exact_locked_order():
    assert validate_fdi_class_map(valid_fdi_map())["class_names"] == list(FDI_TOOTH_IDS)
    assert normalize_detector_names({str(index): fdi for index, fdi in enumerate(FDI_TOOTH_IDS)}) == list(
        FDI_TOOTH_IDS
    )
    validate_detector_names(list(FDI_TOOTH_IDS), FDI_TOOTH_IDS)

    invalid = valid_fdi_map()
    invalid["class_names"] = list(reversed(FDI_TOOTH_IDS))
    with pytest.raises(InferenceConfigurationError):
        validate_fdi_class_map(invalid)
    with pytest.raises(InferenceConfigurationError):
        validate_detector_names(list(reversed(FDI_TOOTH_IDS)), FDI_TOOTH_IDS)


def test_detector_normalization_decodes_fdi_and_skips_missing_mapping():
    result = SimpleNamespace(
        boxes=[
            FakeBox(21, 0.81, [10, 20, 30, 40]),
            FakeBox(999, 0.99, [1, 2, 3, 4]),
        ]
    )

    detections = normalize_detector_result(result, valid_fdi_map()["class_id_to_fdi_tooth_id"])

    assert detections == [RawDetection(0, "36", 0.81, (10.0, 20.0, 30.0, 40.0))]


def test_duplicate_fdi_filter_keeps_highest_confidence_in_retained_detector_order():
    detections = [
        RawDetection(0, "36", 0.4, (1, 1, 2, 2)),
        RawDetection(1, "11", 0.8, (2, 2, 3, 3)),
        RawDetection(2, "36", 0.9, (3, 3, 4, 4)),
        RawDetection(3, "12", 0.7, (4, 4, 5, 5)),
    ]

    retained, removed = filter_duplicate_fdi_detections(detections)

    assert [item.detector_index for item in retained] == [1, 2, 3]
    assert [item.fdi_tooth_id for item in retained] == ["11", "36", "12"]
    assert removed == 1


def test_bbox_crop_uses_exact_floor_ceil_padding_and_clipping():
    image = FakeImageArray()

    crop = crop_with_bbox(image, (10.2, 20.2, 30.2, 40.2))

    assert crop.size == 1
    assert image.last_slice == (slice(19, 41), slice(9, 31))

    crop_with_bbox(image, (1.0, 1.0, 199.0, 99.0))
    assert image.last_slice == (slice(0, 100), slice(0, 200))


def test_black_square_padding_geometry_matches_notebook():
    assert square_padding(100, 200) == (50, 0, 50, 0)
    assert square_padding(201, 100) == (0, 50, 0, 51)
    assert square_padding(384, 384) == (0, 0, 0, 0)


def test_classifier_checkpoint_metadata_is_exact_and_dropout_defaults_to_point_three():
    checkpoint = valid_checkpoint_metadata()
    assert validate_classifier_checkpoint_metadata(checkpoint) == 0.25

    del checkpoint["classifier_head"]
    assert validate_classifier_checkpoint_metadata(checkpoint) == 0.3

    checkpoint["best_epoch"] = 11
    with pytest.raises(InferenceConfigurationError):
        validate_classifier_checkpoint_metadata(checkpoint)


def test_classifier_output_maps_to_exact_locked_class_order():
    scores = tooth_scores_from_model_output([0.1, 0.2, 0.3, 0.4])

    assert list(scores.to_json()) == list(DISEASE_CLASSES)
    assert scores.to_json() == {
        "Any Caries": 0.1,
        "Deep Caries": 0.2,
        "Impacted": 0.3,
        "Periapical Lesion": 0.4,
    }


def test_cuda_request_never_silently_falls_back_to_cpu():
    unavailable = SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: False))
    available = SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: True))

    with pytest.raises(InferenceConfigurationError):
        validate_runtime_device("cuda", unavailable)
    validate_runtime_device("cuda", available)
    validate_runtime_device("cpu", unavailable)


def test_model_bundle_cache_loads_once_and_can_be_reset(monkeypatch):
    reset_dentex_caches()
    calls = []
    sentinel = object()

    def fake_load(parsed_config):
        calls.append(parsed_config)
        return sentinel

    monkeypatch.setattr("apps.ai_results.adapters.dentex._load_model_bundle_uncached", fake_load)
    try:
        assert load_model_bundle(config()) is sentinel
        assert load_model_bundle(config()) is sentinel
        assert len(calls) == 1
    finally:
        reset_dentex_caches()


def test_mock_adapter_selection_does_not_import_or_initialize_dentex(monkeypatch):
    def forbidden_import(*_args, **_kwargs):
        raise AssertionError("Dentex must not be imported for mock selection")

    monkeypatch.setattr("builtins.__import__", forbidden_import)
    assert services.select_inference_adapter(ClinicSettings.AiMode.MOCK_ADAPTER) is services._MOCK_ADAPTER


def test_django_internal_selection_uses_lazy_dentex_factory(monkeypatch):
    sentinel = object()
    fake_module = SimpleNamespace(get_dentex_adapter=lambda: sentinel)
    monkeypatch.setitem(sys.modules, "apps.ai_results.adapters.dentex", fake_module)

    assert services.select_inference_adapter(ClinicSettings.AiMode.DJANGO_INTERNAL) is sentinel


def test_inference_guard_bounds_simultaneous_model_execution(monkeypatch):
    adapter = DentexInferenceAdapter(config(max_concurrent=1))
    lock = threading.Lock()
    active = 0
    maximum_active = 0
    result = PipelineResult(result_summary="done", model_version=PIPELINE_VERSION)

    def fake_analyze(_image, *, suffix):
        nonlocal active, maximum_active
        assert suffix == ".png"
        with lock:
            active += 1
            maximum_active = max(maximum_active, active)
        time.sleep(0.02)
        with lock:
            active -= 1
        return result

    monkeypatch.setattr(adapter, "_analyze_guarded", fake_analyze)
    image = ImageInput(content=b"image", content_type="image/png")
    threads = [threading.Thread(target=adapter.analyze, args=(image,)) for _ in range(3)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert maximum_active == 1


def test_invalid_content_type_maps_to_adapter_image_error():
    adapter = DentexInferenceAdapter(config())

    with pytest.raises(InferenceImageInvalidError):
        adapter.analyze(ImageInput(content=b"image", content_type="image/gif"))


def test_full_adapter_uses_exact_detector_call_and_removes_temporary_input(monkeypatch):
    image_array = FakeImageArray()

    class FakeCV2:
        IMREAD_COLOR = 1
        COLOR_BGR2RGB = 2

        def imread(self, path, mode):
            assert mode == self.IMREAD_COLOR
            assert Path(path).is_file()
            return image_array

        def cvtColor(self, image, conversion):
            assert conversion == self.COLOR_BGR2RGB
            return image

    class FakeDetector:
        def __init__(self):
            self.calls = []

        def predict(self, **kwargs):
            self.calls.append(kwargs)
            return [SimpleNamespace(boxes=[FakeBox(21, 0.81, [10, 20, 30, 40])])]

    detector = FakeDetector()
    runtime = RuntimeModules(
        torch=None,
        torchvision=None,
        models=None,
        transforms=None,
        nn=None,
        numpy=None,
        cv2=FakeCV2(),
        image_module=None,
        image_ops=None,
        yolo_class=None,
        package_versions={"torch": "2.11.0+cpu", "torchvision": "0.26.0+cpu", "ultralytics": "8.4.48"},
    )
    bundle = ModelBundle(
        detector=detector,
        classifier=None,
        classifier_transform=None,
        class_id_to_fdi=valid_fdi_map()["class_id_to_fdi_tooth_id"],
        runtime=runtime,
        device="cpu",
        detector_load_seconds=1.0,
        classifier_load_seconds=2.0,
        bundle_load_seconds=3.0,
    )
    monkeypatch.setattr(dentex, "load_model_bundle", lambda _config: bundle)
    monkeypatch.setattr(dentex, "score_crop", lambda _crop, _bundle: ToothScores((0.44, 0.0, 0.0, 0.0)))
    monkeypatch.setattr(
        dentex,
        "render_overlay_png",
        lambda _image, _teeth, *, cv2_module: b"\x89PNG\r\n\x1a\nfixture",
    )

    result = DentexInferenceAdapter(config()).analyze(ImageInput(content=b"encoded", content_type="image/png"))

    assert result.model_version == PIPELINE_VERSION
    assert len(result.teeth) == 1
    assert result.teeth[0].tooth.fdi_tooth_id == "36"
    assert len(detector.calls) == 1
    call = detector.calls[0]
    assert set(call) == {"source", "conf", "iou", "verbose"}
    assert call["conf"] == 0.35
    assert call["iou"] == 0.50
    assert call["verbose"] is False
    assert not Path(call["source"]).exists()
