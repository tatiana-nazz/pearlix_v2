import base64
import json
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
    _decode_overlay_base64,
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


def test_remote_payload_rejects_duplicate_tooth_rows_as_controlled_failure():
    payload = remote_payload()
    payload["teeth"] = payload["teeth"] * 2

    with pytest.raises(InferenceRuntimeError, match="locked result contract"):
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


def test_remote_base64_overlay_uses_full_image_validation(monkeypatch):
    import apps.ai_results.adapters.remote as remote

    buffer = BytesIO()
    Image.new("L", (32, 16), 100).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    assert _decode_overlay_base64(encoded).startswith(b"\x89PNG")

    malformed = base64.b64encode(b"\x89PNG\r\n\x1a\nnot-an-image").decode("ascii")
    with pytest.raises(InferenceRuntimeError, match="overlay is invalid"):
        _decode_overlay_base64(malformed)

    monkeypatch.setattr(remote, "MAX_REMOTE_OVERLAY_BASE64_BYTES", 4)
    with pytest.raises(InferenceRuntimeError, match="size limit"):
        _decode_overlay_base64(encoded)


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


def test_https_adapter_preserves_bearer_transport_and_release_bounds(monkeypatch):
    observed = {}
    response_body = json.dumps({"payload": remote_payload(), "overlay_png_base64": None}).encode("utf-8")

    class Response:
        status_code = 200
        headers = {"content-length": str(len(response_body))}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def iter_bytes(self):
            yield response_body[:20]
            yield response_body[20:]

    class Client:
        def __init__(self, **kwargs):
            observed["client"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def stream(self, method, url, **kwargs):
            observed["request"] = {"method": method, "url": url, **kwargs}
            return Response()

    monkeypatch.setitem(
        sys.modules,
        "httpx",
        SimpleNamespace(
            Client=Client,
            Timeout=lambda default, **kwargs: SimpleNamespace(read=default, **kwargs),
        ),
    )
    adapter = RemoteInferenceAdapter(RemoteInferenceConfig("https://ai.example.test", "server-secret"))

    result = adapter.analyze(ImageInput(content=b"valid-input", content_type="image/png"))

    assert result.pipeline_metadata["remote_service"]["transport"] == "https-json"
    assert observed["client"]["follow_redirects"] is False
    assert observed["client"]["trust_env"] is False
    timeout = observed["client"]["timeout"]
    assert (timeout.connect, timeout.read, timeout.write, timeout.pool) == (10, 120, 10, 10)
    assert observed["request"]["method"] == "POST"
    assert observed["request"]["url"] == "https://ai.example.test/analyze"
    assert observed["request"]["headers"] == {"Authorization": "Bearer server-secret"}
    assert observed["request"]["files"]["image"][0] == "panoramic.png"


def test_https_adapter_rejects_redirects_and_oversized_streams(monkeypatch):
    import apps.ai_results.adapters.remote as remote

    class Response:
        headers = {}

        def __init__(self, status_code, content):
            self.status_code = status_code
            self.content = content

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def iter_bytes(self):
            yield self.content

    responses = [Response(302, b""), Response(200, b"123456789")]

    class Client:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def stream(self, *_args, **_kwargs):
            return responses.pop(0)

    monkeypatch.setitem(
        sys.modules,
        "httpx",
        SimpleNamespace(Client=Client, Timeout=lambda default, **kwargs: SimpleNamespace(read=default, **kwargs)),
    )
    monkeypatch.setattr(remote, "MAX_REMOTE_HTTPS_RESPONSE_BYTES", 8)
    adapter = RemoteInferenceAdapter(RemoteInferenceConfig("https://ai.example.test", "server-secret"))
    image = ImageInput(content=b"valid-input", content_type="image/png")

    with pytest.raises(InferenceRuntimeError, match="HTTP 302"):
        adapter.analyze(image)
    with pytest.raises(InferenceRuntimeError, match="size limit"):
        adapter.analyze(image)
