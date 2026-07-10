# Phase 12H — External X-ray/AI Workspace Prompt


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

Use Extra High. This phase has cross-object permissions and attach/copy behavior.

## Objective

Implement the external X-ray/AI dashboard backend: temporary upload, AI run/result, protected files, discard, and doctor-only attach to patient.

## Scope

Implement:

- ExternalXrayCase model.
- external X-ray list/create/detail.
- protected external file endpoint.
- run AI on external X-ray.
- get external AI result.
- protected external overlay endpoint.
- discard external case.
- attach external case to patient.
- link/copy AI result when attached.
- status transitions: TEMPORARY, ATTACHED_TO_PATIENT, DISCARDED.

## Endpoints

- `GET /api/external-xrays/`
- `POST /api/external-xrays/`
- `GET /api/external-xrays/{id}/`
- `GET /api/external-xrays/{id}/file/`
- `POST /api/external-xrays/{id}/run-ai/`
- `GET /api/external-xrays/{id}/ai-result/`
- `GET /api/external-xrays/{id}/ai-overlay/`
- `POST /api/external-xrays/{id}/attach-to-patient/`
- `POST /api/external-xrays/{id}/discard/`

## Permissions

- Admin: list/create/detail/file/run-ai/result/overlay/discard.
- Doctor: list/create/detail/file/run-ai/result/overlay/discard/attach.
- Staff: denied for all external X-ray endpoints.
- Admin cannot attach.
- Doctor can attach only to accessible patient.

## Critical Attach Behavior

When doctor attaches external case:

1. external case must be TEMPORARY.
2. create saved XrayAttachment with source EXTERNAL_WORKSPACE.
3. attach to patient_id and optional visit_id.
4. if external AI result exists, link/copy it to saved XrayAttachment.
5. mark external case ATTACHED_TO_PATIENT.
6. set attached_patient and attached_xray_attachment.
7. reject second attach.

## Tests Required

Implement EXT-001 through EXT-014.

Implement workflows:

- WF-005 External X-ray Admin Temporary Workflow.
- WF-006 External X-ray Doctor Attach Workflow.
- WF-007 Staff External X-ray Denial Workflow.

## Commands To Run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
pytest tests/xrays tests/workflows -q
pytest -q
```

## Final Report

Use the template in `11_CODEX_PROMPTING_RULES.md`.
