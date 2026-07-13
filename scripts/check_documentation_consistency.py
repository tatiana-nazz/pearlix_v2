"""Fail fast on Phase 14D closure-documentation drift (standard library only)."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_TOTAL = "38 files, 104 tests"
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": "frontend/README.md",
    "qa": "frontend/QA_14D.md",
    "record": "frontend/design_v2/PHASE_14D_IMPLEMENTATION_RECORD.md",
    "mapping": "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md",
    "matrix": "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
    "blueprints": "frontend/design_v2/SCREEN_BLUEPRINTS_V2.md",
}
ACCEPTANCE_TESTS = {
    "frontend/src/pages/admin/TeamPages.test.tsx": "./TeamPages",
    "frontend/src/pages/admin/AdminManagementPages.test.tsx": "./AdminManagementPages",
    "frontend/src/pages/patients/NewPatientPage.test.tsx": "./NewPatientPage",
    "frontend/src/pages/patients/PatientProfilePage.test.tsx": "./PatientProfilePage",
}


def main() -> int:
    errors: list[str] = []
    text: dict[str, str] = {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing {relative}")
        else:
            text[key] = path.read_text(encoding="utf-8").lower()

    expected = {
        "status": ("current phase: phase 14d complete", "next phase: phase 14e", "backend runtime changes in phase 14d: no", "migrations in phase 14d: none", "phase 14f"),
        "audit": ("phase 14d final acceptance is complete", "tatiana-nazz/pearlix_v2", "phase 14f"),
        "readme": ("phase 14d final acceptance is complete", "phase 14e", "phase 14f"),
        "qa": ("phase 14d final acceptance is complete", FRONTEND_TOTAL, "documentation consistency checker is not a substitute", "phase 14f"),
        "record": ("phase 14d final acceptance is complete", FRONTEND_TOTAL, "backend runtime changed: no", "migrations: none"),
        "mapping": ("phase 14d closure", "phase 14e is next"),
        "matrix": ("phase 14d automated closure", "phase 14f"),
        "blueprints": ("phase 14d closure note", "phase 14f"),
    }
    for key, phrases in expected.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""):
                errors.append(f"{key} missing {phrase!r}")

    for key in ("status", "audit", "readme", "qa", "record"):
        if FRONTEND_TOTAL not in text.get(key, ""):
            errors.append(f"{key} does not report exact frontend total {FRONTEND_TOTAL!r}")

    joined = "\n".join(text.values())
    stale = (
        "phase 14d acceptance corrections in progress",
        "phase 14d is complete",
        "current completed phase: phase 14d",
        "phase 14d is next",
        "92 frontend tests",
        "92 passed",
        "94 tests",
        "97 tests",
        "35 files, 97 tests",
        "browser qa: complete",
        "browser qa completed",
        "phase 14e has started",
    )
    for phrase in stale:
        if phrase in joined:
            errors.append(f"stale wording: {phrase!r}")

    i18n = ROOT / "frontend/src/layouts/i18n.ts"
    if i18n.is_file():
        i18n_text = i18n.read_text(encoding="utf-8").lower()
        for suppression in ("@ts-nocheck", "@ts-ignore"):
            if suppression in i18n_text:
                errors.append(f"i18n suppression present: {suppression}")
    else:
        errors.append("missing frontend/src/layouts/i18n.ts")

    for relative, production_import in ACCEPTANCE_TESTS.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing acceptance test {relative}")
            continue
        source = path.read_text(encoding="utf-8")
        if not source.strip():
            errors.append(f"empty acceptance test {relative}")
        elif production_import not in source:
            errors.append(f"acceptance test lacks production import {relative}")

    runtime_root = ROOT / "frontend/src"
    banned_runtime_copy = (
        "phase 14d acceptance corrections in progress",
        "35 files, 97 tests",
        "92 frontend tests",
    )
    for path in runtime_root.rglob("*.ts*"):
        source = path.read_text(encoding="utf-8").lower()
        for phrase in banned_runtime_copy:
            if phrase in source:
                errors.append(f"stale runtime copy in {path.relative_to(ROOT)}: {phrase!r}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed. It does not replace typecheck, tests, build, or backend verification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
