from __future__ import annotations

import platform

from django.core.management.base import BaseCommand, CommandError

from apps.ai_results.adapters.base import InferenceConfigurationError
from apps.ai_results.adapters.dentex import (
    DentexConfig,
    _import_runtime,
    load_model_bundle,
    validate_runtime_device,
)
from apps.ai_results.model_contract import (
    CLASSIFIER_SHA256,
    DETECTOR_SHA256,
    FDI_MAP_SHA256,
    PIPELINE_VERSION,
    verify_trusted_artifact,
)


def run_preflight(*, load_models: bool) -> dict:
    config = DentexConfig.from_settings()
    artifact_specs = (
        ("detector", config.detector_path, DETECTOR_SHA256),
        ("classifier", config.classifier_path, CLASSIFIER_SHA256),
        ("fdi_map", config.fdi_map_path, FDI_MAP_SHA256),
    )
    for _name, configured_path, expected_hash in artifact_specs:
        verify_trusted_artifact(
            trusted_root=config.model_root,
            configured_path=configured_path,
            expected_sha256=expected_hash,
        )

    runtime = _import_runtime()
    validate_runtime_device(config.device, runtime.torch)
    bundle = load_model_bundle(config) if load_models else None
    if bundle is not None:
        runtime = bundle.runtime

    return {
        "python": platform.python_version(),
        "device": config.device,
        "model_version": PIPELINE_VERSION,
        "versions": dict(runtime.package_versions),
        "hashes": {name: expected_hash for name, _path, expected_hash in artifact_specs},
        "models_loaded": bundle is not None,
        "load_duration_seconds": bundle.bundle_load_seconds if bundle is not None else None,
    }


class Command(BaseCommand):
    help = "Verify that the locked DENTEX bundle and runtime are safe for DJANGO_INTERNAL."

    def add_arguments(self, parser):
        parser.add_argument(
            "--load-models",
            action="store_true",
            help="Load and validate the verified detector and classifier after lightweight checks.",
        )

    def handle(self, *args, **options):
        try:
            report = run_preflight(load_models=bool(options["load_models"]))
        except (InferenceConfigurationError, ImportError, OSError, ValueError) as exc:
            raise CommandError(f"AI preflight FAIL: {exc}") from exc
        except Exception as exc:
            raise CommandError("AI preflight FAIL: the locked runtime could not be verified safely.") from exc

        self.stdout.write(self.style.SUCCESS("AI preflight PASS"))
        self.stdout.write(f"python: {report['python']}")
        self.stdout.write(f"device: {report['device']}")
        self.stdout.write(f"model_version: {report['model_version']}")
        for package, version in report["versions"].items():
            self.stdout.write(f"{package}: {version}")
        for artifact, digest in report["hashes"].items():
            self.stdout.write(f"{artifact}_sha256: {digest}")
        if report["models_loaded"]:
            self.stdout.write("model_load: PASS")
            self.stdout.write(f"load_duration_seconds: {report['load_duration_seconds']:.3f}")
        else:
            self.stdout.write("model_load: SKIPPED (use --load-models)")
