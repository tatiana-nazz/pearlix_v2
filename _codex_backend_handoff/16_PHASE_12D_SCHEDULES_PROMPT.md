# Phase 12D — Schedules and Availability Prompt


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

Implement doctor working hours and availability exceptions before appointment booking.

## Scope

Implement:

- WorkingHour model.
- AvailabilityException model.
- doctor list endpoint if not already available.
- get/update doctor working hours.
- CRUD availability exceptions.
- schedule permission rules.
- validation for time ranges.

## Endpoints

- `GET /api/doctors/`
- `GET /api/doctors/{id}/working-hours/`
- `PUT /api/doctors/{id}/working-hours/`
- `GET /api/availability-exceptions/`
- `POST /api/availability-exceptions/`
- `GET /api/availability-exceptions/{id}/`
- `PATCH /api/availability-exceptions/{id}/`
- `DELETE /api/availability-exceptions/{id}/`

## Permissions

- Admin can edit schedules/exceptions.
- Staff read-only.
- Doctor read own/relevant.

## Tests Required

Implement tests SCH-001 through SCH-007.

Also test:

- weekday validation.
- exactly one doctor/staff set if both models are supported.
- unauthenticated denied.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/scheduling -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
