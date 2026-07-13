"""Validate Phase 14E supporting-operations documentation and acceptance evidence."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_TOTAL = "56 files, 188 tests"
SCHEDULE_BACKEND_TOTAL = "83 passed"
VISIT_BACKEND_TOTAL = "248 passed"
XRAY_BACKEND_TOTAL = "131 passed"
BILLING_BACKEND_TOTAL = "71 passed"
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
    "frontend/src/features/billing/components/BillingDialogs.test.tsx": (
        ("./BillingDialogs",),
        ("omits a currency payload", "overpayment"),
    ),
    "frontend/src/api/endpoints/billing.test.ts": (
        ("./billing",),
        ("POST-only", "never DELETE"),
    ),
    "frontend/src/features/billing/components/VisitBillingSection.test.tsx": (
        ("./VisitBillingSection",),
        ("owning completed visit", "active and non-owning Doctor", "Admin and Staff read-only", "existing handoff"),
    ),
    "frontend/src/pages/billing/BillingPages.test.tsx": (
        ("./BillingPages",),
        ("Admin invoices read-only", "selected patient instead of a raw patient identifier", "structured print data", "Arabic root RTL direction", "controlled list filters", "dirty New Invoice navigation"),
    ),
    "frontend/src/pages/billing/BillingInvoicePages.test.tsx": (
        ("./BillingPages",),
        ("Admin detail read-only", "locks paid and cancelled", "remaining balance", "exact remaining payment", "relationship fields"),
    ),
    "frontend/src/pages/billing/BillingHandoffPages.test.tsx": (
        ("./BillingPages",),
        ("Staff Convert and Dismiss only for a pending handoff", "Admin, Doctor, converted, and dismissed", "exact conversion payload", "POST-only dismissal payload", "navigates once after a successful conversion"),
    ),
    "frontend/src/features/billing/hooks/useBilling.test.tsx": (
        ("./useBilling",),
        ("invalidates invoice, payment, print, list, handoff, and dashboard data",),
    ),
    "frontend/src/layouts/i18n.billing.test.ts": (
        ("./i18n",),
        ("typed Arabic billing labels",),
    ),
}

# These fragments require the acceptance files to exercise production state and
# interactions, rather than merely naming a scenario in prose.
ACTUAL_INTERACTION_EVIDENCE = {
    "frontend/src/features/billing/components/VisitBillingSection.test.tsx": (
        'status: "ACTIVE"', 'status: "COMPLETED"', 'results = [{ id: 9 }]',
    ),
    "frontend/src/pages/billing/BillingPages.test.tsx": (
        'document.documentElement.dir = "rtl"', 'closest("[dir]")',
        'fireEvent.change(handoff.getByLabelText("Created from")',
        'router.navigate("/staff/billing/invoices")',
    ),
    "frontend/src/pages/billing/BillingInvoicePages.test.tsx": (
        'status: "PAID"', 'status: "CANCELLED"',
        'value: "60"', 'value: "50.00"',
    ),
    "frontend/src/pages/billing/BillingHandoffPages.test.tsx": (
        'status: "CONVERTED_TO_INVOICE"', 'status: "DISMISSED"',
        'handoffId: 12', 'getAllByText("Invoice")',
    ),
    "frontend/src/features/billing/hooks/useBilling.test.tsx": (
        'billingApi.recordPayment', '["invoice-payments", 14]',
        '["invoice-print-data", 14]',
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
        BILLING_BACKEND_TOTAL,
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
    if "next phase 14e tasks: clinic settings and audit" not in status:
        errors.append("status does not identify Clinic Settings and Audit as the next Phase 14E tasks")
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
        for evidence in ACTUAL_INTERACTION_EVIDENCE.get(relative, ()):
            if evidence not in source:
                errors.append(f"acceptance test lacks production interaction evidence {relative}: {evidence!r}")

    billing_runtime = "\n".join(
        (ROOT / relative).read_text(encoding="utf-8")
        for relative in (
            "frontend/src/pages/billing/BillingPages.tsx",
            "frontend/src/features/billing/components/BillingDialogs.tsx",
            "frontend/src/features/billing/components/BillingLists.tsx",
            "frontend/src/features/billing/components/VisitBillingSection.tsx",
        )
    )
    for forbidden in ("Patient ID", "Doctor ID", "Visit ID", "Appointment ID", "JSON.stringify", "<pre", "dialog-backdrop", "dialog-panel", "dir={role"):
        if forbidden in billing_runtime:
            errors.append(f"billing runtime retains forbidden legacy content: {forbidden!r}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed. It does not replace typecheck, tests, build, backend verification, or browser QA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
