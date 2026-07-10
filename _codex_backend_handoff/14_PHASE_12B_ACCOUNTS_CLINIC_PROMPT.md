# Phase 12B — Accounts, Roles, Auth, Clinic Settings Prompt


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

Implement users, roles, authentication, current user/preferences, user management, and clinic settings.

## Scope

Implement:

### Accounts

- custom User model if not already created.
- role enum: ADMIN, STAFF, DOCTOR.
- theme_preference: LIGHT/DARK/SYSTEM.
- language_preference: EN/AR.
- DoctorProfile and StaffProfile if useful.
- auth endpoints under `/api/auth/`.
- `/api/me/`.
- `/api/me/preferences/`.
- admin-only user management endpoints.
- deactivate user endpoint.

### Clinic

- ClinicSettings one-row model.
- `/api/clinic/settings/` GET/PATCH.
- Admin-only PATCH.
- capacity/duration/currency/language validation.

### Seed/dev convenience

If project has management commands, add optional seed command for admin/staff/doctor users. Keep safe and documented.

## Permissions

- Users management: Admin only.
- Clinic settings PATCH: Admin only.
- Staff/Doctor denied for management.

## Tests Required

Implement tests from:

- ACC-001 through ACC-012.
- CLN-001 through CLN-007.

Also test:

- inactive user cannot login.
- invalid role cannot be created.
- preferences persist.
- `/api/` base path used.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/accounts tests/clinic -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
