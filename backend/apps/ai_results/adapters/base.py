from __future__ import annotations

from typing import Protocol, runtime_checkable

from apps.ai_results.result_types import ImageInput, PipelineResult


class InferenceAdapterError(Exception):
    """Safe internal boundary for adapter failures."""


class InferenceConfigurationError(InferenceAdapterError):
    """The operator-configured runtime cannot be trusted or initialized."""


class InferenceImageInvalidError(InferenceAdapterError):
    """The bounded uploaded bytes are not a decodable supported image."""


class InferenceRuntimeError(InferenceAdapterError):
    """Inference failed after a valid runtime and input were established."""


@runtime_checkable
class InferenceAdapter(Protocol):
    model_version: str

    def analyze(self, image: ImageInput) -> PipelineResult:
        """Analyze normalized image bytes without retaining request state."""
        ...
