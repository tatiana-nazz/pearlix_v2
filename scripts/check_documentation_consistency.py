"""Fail fast on Phase 14D browser-acceptance and prior phase documentation drift."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "record": "backend/project_docs/PHASE_14R_BACKEND_REGRESSION_STABILIZATION.md",
    "dashboard_record": "frontend/design_v2/PHASE_14D2_ROLE_DASHBOARD_IMPLEMENTATION_RECORD.md",
    "dashboard_qa": "frontend/QA_14D2_ROLE_DASHBOARDS.md",
    "appointments_record": "frontend/design_v2/PHASE_14D3_APPOINTMENTS_IMPLEMENTATION_RECORD.md",
    "appointments_qa": "frontend/QA_14D3_APPOINTMENTS_WORKSPACE.md",
    "appointments_closure": "frontend/design_v2/PHASE_14D3A_APPOINTMENTS_CLOSURE_RECORD.md",
    "patient_record": "frontend/design_v2/PHASE_14D4_PATIENT_WORKSPACE_IMPLEMENTATION_RECORD.md",
    "patient_closure": "frontend/design_v2/PHASE_14D4A_PATIENT_CLOSURE_RECORD.md",
    "patient_qa": "frontend/QA_14D4_PATIENT_WORKSPACE.md",
    "browser_qa": "frontend/QA_14D_BROWSER_ACCEPTANCE.md",
    "browser_record": "frontend/design_v2/PHASE_14D_BROWSER_ACCEPTANCE_RECORD.md",
    "local_login_record": "frontend/design_v2/LOCAL_LOGIN_NETWORK_FIX_RECORD.md",
    "backend_phase_tracker": "backend/project_docs/BACKEND_PHASE_TRACKER.md",
}


def main() -> int:
    errors, text = [], {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing {relative}")
        else:
            text[key] = path.read_text(encoding="utf-8").lower()

    checks = {
        "status": (
            "final backend full regression: 420 passed",
            "final frontend regression: 113 passed in 40 files",
            "backend regression gate: closed",
            "current completed phase: 14d browser acceptance gate",
            "browser qa/uat: phase 14d integrated acceptance passed",
        ),
        "audit": (
            "phase 14r regression-gate update",
            "phase 14d.1 delivered the admin team and users & access routes",
            "complete backend suite now passes (420 tests)",
        ),
        "record": (
            "backend complete suite: 418 passed, 0 failed",
            "no migrations or database schema changes",
            "browser/manual qa was not executed",
        ),
        "dashboard_record": (
            "phase 14d.2",
            "clinic_date",
            "clinic_timezone",
            "frontend regression: 94 passed in 35 files",
            "browser qa was not executed",
        ),
        "dashboard_qa": (
            "browser qa status: pending execution",
            "admin",
            "staff",
            "doctor",
            "arabic",
        ),
        "appointments_record": (
            "phase 14d.3",
            "clinic_date",
            "clinic_timezone",
            "browser qa is pending",
        ),
        "appointments_qa": (
            "browser qa status: pending execution",
            "needs reschedule",
            "arabic rtl",
        ),
        "appointments_closure": (
            "phase 14d.3a",
            "patient_id",
            "is_archived=false",
            "browser qa was not executed",
            "420 complete backend tests passed",
        ),
        "patient_record": (
            "phase 14d.4",
            "113 frontend tests in 40 files",
            "no backend runtime or external api contract changed",
            "browser qa was not executed",
        ),
        "patient_qa": (
            "browser qa status: pending execution",
            "arabic rtl",
            "archive/reactivate",
        ),
        "patient_closure": (
            "phase 14d.4a",
            "every active doctor can read and update every active, non-archived patient",
            "113 frontend tests in 40 files",
            "420 backend tests",
            "browser/manual qa was not executed",
        ),
        "browser_qa": (
            "phase 14d browser acceptance",
            "admin, staff, doctor",
            "1440x900, 1280x720, 1024x768, 768x1024",
            "no blocker, critical, or high defects remain",
            "ba-001",
        ),
        "browser_record": (
            "phase 14d browser acceptance gate is closed",
            "no backend endpoint, serializer, permission, api contract, or migration changed",
        ),
        "local_login_record": (
            "vite's default port fallback silently moved the frontend",
            "strictport: true",
            "account_disabled",
        ),
        "backend_phase_tracker": (
            "phase 14d.4a",
            "no backend runtime or api contract change",
            "420 passed",
        ),
    }
    for key, phrases in checks.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""):
                errors.append(f"{key} missing {phrase!r}")

    joined = "\n".join(text.values())
    for stale in (
        "28 backend failures remain",
        "386 backend tests pass with 28 failures",
        "backend regression gate is open",
    ):
        if stale in joined:
            errors.append(f"stale regression wording: {stale!r}")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
