from __future__ import annotations

from typing import Protocol, runtime_checkable

from apps.ai_results.result_types import ImageInput, PipelineResult


@runtime_checkable
class InferenceAdapter(Protocol):
    model_version: str

    def analyze(self, image: ImageInput) -> PipelineResult:
        """Analyze normalized image bytes without retaining request state."""
        ...
