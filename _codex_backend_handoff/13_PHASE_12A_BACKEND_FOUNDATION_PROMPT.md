# Phase 12A — Backend Foundation Prompt


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

Create or repair the Django backend foundation so future phases can implement models/APIs/tests safely.

## Scope

Implement/verify:

- Django project layout under `backend/` if not already present.
- settings split or clean settings suitable for local/test/production.
- installed apps foundation.
- DRF installed/configured.
- PostgreSQL-ready configuration via environment variables.
- pytest + pytest-django configuration.
- basic common app utilities if needed.
- `.env.example` with required variables.
- `/api/` URL root.
- optional `/api/health/` endpoint for smoke test.
- consistent error response helper placeholder.

## Do Not Implement Yet

- full accounts/auth
- patients
- appointments
- visits
- X-rays
- billing
- frontend

## Tests Required

Create/verify tests:

- `FND-001` Django system check passes.
- `FND-002` pytest runs.
- `FND-003` health endpoint returns ok if implemented.
- `FND-004` no `/api/v1/` route is introduced.
- `FND-005` basic error helper shape if implemented.

## Commands To Run

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
