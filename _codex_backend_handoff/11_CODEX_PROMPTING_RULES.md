# Codex Prompting and Execution Rules

This file exists to keep Codex efficient and prevent hallucinated implementation.

---

## 1. How Codex Should Work

For each phase:

1. Read required docs.
2. Inspect repository.
3. Identify existing code patterns.
4. Implement only the requested scope.
5. Add tests.
6. Run checks/tests.
7. Report only final summary.

---

## 2. Do Not Do This

- Do not implement future phases early.
- Do not change frontend.
- Do not add patient portal.
- Do not change `/api/` to `/api/v1/`.
- Do not invent roles.
- Do not remove tests.
- Do not skip tests silently.
- Do not leave TODOs for core phase behavior.
- Do not print excessive command output in final report.
- Do not say “done” if tests were not run.

---

## 3. Test Completion Rule

Use this exact standard:

```text
This phase is not complete until relevant tests are added/updated and passing, or any failing/blocking test is clearly reported with exact command, exact failure, and reason.
```

---

## 4. Final Report Template

```text
Phase completed: <phase>

Files created/modified:
- path: purpose

Behavior implemented:
- ...

Tests/checks run:
- python manage.py check — passed/failed
- python manage.py makemigrations --check --dry-run — passed/failed
- pytest <target> — passed/failed

Failures/blockers:
- none / details

Notes:
- any implementation decisions or deviations

Next recommended phase:
- <phase>
```

---

## 5. Reasoning Setting Guidance

Use Medium for narrow setup/simple CRUD phases.
Use High for permissions, workflow, and business rules.
Use Extra High only for cross-module security/QA or external X-ray/AI attach logic.

Recommended:

- 12A Foundation: Medium
- 12B Accounts/Clinic: High
- 12C Patients: Medium
- 12D Schedules: Medium/High
- 12E Appointments: High
- 12F Visits: High
- 12G Saved X-rays/AI: High
- 12H External X-ray/AI: Extra High
- 12I Billing: High
- 12J Dashboards/Audit/Protected Media Polish: High
- 12K Security QA Regression: Extra High
