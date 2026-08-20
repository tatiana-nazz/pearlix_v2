from __future__ import annotations

from apps.ai_results.result_types import DisplayFinding, FindingDecision, ImageInput, PipelineResult


MOCK_MODEL_VERSION = "pearlix-mock-xray-v1"
MOCK_SCORE_SEMANTICS = "DETERMINISTIC_MOCK_SCORE"
MOCK_ADAPTER_NAME = "mock"


class MockInferenceAdapter:
    model_version = MOCK_MODEL_VERSION

    def analyze(self, image: ImageInput) -> PipelineResult:
        if not isinstance(image, ImageInput):
            raise TypeError("MockInferenceAdapter requires ImageInput.")
        return PipelineResult(
            result_summary="Research-only AI analysis completed.",
            overall_confidence=0.74,
            model_version=self.model_version,
            score_semantics=MOCK_SCORE_SEMANTICS,
            pipeline_metadata={"adapter": MOCK_ADAPTER_NAME},
            display_findings=(
                DisplayFinding(
                    fdi_tooth_id="36",
                    disease_label="Caries",
                    model_score=0.82,
                    threshold=None,
                    decision=FindingDecision.FLAGGED,
                    is_positive=True,
                    detector_confidence=None,
                ),
            ),
        )
