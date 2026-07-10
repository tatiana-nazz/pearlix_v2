# Phase 12K — Backend Security and QA Regression Prompt


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


## Recommended Reasoning

Use Extra High. This phase reviews the full backend across modules.

## Objective

Run a full backend security, permission, workflow, and test-quality pass.

## Scope

Do not add new product features. Fix bugs, missing tests, permission leaks, inconsistent errors, missing routes, broken migrations, and test gaps.

## Required Review Areas

1. API base path is `/api/` only.
2. No `/api/v1/` endpoints.
3. Admin read-only operational restrictions.
4. Staff cannot clinical/X-ray/AI external actions.
5. Doctor cannot billing/payment actions.
6. Staff cannot access external X-ray/AI dashboard APIs.
7. Admin cannot attach external X-ray to patient.
8. Doctor can attach external X-ray to patient.
9. Appointment capacity and conflicts are backend-enforced.
10. Clinical notes permissions are backend-enforced.
11. File upload validation works.
12. Protected file endpoints work.
13. AI disclaimer always present.
14. Invoice/payment validation works.
15. Workflow tests pass.
16. Audit logs exist for important actions.

## Required Tests

Run or create tests covering:

- all test case IDs in `08_TEST_CASE_MATRIX_BY_MODULE.md`
- all workflows in `09_WORKFLOW_E2E_TESTS.md`
- security regressions in `06_SECURITY_THREAT_MODEL_DETAILED.md`

## Commands To Run

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
pytest -q
```

If tests fail, fix in-scope bugs and rerun.

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`, but include:

- total tests passed/failed
- unresolved risk list
- backend readiness status: READY / NOT READY
