import pytest

from apps.ai_results.adapters.base import InferenceConfigurationError, InferenceRuntimeError
from apps.ai_results.adapters.remote import (
    REMOTE_CONTRACT_VERSION,
    RemoteInferenceConfig,
    pipeline_result_from_remote,
)
from apps.ai_results.model_contract import PIPELINE_VERSION
from apps.ai_results.result_types import FindingDecision


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
