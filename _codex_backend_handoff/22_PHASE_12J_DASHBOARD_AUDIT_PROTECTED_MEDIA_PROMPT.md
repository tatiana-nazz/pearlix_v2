# Phase 12J — Dashboards, Audit, Protected Media Polish Prompt


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

Implement role-specific dashboard summaries, activity logs, and polish protected media access across saved/external X-ray/AI.

## Scope

Implement:

- ActivityLog model/service if not already done.
- log important actions from prior modules.
- admin dashboard summary.
- staff dashboard summary.
- doctor dashboard summary.
- protected media consistency checks.
- patient profile relation endpoints if not fully completed.
- response permissions objects where useful for frontend.

## Dashboard Endpoints

- `GET /api/dashboard/admin/`
- `GET /api/dashboard/staff/`
- `GET /api/dashboard/doctor/`

## Audit Events To Wire

At minimum log:

- patient_created
- patient_updated
- appointment_created
- appointment_checked_in
- visit_started
- clinical_notes_updated
- visit_completed
- xray_uploaded
- external_xray_uploaded
- external_xray_attached_to_patient
- ai_run_completed or ai_run_failed
- billing_handoff_created
- billing_handoff_converted
- invoice_created
- payment_recorded

## Tests Required

Implement DSH-001 through DSH-003 and AUD-001 through AUD-005 where possible.

Implement workflow:

- WF-009 Protected Media Workflow.
- WF-010 Admin Read-only Workflow.

Also ensure all previous workflows still pass.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/dashboard tests/audit tests/security tests/workflows -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
