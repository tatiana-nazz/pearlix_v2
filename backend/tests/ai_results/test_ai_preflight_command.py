import hashlib
from io import StringIO
from types import SimpleNamespace

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.ai_results.adapters.base import InferenceConfigurationError
from apps.ai_results.management.commands import ai_preflight


def _digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _runtime(*, versions=None, cuda_available=False):
    return SimpleNamespace(
        torch=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: cuda_available)),
        package_versions=versions or {
            "torch": "2.11.0+cpu",
            "torchvision": "0.26.0+cpu",
            "ultralytics": "8.4.48",
            "numpy": "2.5.1",
            "pillow": "12.3.0",
            "opencv": "5.0.0",
        },
    )


def _configure_valid_bundle(settings, monkeypatch, tmp_path):
    root = tmp_path / "locked"
    weights = root / "weights"
    contract = root / "contract"
    weights.mkdir(parents=True)
    contract.mkdir()
    artifacts = {
        "detector": weights / "detector.pt",
        "classifier": weights / "classifier.pt",
        "fdi_map": contract / "fdi.json",
    }
    contents = {
        "detector": b"detector-fixture",
        "classifier": b"classifier-fixture",
        "fdi_map": b'{"fixture": true}',
    }
    for name, path in artifacts.items():
        path.write_bytes(contents[name])

    settings.PEARLIX_AI_MODEL_ROOT = str(root)
    settings.PEARLIX_AI_DETECTOR_PATH = "weights/detector.pt"
    settings.PEARLIX_AI_CLASSIFIER_PATH = "weights/classifier.pt"
    settings.PEARLIX_AI_FDI_MAP_PATH = "contract/fdi.json"
    settings.PEARLIX_AI_DEVICE = "cpu"
    settings.PEARLIX_AI_MAX_CONCURRENT_INFERENCES = 1
    monkeypatch.setattr(ai_preflight, "DETECTOR_SHA256", _digest(contents["detector"]))
    monkeypatch.setattr(ai_preflight, "CLASSIFIER_SHA256", _digest(contents["classifier"]))
    monkeypatch.setattr(ai_preflight, "FDI_MAP_SHA256", _digest(contents["fdi_map"]))
    monkeypatch.setattr(ai_preflight, "_import_runtime", _runtime)
    return root, artifacts


def test_lightweight_preflight_verifies_artifacts_runtime_and_skips_model_deserialization(
    settings,
    monkeypatch,
    tmp_path,
):
    _configure_valid_bundle(settings, monkeypatch, tmp_path)
    monkeypatch.setattr(
        ai_preflight,
        "load_model_bundle",
        lambda _config: pytest.fail("The lightweight preflight must not load models."),
    )
    output = StringIO()

    call_command("ai_preflight", stdout=output)

    text = output.getvalue()
    assert "AI preflight PASS" in text
    assert "model_load: SKIPPED" in text
    assert "torch: 2.11.0+cpu" in text


def test_preflight_rejects_missing_model_root(settings):
    settings.PEARLIX_AI_MODEL_ROOT = ""

    with pytest.raises(CommandError, match="AI preflight FAIL"):
        call_command("ai_preflight")


def test_preflight_rejects_missing_artifact(settings, monkeypatch, tmp_path):
    root, artifacts = _configure_valid_bundle(settings, monkeypatch, tmp_path)
    artifacts["detector"].unlink()

    with pytest.raises(CommandError, match="AI preflight FAIL"):
        call_command("ai_preflight")
    assert root.is_dir()


def test_preflight_rejects_hash_mismatch(settings, monkeypatch, tmp_path):
    _configure_valid_bundle(settings, monkeypatch, tmp_path)
    monkeypatch.setattr(ai_preflight, "DETECTOR_SHA256", "0" * 64)

    with pytest.raises(CommandError, match="failed SHA-256 verification"):
        call_command("ai_preflight")


def test_preflight_rejects_artifact_outside_trusted_root(settings, monkeypatch, tmp_path):
    _root, _artifacts = _configure_valid_bundle(settings, monkeypatch, tmp_path)
    outside = tmp_path / "outside.pt"
    outside.write_bytes(b"outside")
    settings.PEARLIX_AI_DETECTOR_PATH = str(outside)
    monkeypatch.setattr(ai_preflight, "DETECTOR_SHA256", _digest(b"outside"))

    with pytest.raises(CommandError, match="outside the trusted root"):
        call_command("ai_preflight")


def test_preflight_rejects_invalid_device(settings, monkeypatch, tmp_path):
    _configure_valid_bundle(settings, monkeypatch, tmp_path)
    settings.PEARLIX_AI_DEVICE = "auto"

    with pytest.raises(CommandError, match="configured AI device is unsupported"):
        call_command("ai_preflight")


def test_preflight_rejects_dependency_or_locked_version_mismatch(settings, monkeypatch, tmp_path):
    _configure_valid_bundle(settings, monkeypatch, tmp_path)
    monkeypatch.setattr(
        ai_preflight,
        "_import_runtime",
        lambda: (_ for _ in ()).throw(
            InferenceConfigurationError("The installed Torch version differs from the locked runtime.")
        ),
    )

    with pytest.raises(CommandError, match="Torch version differs"):
        call_command("ai_preflight")


def test_load_models_delegates_to_trusted_loader(settings, monkeypatch, tmp_path):
    _configure_valid_bundle(settings, monkeypatch, tmp_path)
    loaded = []
    runtime = _runtime()

    def fake_loader(config):
        loaded.append(config)
        return SimpleNamespace(runtime=runtime, bundle_load_seconds=1.234)

    monkeypatch.setattr(ai_preflight, "load_model_bundle", fake_loader)
    output = StringIO()

    call_command("ai_preflight", "--load-models", stdout=output)

    assert len(loaded) == 1
    assert loaded[0].device == "cpu"
    assert "model_load: PASS" in output.getvalue()
    assert "load_duration_seconds: 1.234" in output.getvalue()
