# HISTORICAL / SUPERSEDED — NOT CURRENT IMPLEMENTATION AUTHORITY

Replacement: [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md). Authority register: [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). Useful as Phase 12 historical evidence only.

# Backend Done Definition

Backend is considered MVP-ready only if all of this is true:

## Foundation

- Project runs locally.
- `/api/` base works.
- migrations apply cleanly.
- pytest runs.
- settings are environment-aware.

## Accounts / Permissions

- Admin/Staff/Doctor roles work.
- `/api/me/` works.
- permissions match source of truth.
- forbidden role tests pass.

## Core Workflow

- Staff creates patient.
- Staff books appointment.
- Backend enforces capacity/conflicts/working hours/exceptions.
- Staff checks in patient.
- Doctor starts visit.
- Doctor edits notes.
- Doctor completes visit.
- Doctor sends billing handoff.
- Staff converts handoff to invoice.
- Staff records payment.
- Staff gets print data.

## X-ray / AI

- Doctor uploads saved X-rays.
- Staff/Admin read saved X-rays/AI read-only.
- Staff cannot upload/run AI.
- External X-ray/AI is available to Admin and Doctor only.
- Staff denied external X-ray/AI.
- Admin cannot attach external result to patient.
- Doctor can attach external result to patient.
- AI disclaimer exists.
- protected file endpoints enforce auth/permission.

## Billing

- Doctor cannot create invoices/payments.
- Staff owns invoice/payment workflow.
- Admin billing read-only.
- currency mismatch rejected.
- overpayment rejected.
- cancelled invoice cannot be paid.

## Tests

- all module tests pass.
- all workflow tests pass.
- all role denial tests pass.
- `python manage.py check` passes.
- `python manage.py makemigrations --check --dry-run` passes.
- `pytest -q` passes.

## Security

- no public predictable X-ray/overlay URLs.
- no DEBUG true in production settings.
- no secrets committed.
- CORS is not wildcard in production.
- audit logs for important actions.
