"""Validate Phase 14E closure documentation and production acceptance evidence."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_TOTAL = "60 files, 213 tests"
STATUS_FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "readme": "frontend/README.md",
    "record": "frontend/design_v2/PHASE_14E_IMPLEMENTATION_RECORD.md",
}
STATUS_REQUIREMENTS = (
    "phase 14e supporting operations automated acceptance: complete",
    "schedules and leave",
    "visits",
    "x-rays/ai",
    "billing",
    "clinic settings",
    "audit",
    FRONTEND_TOTAL,
    "83 passed",
    "248 passed",
    "131 passed",
    "71 passed",
    "170 passed",
    "414 passed",
    "django check passed",
    "migration drift: no changes detected",
    "backend runtime modified: no",
    "migrations: none",
    "phase 14f browser visual/uat acceptance is next",
    "deployment remains paused",
)
ACCEPTANCE_EVIDENCE = {
    "frontend/src/pages/admin/ClinicSettingsPage.test.tsx": {
        "import": "./ClinicSettingsPage",
        "scenarios": (
            "four explicit typed sections",
            "PATCHes only exact changed typed fields",
            "localized GET error and retries",
            "blocks beforeunload and internal navigation while settings are dirty",
            "locks duplicate submission and navigation while a save is pending",
            "preserves dirty values after a failed save",
            "uses a successful response as the baseline, announces success",
            "localized AI modes, and an RTL page direction",
        ),
    },
    "frontend/src/pages/admin/AuditPages.test.tsx": {
        "import": "./AuditPages",
        "scenarios": (
            "URL-backed filters",
            "debounces actor server search",
            "ignores an older actor-search response after a newer search",
            "localizes known values, safely humanizes unknown values",
            "opens rows with mouse or keyboard",
            "opens System and unknown rows by mouse and Space",
            "bounded structured metadata with nested redaction and plain HTML-like text",
            "renders bounded typed metadata, all sensitive key families",
            "localizes Arabic audit labels and retains RTL direction",
        ),
    },
    "frontend/src/api/endpoints/audit.test.ts": {
        "import": "./audit",
        "scenarios": (
            "uses GET for the list and detail endpoints",
            "exposes no mutation operations",
        ),
    },
}
RUNTIME_FILES = (
    "frontend/src/pages/admin/AdminManagementPages.tsx",
    "frontend/src/pages/admin/ClinicSettingsPage.tsx",
    "frontend/src/pages/admin/AuditPages.tsx",
    "frontend/src/api/endpoints/audit.ts",
)
FORBIDDEN_RUNTIME = (
    "Object.entries(data)",
    "JSON.stringify",
    "<pre",
    "dangerouslySetInnerHTML",
    "LegacyAdminClinicSettingsPage",
)
FORBIDDEN_AUTHORITY = (
    "56 files, 188 tests",
    "Phase 14E is in progress",
    "Clinic Settings and Audit have not started",
    "Phase 14E is not complete",
    "Clinic Settings and Audit are the next tasks",
)


def read(relative: str, errors: list[str]) -> str:
    path = ROOT / relative
    if not path.is_file():
        errors.append(f"missing {relative}")
        return ""
    return path.read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []
    status_text = {name: read(relative, errors) for name, relative in STATUS_FILES.items()}

    for name, source in status_text.items():
        lowered = source.lower()
        for requirement in STATUS_REQUIREMENTS:
            if requirement not in lowered:
                errors.append(f"{name} missing current-status evidence: {requirement!r}")
        for forbidden in FORBIDDEN_AUTHORITY:
            if forbidden.lower() in lowered:
                errors.append(f"{name} retains stale or contradictory authority: {forbidden!r}")

    for relative, evidence in ACCEPTANCE_EVIDENCE.items():
        source = read(relative, errors)
        if not source:
            continue
        if evidence["import"] not in source:
            errors.append(f"acceptance test lacks production import: {relative}")
        for scenario in evidence["scenarios"]:
            if scenario not in source:
                errors.append(f"acceptance test lacks representative scenario {relative}: {scenario!r}")

    for relative in RUNTIME_FILES:
        source = read(relative, errors)
        for forbidden in FORBIDDEN_RUNTIME:
            if forbidden in source:
                errors.append(f"active runtime retains forbidden content {relative}: {forbidden!r}")

    for name, source in status_text.items():
        for forbidden in FORBIDDEN_RUNTIME:
            if forbidden in source:
                errors.append(f"{name} retains forbidden current-authority content: {forbidden!r}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed. It does not replace typecheck, tests, build, backend verification, or Phase 14F browser QA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
