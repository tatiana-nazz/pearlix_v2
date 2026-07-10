# Phase 12G — Saved Patient X-rays and AI Results Prompt


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

Implement saved patient/visit X-rays, protected file access, AI result model, mock AI adapter, and saved X-ray AI endpoints.

## Scope

Implement:

- XrayAttachment model.
- AIResult model for saved X-rays.
- X-ray file upload validation.
- upload X-ray to visit.
- upload X-ray to patient profile.
- list/detail saved X-rays.
- protected X-ray file endpoint.
- protected AI overlay endpoint.
- run AI on saved X-ray.
- get AI result.
- deterministic mock AI adapter.
- required AI disclaimer.

## Endpoints

- `GET /api/xrays/`
- `GET /api/xrays/{id}/`
- `GET /api/xrays/{id}/file/`
- `GET /api/xrays/{id}/ai-overlay/`
- `POST /api/visits/{visit_id}/xrays/`
- `POST /api/patients/{patient_id}/xrays/`
- `POST /api/xrays/{id}/run-ai/`
- `GET /api/xrays/{id}/ai-result/`

## Permissions

- Admin read-only saved X-rays/AI.
- Staff read-only saved X-rays/AI inside patient profile.
- Doctor upload/run/view.

## Security Rules

- Allowed original: png/jpg/jpeg.
- Reject pdf/svg/exe/zip/double extensions where possible.
- No public predictable file URLs.
- Protected endpoints check permission.
- AI cannot update diagnosis/treatment.

## Tests Required

Implement XAI-001 through XAI-013.

Add protected media tests:

- anonymous denied.
- staff read-only saved allowed.
- upload denied staff/admin.
- invalid file rejected.
- AI result has disclaimer.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/xrays -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
