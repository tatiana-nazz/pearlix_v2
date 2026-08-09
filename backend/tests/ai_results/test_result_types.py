import pytest

from apps.ai_results.model_contract import DISEASE_CLASSES, FINDINGS_SCHEMA_VERSION, PIPELINE_VERSION
from apps.ai_results.models import AIResult
from apps.ai_results.result_types import (
    DetectedTooth,
    FindingDecision,
    PipelineResult,
    ToothScores,
    apply_locked_policy,
)
from apps.ai_results.serializers import AIResultSerializer


def make_tooth():
    return DetectedTooth(fdi_tooth_id="36", detector_confidence=0.91, bbox_xyxy=(10, 20, 100, 120))


def decide(any_caries, deep=0.0, impacted=0.0, lesion=0.0):
    return apply_locked_policy(make_tooth(), ToothScores((any_caries, deep, impacted, lesion)))


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (0.0, FindingDecision.NOT_FLAGGED),
        (0.299999, FindingDecision.NOT_FLAGGED),
        (0.30, FindingDecision.REVIEW),
        (0.439999, FindingDecision.REVIEW),
        (0.44, FindingDecision.FLAGGED),
        (1.0, FindingDecision.FLAGGED),
    ],
)
def test_any_caries_threshold_and_review_boundaries(score, expected):
    decision = decide(score).decisions[0]

    assert decision.decision == expected
    assert decision.is_positive is (expected == FindingDecision.FLAGGED)


def test_threshold_equality_is_positive_for_every_class():
    result = decide(0.44, deep=0.50, impacted=0.50, lesion=0.50)

    assert [item.disease_label for item in result.decisions] == list(DISEASE_CLASSES)
    assert all(item.decision == FindingDecision.FLAGGED for item in result.decisions)
    assert all(item.is_positive for item in result.decisions)


def test_deep_caries_forces_any_caries_positive_and_records_hierarchy():
    result = decide(0.10, deep=0.50)
    any_caries, deep_caries = result.decisions[:2]

    assert any_caries.decision == FindingDecision.FLAGGED
    assert any_caries.is_positive is True
    assert any_caries.hierarchy_forced is True
    assert deep_caries.decision == FindingDecision.FLAGGED
    assert result.hierarchy_forced_any_caries is True


def test_multiple_diseases_per_tooth_and_review_are_public_display_findings():
    positive = decide(0.60, impacted=0.70, lesion=0.80)
    review = decide(0.30)

    positive_findings = PipelineResult.for_locked_pipeline(teeth=(positive,)).simplified_findings()
    review_findings = PipelineResult.for_locked_pipeline(teeth=(review,)).simplified_findings()

    assert [item.disease_label for item in positive_findings] == [
        "Any Caries",
        "Impacted",
        "Periapical Lesion",
    ]
    assert review_findings[0].decision == FindingDecision.REVIEW
    assert review_findings[0].is_positive is False


def test_normal_negative_tooth_does_not_clutter_display_findings():
    result = PipelineResult.for_locked_pipeline(teeth=(decide(0.1),))

    assert result.simplified_findings() == ()


def test_versioned_findings_json_is_json_safe_and_uses_model_score_terminology():
    envelope = PipelineResult.for_locked_pipeline(teeth=(decide(0.44),)).to_findings_json()
    finding = envelope["display_findings"][0]

    assert envelope["schema_version"] == FINDINGS_SCHEMA_VERSION
    assert envelope["pipeline"]["model_version"] == PIPELINE_VERSION
    assert envelope["pipeline"]["score_semantics"] == "UNCALIBRATED_MODEL_SCORE"
    assert envelope["teeth"][0]["model_scores"]["Any Caries"] == 0.44
    assert finding["model_score"] == 0.44
    assert "probability" not in finding
    assert finding["confidence_score"] == finding["model_score"]


def test_serializer_keeps_legacy_list_and_extracts_envelope_display_findings():
    legacy = [{"fdi_tooth_id": "36", "disease_label": "Caries", "confidence_score": 0.82}]
    envelope = PipelineResult.for_locked_pipeline(teeth=(decide(0.30),)).to_findings_json()

    legacy_result = AIResult(findings_json=legacy)
    envelope_result = AIResult(findings_json=envelope)

    assert AIResultSerializer(legacy_result).data["findings"] == legacy
    assert AIResultSerializer(envelope_result).data["findings"] == envelope["display_findings"]


def test_result_types_reject_invalid_fdi_scores_and_nonfinite_values():
    with pytest.raises(ValueError):
        DetectedTooth(fdi_tooth_id="99", detector_confidence=0.9, bbox_xyxy=(0, 0, 1, 1))
    with pytest.raises(ValueError):
        ToothScores.from_mapping({"Any Caries": 0.1})
    with pytest.raises(ValueError):
        ToothScores((float("nan"), 0.0, 0.0, 0.0))
