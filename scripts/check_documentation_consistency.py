"""Validate Phase 14E supporting-operations documentation and acceptance evidence."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_TOTAL = "48 files, 163 tests"
SCHEDULE_BACKEND_TOTAL = "83 passed"
VISIT_BACKEND_TOTAL = "248 passed"
XRAY_BACKEND_TOTAL = "131 passed"
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "readme": "frontend/README.md",
    "record": "frontend/design_v2/PHASE_14E_IMPLEMENTATION_RECORD.md",
}
ACCEPTANCE_TESTS = {
    "frontend/src/pages/admin/ScheduleLeaveManagementPage.test.tsx": (
        ("./ScheduleManagementPage", "./LeaveManagementPage", "../profile/OwnSchedulePage", "../profile/OwnLeavePage"),
        ("impact confirmation", "non-DELETE actions", "read-only"),
    ),
    "frontend/src/api/endpoints/schedule.test.ts": (
        ("./schedule",),
        ("never DELETE", "apply and copy modes", "retrieve endpoint"),
    ),
    "frontend/src/features/visits/components/VisitWorkspace.test.tsx": (
        ("./VisitWorkspace",),
        ("five-field clinical-note payload", "blocks internal navigation", "saves dirty notes"),
    ),
    "frontend/src/pages/visits/DoctorActiveVisitPage.test.tsx": (
        ("./DoctorActiveVisitPage",),
        ("doctor day appointments", "loading, error retry, denied, and populated states"),
    ),
    "frontend/src/features/appointments/utils/appointmentPermissions.test.ts": (
        ("./appointmentPermissions",),
        ("never exposes Start Visit",),
    ),
    "frontend/src/features/xrays/hooks/useProtectedMedia.test.tsx": (
        ("./useProtectedMedia",),
        ("creates temporary object URLs", "revokes replaced and unmounted URLs"),
    ),
    "frontend/src/features/xrays/components/ProtectedXrayImage.test.tsx": (
        ("./ProtectedXrayImage",),
        ("authenticated-media failures", "decode failures"),
    ),
    "frontend/src/features/xrays/components/XrayUploadDialog.test.tsx": (
        ("./XrayUploadDialog",),
        ("supported multipart-ready payload", "blocks every close action"),
    ),
    "frontend/src/features/xrays/components/ExternalXrayDialogs.test.tsx": (
        ("./ExternalXrayDialogs",),
        ("exact attach payload", "pending destructive confirmation"),
    ),
    "frontend/src/features/xrays/components/ExternalXrayDetail.test.tsx": (
        ("./ExternalXrayDetail",),
        ("Admin upload-case management", "another Doctor"),
    ),
    "frontend/src/api/endpoints/xrays.test.ts": (
        ("./xrays",),
        ("never DELETE", "discard/"),
    ),
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

    required = (
        "phase 14d automated acceptance is complete",
        "phase 14e is in progress",
        "schedules and leave",
        "visits",
        FRONTEND_TOTAL,
        SCHEDULE_BACKEND_TOTAL,
        VISIT_BACKEND_TOTAL,
        XRAY_BACKEND_TOTAL,
        "backend runtime changed: no",
        "migrations: none",
        "phase 14f",
    )
    for key, source in text.items():
        for phrase in required:
            if phrase not in source:
                errors.append(f"{key} missing {phrase!r}")
        for phrase in ("x-rays/ai", "billing", "clinic settings", "audit"):
            if phrase not in source:
                errors.append(f"{key} does not state remaining Phase 14E work: {phrase!r}")

    status = text.get("status", "")
    if "next phase 14e task: billing" not in status:
        errors.append("status does not identify Billing as the next Phase 14E task")
    if "phase 14e has not started" in "\n".join(text.values()):
        errors.append("stale wording: 'phase 14e has not started'")

    for relative, (imports, scenarios) in ACCEPTANCE_TESTS.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing acceptance test {relative}")
            continue
        source = path.read_text(encoding="utf-8")
        for production_import in imports:
            if production_import not in source:
                errors.append(f"acceptance test lacks production import {relative}: {production_import!r}")
        for scenario in scenarios:
            if scenario not in source:
                errors.append(f"acceptance test lacks representative scenario {relative}: {scenario!r}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed. It does not replace typecheck, tests, build, backend verification, or browser QA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
