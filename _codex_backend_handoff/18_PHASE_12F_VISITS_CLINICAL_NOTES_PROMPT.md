# Phase 12F — Visits and Clinical Notes Prompt


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

Implement visit lifecycle and clinical note permissions.

## Scope

Implement:

- Visit model.
- list/detail visits.
- `/api/visits/active/` for doctor.
- start visit from checked-in appointment.
- complete visit.
- clinical notes update endpoint.
- one active visit per doctor rule.
- doctor completed-notes-edit-forever rule.
- created_at/updated_at/updated_by on notes through model timestamps.

## Endpoints

- `GET /api/visits/`
- `GET /api/visits/{id}/`
- `GET /api/visits/active/`
- `POST /api/appointments/{id}/start-visit/`
- `PATCH /api/visits/{id}/clinical-notes/`
- `POST /api/visits/{id}/complete/`

## Permissions

- Admin read-only.
- Staff read-only.
- Doctor starts/completes/edits own/relevant visits.

## Tests Required

Implement VIS-001 through VIS-012.

Implement workflow test:

- WF-004 Clinical Permission Workflow.

Add regression tests for:

- staff/admin cannot edit notes.
- doctor can edit completed notes.
- starting another doctor's visit denied.
- one active visit per doctor.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/visits tests/workflows -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
