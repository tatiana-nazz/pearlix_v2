import pytest
import sys
from types import SimpleNamespace
from concurrent.futures import TimeoutError as FutureTimeoutError
from io import BytesIO
from pathlib import Path
from PIL import Image

from apps.ai_results.adapters.base import InferenceConfigurationError, InferenceRuntimeError
from apps.ai_results.adapters.remote import (
    REMOTE_CONTRACT_VERSION,
    RemoteInferenceConfig,
    RemoteInferenceAdapter,
    _load_remote_payload,
    _read_overlay_bytes,
    pipeline_result_from_remote,
)
from apps.ai_results.model_contract import PIPELINE_VERSION
from apps.ai_results.result_types import FindingDecision
from apps.ai_results.result_types import ImageInput


def remote_payload(*, any_caries=0.20, deep_caries=0.60):
    return {
        "contract_version": REMOTE_CONTRACT_VERSION,
        "model_version": PIPELINE_VERSION,
        "teeth": [
            {
                "fdi_tooth_id": "36",
                "detector_confidence": 0.91,
                "bbox_xyxy": [10, 20, 110, 160],
                "model_scores": {
                    "Any Caries": any_caries,
                    "Deep Caries": deep_caries,
                    "Impacted": 0.10,
                    "Periapical Lesion": 0.20,
                },
            }
        ],
        "runtime": {"remote_wall_seconds": 3.2},
    }


def test_remote_payload_reapplies_locked_hierarchy_locally():
    result = pipeline_result_from_remote(remote_payload(), None)

    tooth = result.teeth[0]
    any_decision, deep_decision = tooth.decisions[:2]
    assert any_decision.decision == FindingDecision.FLAGGED
    assert any_decision.hierarchy_forced is True
    assert deep_decision.decision == FindingDecision.FLAGGED
    assert result.pipeline_metadata["remote_service"]["contract_version"] == REMOTE_CONTRACT_VERSION


def test_remote_payload_reapplies_any_caries_review_band_locally():
    result = pipeline_result_from_remote(remote_payload(any_caries=0.35, deep_caries=0.10), None)

    assert result.teeth[0].decisions[0].decision == FindingDecision.REVIEW
    assert result.teeth[0].decisions[0].is_positive is False


def test_remote_payload_rejects_wrong_model_version():
    payload = remote_payload()
    payload["model_version"] = "unexpected"

    with pytest.raises(InferenceRuntimeError):
        pipeline_result_from_remote(payload, None)


def test_remote_config_accepts_private_hf_space_id(settings):
    settings.AI_SERVICE_URL = "example-user/pearlix-dentex-ai"
    settings.AI_SERVICE_TOKEN = "hf_read_only_demo_token"

    config = RemoteInferenceConfig.from_settings()

    assert config.service_url == "example-user/pearlix-dentex-ai"
    assert config.hf_token == "hf_read_only_demo_token"
    assert config.api_name == "/analyze"


def test_remote_config_fails_closed_when_incomplete(settings):
    settings.AI_SERVICE_URL = ""
    settings.AI_SERVICE_TOKEN = ""

    with pytest.raises(InferenceConfigurationError):
        RemoteInferenceConfig.from_settings()


def test_remote_payload_enforces_json_and_tooth_row_bounds(monkeypatch):
    import apps.ai_results.adapters.remote as remote

    monkeypatch.setattr(remote, "MAX_REMOTE_JSON_BYTES", 32)
    with pytest.raises(InferenceRuntimeError, match="size limit"):
        _load_remote_payload('{"value":"' + ("x" * 40) + '"}')
    payload = remote_payload()
    payload["teeth"] = payload["teeth"] * 33
    with pytest.raises(InferenceRuntimeError, match="too many"):
        pipeline_result_from_remote(payload, None)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -0.1, 1.1])
def test_remote_payload_rejects_non_finite_or_out_of_range_scores(value):
    payload = remote_payload()
    payload["teeth"][0]["model_scores"]["Any Caries"] = value
    with pytest.raises(InferenceRuntimeError):
        pipeline_result_from_remote(payload, None)


def test_remote_overlay_is_decoded_bounded_and_temp_file_removed(tmp_path, monkeypatch):
    import apps.ai_results.adapters.remote as remote

    buffer = BytesIO()
    Image.new("L", (32, 16), 100).save(buffer, format="PNG")
    overlay = tmp_path / "overlay.png"
    overlay.write_bytes(buffer.getvalue())
    assert _read_overlay_bytes(str(overlay)).startswith(b"\x89PNG")
    assert not overlay.exists()

    malformed = tmp_path / "bad.png"
    malformed.write_bytes(b"not-png")
    with pytest.raises(InferenceRuntimeError):
        _read_overlay_bytes(str(malformed))
    assert not malformed.exists()

    monkeypatch.setattr(remote, "MAX_REMOTE_OVERLAY_BYTES", 4)
    oversized = tmp_path / "large.png"
    oversized.write_bytes(b"12345")
    with pytest.raises(InferenceRuntimeError, match="size limit"):
        _read_overlay_bytes(str(oversized))
    assert not oversized.exists()


@pytest.mark.parametrize("url", ["http://example.com", "https://127.0.0.1", "https://169.254.169.254/latest", "user:pass@example/space"])
def test_remote_config_rejects_unsafe_endpoint_references(settings, url):
    settings.AI_SERVICE_URL = url
    settings.AI_SERVICE_TOKEN = "secret"
    with pytest.raises(InferenceConfigurationError):
        RemoteInferenceConfig.from_settings()


def test_remote_adapter_applies_transport_timeouts_and_accepts_valid_response(monkeypatch):
    observed = {}

    class Client:
        def __init__(self, *_args, **kwargs):
            observed.update(kwargs)

        def predict(self, **_kwargs):
            return remote_payload(), None

    monkeypatch.setitem(sys.modules, "gradio_client", SimpleNamespace(Client=Client, handle_file=lambda value: value))
    monkeypatch.setitem(sys.modules, "httpx", SimpleNamespace(Timeout=lambda default, **kwargs: SimpleNamespace(read=default, **kwargs)))
    adapter = RemoteInferenceAdapter(RemoteInferenceConfig("owner/space", "secret"))
    result = adapter.analyze(ImageInput(content=b"valid-input", content_type="image/png"))
    assert result.model_version == PIPELINE_VERSION
    timeout = observed["httpx_kwargs"]["timeout"]
    assert (timeout.connect, timeout.read, timeout.write, timeout.pool) == (10, 120, 10, 10)


def test_remote_adapter_timeout_fails_closed(monkeypatch):
    class Client:
        def __init__(self, *_args, **_kwargs):
            pass

        def predict(self, **_kwargs):
            raise FutureTimeoutError

    monkeypatch.setitem(sys.modules, "gradio_client", SimpleNamespace(Client=Client, handle_file=lambda value: value))
    monkeypatch.setitem(sys.modules, "httpx", SimpleNamespace(Timeout=lambda default, **kwargs: SimpleNamespace(read=default, **kwargs)))
    adapter = RemoteInferenceAdapter(RemoteInferenceConfig("owner/space", "secret"))
    with pytest.raises(InferenceRuntimeError, match="timed out"):
        adapter.analyze(ImageInput(content=b"valid-input", content_type="image/png"))
