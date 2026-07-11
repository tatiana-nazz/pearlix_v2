"""Fail fast when the release documentation drifts from the Phase 13K contract."""

from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
PROJECT_STATUS = ROOT / "backend" / "project_docs" / "PROJECT_STATUS.md"
README = ROOT / "frontend" / "README.md"
QA_13K = ROOT / "frontend" / "QA_13K.md"
AUDIT = ROOT / "backend" / "project_docs" / "FRONTEND_BACKEND_INTEGRATION_AUDIT.md"
CURRENT_DOCS = [
    PROJECT_STATUS,
    README,
    QA_13K,
    AUDIT,
    ROOT / "backend" / "project_docs" / "BACKEND_FINAL_HANDOFF.md",
    ROOT / "backend" / "project_docs" / "CURRENT_BACKEND_DECISIONS.md",
]

REQUIRED_ROUTES = {
    "admin": {
        "/admin/dashboard", "/admin/users", "/admin/users/new", "/admin/users/:userId",
        "/admin/clinic-settings", "/admin/doctors", "/admin/leave", "/admin/leave/:exceptionId",
        "/admin/patients", "/admin/patients/:patientId", "/admin/appointments/day",
        "/admin/appointments/week", "/admin/appointments/month", "/admin/appointments/list",
        "/admin/appointments/needs-reschedule", "/admin/visits/:visitId", "/admin/xrays",
        "/admin/xrays/:xrayId", "/admin/external-xrays", "/admin/external-xrays/:caseId",
        "/admin/billing/handoffs", "/admin/billing/invoices", "/admin/billing/invoices/:invoiceId",
        "/admin/billing/invoices/:invoiceId/print", "/admin/audit-logs", "/admin/audit-logs/:auditLogId",
    },
    "staff": {
        "/staff/dashboard", "/staff/patients", "/staff/patients/new", "/staff/patients/:patientId",
        "/staff/appointments/day", "/staff/appointments/week", "/staff/appointments/month",
        "/staff/appointments/list", "/staff/appointments/needs-reschedule",
        "/staff/appointments/:appointmentId/reschedule", "/staff/profile/schedule", "/staff/profile/leave",
        "/staff/visits/:visitId", "/staff/xrays", "/staff/xrays/:xrayId", "/staff/billing/handoffs",
        "/staff/billing/handoffs/:handoffId", "/staff/billing/invoices", "/staff/billing/invoices/new",
        "/staff/billing/invoices/:invoiceId", "/staff/billing/invoices/:invoiceId/payments",
        "/staff/billing/invoices/:invoiceId/print",
    },
    "doctor": {
        "/doctor/dashboard", "/doctor/appointments/day", "/doctor/appointments/week",
        "/doctor/appointments/list", "/doctor/appointments/needs-reschedule", "/doctor/visits/active",
        "/doctor/visits/:visitId", "/doctor/patients", "/doctor/patients/:patientId",
        "/doctor/patients/:patientId/clinical-history", "/doctor/xrays", "/doctor/xrays/:xrayId",
        "/doctor/external-xrays", "/doctor/external-xrays/:caseId", "/doctor/profile/schedule",
        "/doctor/profile/leave", "/doctor/billing/handoffs", "/doctor/billing/handoffs/:handoffId",
    },
}

REQUIRED_PHASE_HISTORY = [
    "13B", "13B.1", "13C", "13D", "13D.1", "13E", "13E.1", "13F", "13F.1",
    "13G", "13H", "13I", "13J", "13K",
]


def route_blocks(text: str) -> dict[str, list[str]]:
    text = text.replace("\r\n", "\n")
    blocks: dict[str, list[str]] = {}
    role_markers = "|".join(rf"^/{name}\s*$" for name in REQUIRED_ROUTES)
    for role in REQUIRED_ROUTES:
        match = re.search(rf"(?ms)^/{role}\s*$\n(.*?)(?={role_markers}|\Z)", text)
        if not match:
            continue
        blocks[role] = re.findall(rf"^/{role}(?:/[\w:.-]+)*$", match.group(0), re.MULTILINE)
    return blocks


def historical_phase_order(text: str) -> list[str] | None:
    text = text.replace("\r\n", "\n")
    match = re.search(r"(?ms)^## O\. Historical Phase Order\s*$\n(.*?)(?=^## |\Z)", text)
    if not match:
        return None
    labels = "|".join(re.escape(phase) for phase in REQUIRED_PHASE_HISTORY)
    return re.findall(rf"(?m)^-\s+({labels})\s+—", match.group(1))


def main() -> int:
    errors: list[str] = []
    for path in CURRENT_DOCS:
        if not path.exists():
            errors.append(f"Missing required document: {path.relative_to(ROOT)}")
    if errors:
        print("Documentation consistency check failed:", *errors, sep="\n- ")
        return 1

    status = PROJECT_STATUS.read_text(encoding="utf-8")
    for expected in (
        "Current completed phase: 13K",
        "Phase 13 series: complete",
        "Next phase: none",
        "Next step: deployment and live user acceptance testing",
    ):
        if status.count(expected) != 1:
            errors.append(f"PROJECT_STATUS must contain exactly one '{expected}'.")
    for label in ("Current completed phase:", "Next phase:", "Next step:"):
        if status.count(label) != 1:
            errors.append(f"PROJECT_STATUS must have exactly one canonical '{label}' declaration.")

    readme = README.read_text(encoding="utf-8")
    for expected in ("Phase 13K", "PROJECT_STATUS.md", "frontend/QA_13K.md"):
        if expected not in readme:
            errors.append(f"README is missing '{expected}'.")
    if re.search(r"Phase 13K.{0,50}(future|pending|deferred|next)", readme, re.IGNORECASE):
        errors.append("README presents Phase 13K as future, pending, deferred, or next.")
    if "placeholder" in readme.lower():
        errors.append("README describes a completed capability as a placeholder.")

    stale_patterns = (
        r"Phase 13J is next",
        r"Phase 13K is next",
        r"Phase 13K has not started",
        r"capabilities implemented through Phase 13J only",
    )
    for path in CURRENT_DOCS:
        text = path.read_text(encoding="utf-8")
        if "## Future Phase Order" in text:
            errors.append(f"Obsolete '## Future Phase Order' heading in {path.relative_to(ROOT)}.")
        for pattern in stale_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                errors.append(f"Stale phase wording in {path.relative_to(ROOT)}: '{pattern}'.")

    audit = AUDIT.read_text(encoding="utf-8")
    phase_history = historical_phase_order(audit)
    if phase_history is None:
        errors.append("Integration audit is missing the '## O. Historical Phase Order' section.")
    else:
        for phase in REQUIRED_PHASE_HISTORY:
            count = phase_history.count(phase)
            if count == 0:
                errors.append(f"Historical Phase Order is missing {phase}.")
            elif count > 1:
                errors.append(f"Historical Phase Order duplicates {phase} ({count} entries).")
        if phase_history != REQUIRED_PHASE_HISTORY:
            errors.append(
                "Historical Phase Order is out of order: expected "
                f"{', '.join(REQUIRED_PHASE_HISTORY)}; found {', '.join(phase_history)}."
            )
    blocks = route_blocks(audit)
    for role, required in REQUIRED_ROUTES.items():
        routes = blocks.get(role, [])
        if not routes:
            errors.append(f"Integration audit has no {role.title()} route block.")
            continue
        duplicates = sorted({route for route in routes if routes.count(route) > 1})
        if duplicates:
            errors.append(f"Duplicate {role.title()} routes: {', '.join(duplicates)}.")
        missing = sorted(required - set(routes))
        if missing:
            errors.append(f"Missing {role.title()} routes: {', '.join(missing)}.")

    qa = QA_13K.read_text(encoding="utf-8")
    for expected in ("Final Automated Results", "Browser QA/UAT", "405 passed", "51 passed"):
        if expected not in qa:
            errors.append(f"QA_13K is missing '{expected}'.")
    for status_label, qa_label in (("Final backend full regression", "Full backend regression"), ("Final frontend regression", "Frontend regression")):
        status_match = re.search(rf"{status_label}: (\d+ passed)", status)
        qa_match = re.search(rf"{qa_label}: (\d+ passed)", qa)
        if not status_match or not qa_match or status_match.group(1) != qa_match.group(1):
            errors.append(f"PROJECT_STATUS and QA_13K disagree on {qa_label.lower()} totals.")

    if errors:
        print("Documentation consistency check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
