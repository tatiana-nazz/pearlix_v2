# Phase 12I — Billing Handoffs, Invoices, Payments Prompt


## Mandatory Start

Before coding, read:

- `_codex_backend_handoff/00_CODEX_START_HERE.md`
- `_codex_backend_handoff/01_PROJECT_SOURCE_OF_TRUTH_DETAILED.md`
- `_codex_backend_handoff/02_BACKEND_ARCHITECTURE_DETAILED.md`
- `_codex_backend_handoff/03_DATA_MODEL_DETAILED.md`
- `_codex_backend_handoff/04_PERMISSIONS_MATRIX_DETAILED.md`
- `_codex_backend_handoff/05_API_CONTRACT_DETAILED.md`
- `_codex_backend_handoff/06_SECURITY_THREAT_MODEL_DETAILED.md`
- `_codex_backend_handoff/07_TESTING_MASTER_PLAN.md`
- `_codex_backend_handoff/08_TEST_CASE_MATRIX_BY_MODULE.md`
- `_codex_backend_handoff/10_PYTEST_FIXTURES_AND_FACTORIES.md`
- `_codex_backend_handoff/11_CODEX_PROMPTING_RULES.md`

Then inspect the repository. Preserve existing good structure.

## Global Constraints

- API base is `/api/`, not `/api/v1/`.
- Backend only. Do not implement frontend.
- Do not add out-of-scope features.
- Add/update tests in this phase.
- Run relevant tests/checks.
- Final report only; no command narration.


## Objective

Implement doctor billing handoff, staff invoice creation/conversion, payments, status calculation, and print data.

## Scope

Implement:

- BillingHandoff model.
- Invoice model.
- Payment model.
- doctor create billing handoff.
- staff convert handoff to invoice.
- staff dismiss handoff.
- invoice list/detail/create/update/cancel.
- payment creation.
- invoice print-data endpoint.
- invoice status calculation.
- payment currency validation.
- no overpayment.
- no payment on cancelled invoice.

## Endpoints

- `GET /api/billing-handoffs/`
- `GET /api/billing-handoffs/{id}/`
- `POST /api/visits/{visit_id}/billing-handoff/`
- `POST /api/billing-handoffs/{id}/dismiss/`
- `POST /api/billing-handoffs/{id}/convert-to-invoice/`
- `GET /api/invoices/`
- `POST /api/invoices/`
- `GET /api/invoices/{id}/`
- `PATCH /api/invoices/{id}/`
- `POST /api/invoices/{id}/cancel/`
- `POST /api/invoices/{id}/payments/`
- `GET /api/invoices/{id}/print-data/`

## Permissions

- Doctor creates handoff only.
- Staff converts handoff and handles invoices/payments.
- Admin read-only.
- Doctor denied invoice/payment management.

## Tests Required

Implement BIL-001 through BIL-019.

Implement workflow:

- WF-008 Billing Workflow.

Add calculation tests:

- UNPAID at 0 paid.
- PARTIALLY_PAID at partial.
- PAID at exact total.
- CANCELLED overrides payment status.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/billing tests/workflows -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
