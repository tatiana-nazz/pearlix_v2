# Backend Phase Plan — Detailed

Do not give Codex all phases at once. Give one phase prompt at a time.

---

## Recommended Phase Sequence

| Phase | Name | Reasoning |
|---|---|---|
| 12A | Backend Foundation | Medium |
| 12B | Accounts, Roles, Auth, Clinic Settings | High |
| 12C | Patients | Medium |
| 12D | Schedules and Availability | Medium/High |
| 12E | Appointments and Capacity | High |
| 12F | Visits and Clinical Notes | High |
| 12G | Saved Patient X-rays and AI Results | High |
| 12H | External X-ray/AI Workspace | Extra High |
| 12I | Billing Handoffs, Invoices, Payments | High |
| 12J | Dashboards, Audit, Protected Media Polish | High |
| 12K | Security/Workflow QA Regression | Extra High |
| 12L | Deployment Prep Optional | Medium |

---

## Why This Order

1. Foundation first so settings/tests are stable.
2. Accounts/roles before permissions.
3. Patients before appointments.
4. Schedules before appointment validation.
5. Appointments before visits.
6. Visits before clinical X-rays and billing handoff.
7. Saved X-rays/AI before external X-ray/AI attach.
8. Billing after visits.
9. Dashboards/audit after core data exists.
10. Security QA after all endpoints exist.

---

## Review Gate Between Phases

After each phase, the user should send Codex's final report to ChatGPT for review before continuing.

Do not proceed if:

- tests were skipped without reason
- migrations are missing
- `/api/v1/` appears
- permissions contradict docs
- Codex implemented future scope incorrectly
- endpoints are unwired
- imports/settings are broken
- generated code uses public media URLs for X-rays
