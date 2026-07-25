# CODEX START HERE — Backend Implementation Handoff V2

# HISTORICAL / SUPERSEDED — NOT CURRENT IMPLEMENTATION AUTHORITY

Replacement: [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md). Authority register: [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). This folder remains useful Phase 12 historical evidence only; it must not override current project, role, UI, or runtime decisions.

Project: Dental Clinic Management System Website  
Backend: Django + Django REST Framework + PostgreSQL  
API base path: `/api/`  
Purpose: one-clinic dental clinic management system for a graduation project.

This folder is the backend source of truth. Codex must treat these files as local project documentation and must read the relevant files before editing code.

IMPORTANT POST-12K CORRECTION:
Future backend phases must read `25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH.md`.
If older handoff files conflict with that correction file, `25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH.md` wins.

---

## 1. Mandatory Codex Workflow Before Every Phase

Before starting any backend phase, do this silently and efficiently:

1. Read `00_CODEX_START_HERE.md`.
2. Read the phase prompt file.
3. Read the source-of-truth files referenced by the phase prompt.
4. Inspect the repository structure.
5. Implement only the requested phase scope.
6. Add/update tests for the phase.
7. Run checks/tests.
8. Give one concise final report.

Do not narrate commands while working. The final report is enough.

Suggested initial inspection commands:

```bash
pwd
find . -maxdepth 3 -type f | sort | sed 's#^./##' | head -300
```

If a backend already exists:

```bash
find backend -maxdepth 4 -type f | sort | head -400
```

---

## 2. Mandatory Reading Map

For every backend phase, always read:

- `01_PROJECT_SOURCE_OF_TRUTH_DETAILED.md`
- `02_BACKEND_ARCHITECTURE_DETAILED.md`
- `03_DATA_MODEL_DETAILED.md`
- `04_PERMISSIONS_MATRIX_DETAILED.md`
- `05_API_CONTRACT_DETAILED.md`
- `06_SECURITY_THREAT_MODEL_DETAILED.md`
- `07_TESTING_MASTER_PLAN.md`
- `11_CODEX_PROMPTING_RULES.md`
- The phase-specific prompt.

For test-heavy phases, also read:

- `08_TEST_CASE_MATRIX_BY_MODULE.md`
- `09_WORKFLOW_E2E_TESTS.md`
- `10_PYTEST_FIXTURES_AND_FACTORIES.md`

---

## 3. Hard Scope Rules

Do not add features outside these docs.

Do not add:

- patient portal
- multi-clinic/multi-branch tenancy
- insurance
- itemized service catalog
- tax/discount accounting
- online payment gateway
- complex permission matrix UI
- websocket/live notifications
- frontend implementation
- manual AI import workflow
- public media URLs for X-rays

---

## 4. Credit Preservation Rules

Use Codex time and tokens for implementation, tests, and debugging, not long explanations.

During the task:

- Do not write long planning essays.
- Do not print full file contents unless needed.
- Do not explain every command.
- Do not re-summarize all requirements.
- Do not rewrite docs unless asked.
- Do not build future phases early.

Final response only:

```text
Phase completed: <phase name>
Files created/modified:
- ...
Tests/checks run:
- command — passed/failed
Important behavior implemented:
- ...
Failures/blockers:
- none / details
Next recommended phase:
- ...
```

---

## 5. Definition of Phase Done

A backend phase is not done until:

- The requested functionality is implemented.
- Relevant serializers/views/services/permissions/urls are wired.
- Relevant tests are added or updated.
- `python manage.py check` passes.
- Migrations are created when models change.
- Tests for that phase pass, or failures are explicitly reported with exact cause.
- The implementation stays within `/api/` base path.
- No unrelated modules are changed without reason.

---

## 6. Global Backend Principles

- Use Django REST Framework.
- Use PostgreSQL-compatible models and constraints.
- Keep apps modular but not overengineered.
- Put business rules in services/selectors where appropriate, not scattered across serializers and views.
- Backend permissions are final; frontend hiding is only UX.
- Prefer object-level permission checks for patient, appointment, visit, X-ray, external X-ray, billing, and invoice objects.
- Use consistent API errors.
- Keep tests readable, maintainable, and deterministic.
- Use factories/fixtures instead of huge repeated setup in tests.
