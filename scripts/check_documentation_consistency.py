"""Fail fast on Phase 14D.3 appointments, Phase 14D.2 dashboard, and Phase 14R documentation drift."""

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
            "current completed phase: 14d.3 appointments workspace redesign and workflow alignment",
            "final backend full regression: 418 passed",
            "final frontend regression: 97 passed in 36 files",
            "backend regression gate: closed",
            "remaining phase 14d ui redesign scope is patients",
        ),
        "audit": (
            "phase 14r regression-gate update",
            "phase 14d.1 delivered the admin team and users & access routes",
            "complete backend suite now passes (418 tests)",
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
    if "browser qa: complete" in joined or "browser acceptance complete" in joined:
        errors.append("browser QA is falsely complete")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
