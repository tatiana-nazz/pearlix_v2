import json
import os
import time

import pytest


pytestmark = pytest.mark.skipif(
    os.environ.get("PEARLIX_RUN_REAL_AI_SMOKE") != "1",
    reason="Set PEARLIX_RUN_REAL_AI_SMOKE=1 to exercise the verified local model bundle.",
)


def test_locked_real_dentex_model_and_full_adapter_smoke(settings):
    import cv2
    import numpy as np
    import psutil

    from apps.ai_results.adapters.dentex import (
        get_dentex_adapter,
        reset_dentex_caches,
        score_crop,
    )
    from apps.ai_results.model_contract import PIPELINE_VERSION
    from apps.ai_results.result_types import ImageInput, PipelineResult

    settings.PEARLIX_AI_MODEL_ROOT = os.environ["PEARLIX_AI_MODEL_ROOT"]
    settings.PEARLIX_AI_DETECTOR_PATH = os.environ["PEARLIX_AI_DETECTOR_PATH"]
    settings.PEARLIX_AI_CLASSIFIER_PATH = os.environ["PEARLIX_AI_CLASSIFIER_PATH"]
    settings.PEARLIX_AI_FDI_MAP_PATH = os.environ["PEARLIX_AI_FDI_MAP_PATH"]
    settings.PEARLIX_AI_DEVICE = "cpu"
    settings.PEARLIX_AI_MAX_CONCURRENT_INFERENCES = 1

    reset_dentex_caches()
    try:
        load_started = time.perf_counter()
        adapter = get_dentex_adapter()
        bundle = adapter.ensure_ready()
        assert adapter.ensure_ready() is bundle
        measured_bundle_load = time.perf_counter() - load_started

        crop = np.zeros((384, 384, 3), dtype=np.uint8)
        crop[:, :, 0] = np.arange(384, dtype=np.uint8)[:, None]
        scores = score_crop(crop, bundle)
        assert len(scores.values) == 4

        synthetic = np.zeros((320, 640, 3), dtype=np.uint8)
        synthetic[:, :, 0] = np.arange(640, dtype=np.uint16)[None, :] % 256
        synthetic[:, :, 1] = np.arange(320, dtype=np.uint16)[:, None] % 256
        encoded, buffer = cv2.imencode(".png", synthetic)
        assert encoded

        inference_started = time.perf_counter()
        result = adapter.analyze(ImageInput(content=bytes(buffer.tobytes()), content_type="image/png"))
        inference_seconds = time.perf_counter() - inference_started

        assert isinstance(result, PipelineResult)
        assert result.model_version == PIPELINE_VERSION
        assert result.overall_confidence is None
        json.dumps(result.to_findings_json(), allow_nan=False)
        assert result.overlay_png.startswith(b"\x89PNG\r\n\x1a\n")
        print(
            json.dumps(
                {
                    "package_versions": dict(bundle.runtime.package_versions),
                    "detector_load_seconds": bundle.detector_load_seconds,
                    "classifier_load_seconds": bundle.classifier_load_seconds,
                    "bundle_load_seconds": bundle.bundle_load_seconds,
                    "measured_bundle_load_seconds": measured_bundle_load,
                    "adapter_inference_seconds": inference_seconds,
                    "process_rss_bytes": psutil.Process().memory_info().rss,
                    "retained_teeth": len(result.teeth),
                },
                sort_keys=True,
            )
        )
    finally:
        reset_dentex_caches()
