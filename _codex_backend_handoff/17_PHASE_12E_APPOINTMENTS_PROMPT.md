# Phase 12E — Appointments and Capacity Prompt


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

Implement appointments, capacity logic, doctor conflict logic, availability preview, and status transitions.

## Scope

Implement:

- Appointment model.
- Appointment list/detail/create/update.
- Availability preview.
- Check-in/cancel/no-show actions.
- Capacity service.
- Doctor overlap/conflict service.
- Working hours validation.
- Availability exception validation.
- Transaction around appointment create/update.

## Critical Rules

- Capacity is exact start_datetime.
- Count statuses: UPCOMING, CHECKED_IN, ACTIVE.
- Ignore statuses: COMPLETED, CANCELLED, NO_SHOW.
- Admin cannot override capacity.
- Doctor cannot create appointment.
- Staff only creates/updates/checks in/cancels/no-shows.
- Doctor cannot have overlapping active appointments.

## Endpoints

- `GET /api/appointments/`
- `POST /api/appointments/`
- `GET /api/appointments/{id}/`
- `PATCH /api/appointments/{id}/`
- `POST /api/appointments/{id}/check-in/`
- `POST /api/appointments/{id}/cancel/`
- `POST /api/appointments/{id}/no-show/`
- `GET /api/appointments/availability/`

## Tests Required

Implement APT-001 through APT-017.

Implement workflow tests if possible:

- WF-002 Appointment Capacity Workflow.
- WF-003 Doctor Conflict Workflow.

At minimum add unit tests for capacity and conflict services, plus API tests.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/scheduling tests/workflows -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
