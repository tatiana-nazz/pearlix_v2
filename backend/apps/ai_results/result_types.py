from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Mapping

from apps.ai_results.model_contract import (
    ANY_CARIES_REVIEW_MIN,
    CLASS_THRESHOLDS,
    DISEASE_CLASSES,
    FDI_TOOTH_IDS,
    FINDINGS_SCHEMA_VERSION,
    MAX_IMAGE_INPUT_BYTES,
    MODEL_SCORE_SEMANTICS,
    PIPELINE_VERSION,
    THRESHOLDS,
    locked_pipeline_metadata,
)


def _unit_float(value: float, name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or not 0 <= converted <= 1:
        raise ValueError(f"{name} must be a finite number between 0 and 1.")
    return converted


class FindingDecision(str, Enum):
    NOT_FLAGGED = "not_flagged"
    REVIEW = "review"
    FLAGGED = "flagged"


@dataclass(frozen=True)
class ImageInput:
    content: bytes
    content_type: str

    def __post_init__(self):
        if not isinstance(self.content, bytes) or not self.content:
            raise ValueError("ImageInput content must be non-empty bytes.")
        if len(self.content) > MAX_IMAGE_INPUT_BYTES:
            raise ValueError("ImageInput exceeds the 10 MiB upload contract.")
        if not isinstance(self.content_type, str) or not self.content_type:
            raise ValueError("ImageInput content_type is required.")

    @property
    def size_bytes(self) -> int:
        return len(self.content)


@dataclass(frozen=True)
class DetectedTooth:
    fdi_tooth_id: str
    detector_confidence: float
    bbox_xyxy: tuple[float, float, float, float]

    def __post_init__(self):
        if self.fdi_tooth_id not in FDI_TOOTH_IDS:
            raise ValueError("Detected tooth has an invalid FDI identifier.")
        object.__setattr__(self, "detector_confidence", _unit_float(self.detector_confidence, "detector_confidence"))
        if len(self.bbox_xyxy) != 4:
            raise ValueError("bbox_xyxy must contain four coordinates.")
        coordinates = tuple(float(value) for value in self.bbox_xyxy)
        if not all(math.isfinite(value) for value in coordinates):
            raise ValueError("bbox_xyxy coordinates must be finite.")
        x1, y1, x2, y2 = coordinates
        if min(coordinates) < 0 or x2 <= x1 or y2 <= y1:
            raise ValueError("bbox_xyxy must be a non-empty non-negative box.")
        object.__setattr__(self, "bbox_xyxy", coordinates)

    def to_json(self) -> dict:
        return {
            "fdi_tooth_id": self.fdi_tooth_id,
            "detector_confidence": self.detector_confidence,
            "bbox_xyxy": list(self.bbox_xyxy),
        }


@dataclass(frozen=True)
class ToothScores:
    values: tuple[float, float, float, float]

    def __post_init__(self):
        if len(self.values) != len(DISEASE_CLASSES):
            raise ValueError("ToothScores must contain all four locked model scores.")
        object.__setattr__(
            self,
            "values",
            tuple(_unit_float(value, f"model score for {label}") for label, value in zip(DISEASE_CLASSES, self.values)),
        )

    @classmethod
    def from_mapping(cls, scores: Mapping[str, float]) -> "ToothScores":
        if set(scores) != set(DISEASE_CLASSES):
            raise ValueError("Tooth score labels must exactly match the locked class set.")
        return cls(tuple(scores[label] for label in DISEASE_CLASSES))

    def to_json(self) -> dict[str, float]:
        return dict(zip(DISEASE_CLASSES, self.values))


@dataclass(frozen=True)
class DiseaseDecision:
    disease_label: str
    model_score: float
    threshold: float
    decision: FindingDecision
    is_positive: bool
    hierarchy_forced: bool = False

    def __post_init__(self):
        if self.disease_label not in DISEASE_CLASSES:
            raise ValueError("Disease decision label is outside the locked class order.")
        object.__setattr__(self, "model_score", _unit_float(self.model_score, "model_score"))
        object.__setattr__(self, "threshold", _unit_float(self.threshold, "threshold"))
        if self.threshold != THRESHOLDS[self.disease_label]:
            raise ValueError("Disease decision threshold differs from the locked contract.")
        if self.is_positive != (self.decision == FindingDecision.FLAGGED):
            raise ValueError("Only flagged decisions are positive.")
        if self.model_score >= self.threshold and not self.is_positive:
            raise ValueError("A score at or above its locked threshold must be flagged.")
        if self.is_positive and self.model_score < self.threshold and not self.hierarchy_forced:
            raise ValueError("A below-threshold score may only be flagged by the locked hierarchy.")
        if self.decision == FindingDecision.REVIEW:
            if self.disease_label != "Any Caries" or not ANY_CARIES_REVIEW_MIN <= self.model_score < self.threshold:
                raise ValueError("Review is only valid inside the Any Caries review band.")
        if (
            self.disease_label == "Any Caries"
            and ANY_CARIES_REVIEW_MIN <= self.model_score < self.threshold
            and not self.is_positive
            and self.decision != FindingDecision.REVIEW
        ):
            raise ValueError("An Any Caries score inside the review band must be marked for review.")
        if self.hierarchy_forced and (self.disease_label != "Any Caries" or not self.is_positive):
            raise ValueError("Hierarchy forcing is only valid for positive Any Caries.")
        if self.hierarchy_forced and self.model_score >= self.threshold:
            raise ValueError("Hierarchy forcing is not needed for an independently positive Any Caries score.")

    def to_json(self) -> dict:
        return {
            "disease_label": self.disease_label,
            "model_score": self.model_score,
            "threshold": self.threshold,
            "decision": self.decision.value,
            "is_positive": self.is_positive,
            "hierarchy_forced": self.hierarchy_forced,
        }


@dataclass(frozen=True)
class ToothDecision:
    tooth: DetectedTooth
    scores: ToothScores
    decisions: tuple[DiseaseDecision, DiseaseDecision, DiseaseDecision, DiseaseDecision]

    def __post_init__(self):
        if len(self.decisions) != len(DISEASE_CLASSES):
            raise ValueError("ToothDecision must contain all four disease decisions.")
        if tuple(item.disease_label for item in self.decisions) != DISEASE_CLASSES:
            raise ValueError("Tooth decisions must preserve the locked class order.")
        score_map = self.scores.to_json()
        if any(item.model_score != score_map[item.disease_label] for item in self.decisions):
            raise ValueError("Tooth decisions must retain their corresponding locked model scores.")
        any_caries, deep_caries = self.decisions[:2]
        hierarchy_required = deep_caries.is_positive and any_caries.model_score < any_caries.threshold
        if any_caries.hierarchy_forced != hierarchy_required:
            raise ValueError("Any Caries hierarchy state is inconsistent with the Deep Caries decision.")

    @property
    def hierarchy_forced_any_caries(self) -> bool:
        return self.decisions[0].hierarchy_forced

    @property
    def any_caries_decision(self) -> FindingDecision:
        return self.decisions[0].decision

    def to_json(self) -> dict:
        return {
            **self.tooth.to_json(),
            "model_scores": self.scores.to_json(),
            "decisions": [decision.to_json() for decision in self.decisions],
            "hierarchy_forced_any_caries": self.hierarchy_forced_any_caries,
            "any_caries_decision": self.any_caries_decision.value,
        }


def apply_locked_policy(tooth: DetectedTooth, scores: ToothScores) -> ToothDecision:
    score_map = scores.to_json()
    positives = {label: score_map[label] >= THRESHOLDS[label] for label in DISEASE_CLASSES}
    hierarchy_forced = positives["Deep Caries"] and not positives["Any Caries"]
    if positives["Deep Caries"]:
        positives["Any Caries"] = True

    decisions = []
    for label, threshold in CLASS_THRESHOLDS:
        score = score_map[label]
        if positives[label]:
            decision = FindingDecision.FLAGGED
        elif label == "Any Caries" and score >= ANY_CARIES_REVIEW_MIN:
            decision = FindingDecision.REVIEW
        else:
            decision = FindingDecision.NOT_FLAGGED
        decisions.append(
            DiseaseDecision(
                disease_label=label,
                model_score=score,
                threshold=threshold,
                decision=decision,
                is_positive=positives[label],
                hierarchy_forced=hierarchy_forced and label == "Any Caries",
            )
        )
    return ToothDecision(tooth=tooth, scores=scores, decisions=tuple(decisions))


@dataclass(frozen=True)
class DisplayFinding:
    fdi_tooth_id: str
    disease_label: str
    model_score: float
    threshold: float | None
    decision: FindingDecision
    is_positive: bool
    detector_confidence: float | None
    hierarchy_forced: bool = False

    def __post_init__(self):
        if self.fdi_tooth_id not in FDI_TOOTH_IDS:
            raise ValueError("Display finding has an invalid FDI identifier.")
        if not isinstance(self.disease_label, str) or not self.disease_label.strip():
            raise ValueError("Display finding disease_label is required.")
        object.__setattr__(self, "model_score", _unit_float(self.model_score, "model_score"))
        if self.threshold is not None:
            object.__setattr__(self, "threshold", _unit_float(self.threshold, "threshold"))
        if self.detector_confidence is not None:
            object.__setattr__(
                self,
                "detector_confidence",
                _unit_float(self.detector_confidence, "detector_confidence"),
            )
        if self.is_positive != (self.decision == FindingDecision.FLAGGED):
            raise ValueError("Only flagged display findings are positive.")

    @classmethod
    def from_tooth_decision(cls, tooth_decision: ToothDecision) -> tuple["DisplayFinding", ...]:
        findings = []
        for decision in tooth_decision.decisions:
            if decision.decision == FindingDecision.NOT_FLAGGED:
                continue
            findings.append(
                cls(
                    fdi_tooth_id=tooth_decision.tooth.fdi_tooth_id,
                    disease_label=decision.disease_label,
                    model_score=decision.model_score,
                    threshold=decision.threshold,
                    decision=decision.decision,
                    is_positive=decision.is_positive,
                    detector_confidence=tooth_decision.tooth.detector_confidence,
                    hierarchy_forced=decision.hierarchy_forced,
                )
            )
        return tuple(findings)

    def to_json(self) -> dict:
        return {
            "fdi_tooth_id": self.fdi_tooth_id,
            "disease_label": self.disease_label,
            "model_score": self.model_score,
            "threshold": self.threshold,
            "decision": self.decision.value,
            "is_positive": self.is_positive,
            "detector_confidence": self.detector_confidence,
            "hierarchy_forced": self.hierarchy_forced,
            # Legacy display aliases only; real-model semantics use model_score.
            "confidence_score": self.model_score,
            "confidence_percent": round(self.model_score * 100),
        }


@dataclass(frozen=True)
class PipelineResult:
    result_summary: str
    model_version: str
    teeth: tuple[ToothDecision, ...] = ()
    display_findings: tuple[DisplayFinding, ...] = ()
    overall_confidence: float | None = None
    score_semantics: str = MODEL_SCORE_SEMANTICS
    pipeline_metadata: Mapping[str, object] = field(default_factory=dict)
    overlay_png: bytes | None = None

    def __post_init__(self):
        if not self.result_summary or len(self.result_summary) > 255:
            raise ValueError("Pipeline result_summary must be between 1 and 255 characters.")
        if not self.model_version or len(self.model_version) > 100:
            raise ValueError("Pipeline model_version must be between 1 and 100 characters.")
        if self.overall_confidence is not None:
            object.__setattr__(self, "overall_confidence", _unit_float(self.overall_confidence, "overall_confidence"))
        if not all(isinstance(tooth, ToothDecision) for tooth in self.teeth):
            raise ValueError("Pipeline teeth must contain ToothDecision values.")
        tooth_ids = [tooth.tooth.fdi_tooth_id for tooth in self.teeth]
        if len(tooth_ids) != len(set(tooth_ids)):
            raise ValueError("Pipeline teeth must contain at most one decision per FDI identifier.")
        if not all(isinstance(finding, DisplayFinding) for finding in self.display_findings):
            raise ValueError("Pipeline display_findings must contain DisplayFinding values.")
        if not isinstance(self.score_semantics, str) or not self.score_semantics:
            raise ValueError("Pipeline score semantics are required.")
        if self.overlay_png is not None:
            if not isinstance(self.overlay_png, bytes) or not self.overlay_png.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("overlay_png must contain PNG bytes.")
        try:
            json.dumps(dict(self.pipeline_metadata), allow_nan=False)
        except (TypeError, ValueError) as exc:
            raise ValueError("pipeline_metadata must be JSON-safe.") from exc

    @classmethod
    def for_locked_pipeline(
        cls,
        *,
        teeth: tuple[ToothDecision, ...],
        result_summary: str = "Research-only AI analysis completed.",
        overlay_png: bytes | None = None,
    ) -> "PipelineResult":
        return cls(
            result_summary=result_summary,
            model_version=PIPELINE_VERSION,
            teeth=teeth,
            pipeline_metadata=locked_pipeline_metadata(),
            overlay_png=overlay_png,
        )

    def simplified_findings(self) -> tuple[DisplayFinding, ...]:
        if self.display_findings:
            return self.display_findings
        return tuple(
            finding
            for tooth_decision in self.teeth
            for finding in DisplayFinding.from_tooth_decision(tooth_decision)
        )

    def to_findings_json(self) -> dict:
        envelope = {
            "schema_version": FINDINGS_SCHEMA_VERSION,
            "pipeline": {
                "model_version": self.model_version,
                "score_semantics": self.score_semantics,
                **dict(self.pipeline_metadata),
            },
            "teeth": [tooth.to_json() for tooth in self.teeth],
            "display_findings": [finding.to_json() for finding in self.simplified_findings()],
        }
        json.dumps(envelope, allow_nan=False)
        return envelope

    def to_persistence_payload(self) -> dict:
        return {
            "result_summary": self.result_summary,
            "overall_confidence": self.overall_confidence,
            "findings_json": self.to_findings_json(),
            "model_version": self.model_version,
            "error_message": "",
        }
