# Phase 12C — Patients Prompt


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

Implement patient model, patient API, patient search, role permissions, and patient tests.

## Scope

Implement:

- Patient model from `03_DATA_MODEL_DETAILED.md`.
- patient list/search/detail/create/update endpoints.
- patient related endpoints placeholders or minimal summaries if related apps are not ready yet.
- phone-first/name-second search behavior where possible.
- computed age field.
- created_by/updated_by tracking.
- patient permissions.

## Endpoints

- `GET /api/patients/`
- `POST /api/patients/`
- `GET /api/patients/{id}/`
- `PATCH /api/patients/{id}/`
- `GET /api/patients/{id}/appointments/`
- `GET /api/patients/{id}/visits/`
- `GET /api/patients/{id}/xrays/`
- `GET /api/patients/{id}/ai-results/`
- `GET /api/patients/{id}/invoices/`

If related apps do not exist, related endpoints may return empty lists with correct permissions or be deferred explicitly.

## Permissions

- Admin read-only.
- Staff create/edit/read.
- Doctor read/edit.
- Unauthenticated denied.

## Tests Required

Implement tests PAT-001 through PAT-010.

Add negative tests:

- admin create denied and no patient is created.
- doctor create denied and no patient is created.
- admin update denied and patient unchanged.
- anonymous list/detail denied.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/patients -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
