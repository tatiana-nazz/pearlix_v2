# Project Status

This is the canonical current-phase tracker for the Dental Clinic Management System Website.

- Current completed phase: Phase 14D automated acceptance
- Current phase: Phase 14E supporting operations automated acceptance: complete
- Completed Phase 14E Tasks: Schedules and Leave; Visits; X-rays and AI; Billing; Clinic Settings; Audit
- Next phase: Phase 14F browser visual/UAT acceptance is next
- Frontend regression baseline: 60 files, 213 tests
- Focused Phase 14E schedule/leave backend verification: 83 passed
- Focused Phase 14E visit backend verification: 248 passed
- Focused Phase 14E X-ray/AI backend verification: 131 passed
- Focused Phase 14E Billing backend verification: 71 passed
- Focused Phase 14E Clinic/Audit backend verification: 170 passed
- Full backend verification: 414 passed
- Django check passed; migration drift: no changes detected
- Backend runtime modified: no
- Migrations: none
- Browser QA/UAT: pending for the Phase 14F visual acceptance gate
- Release recommendation: deployment remains paused pending Phase 14F browser visual/UAT evidence.

Phase 14D automated acceptance is complete. Phase 14E supporting operations automated acceptance: complete. Visits, X-rays/AI, Billing, Clinic Settings, and Audit remain covered by the current automated acceptance. Phase 14F Task M changes billing so the Doctor enters the final charge after completing the Visit and the system atomically creates the official Invoice immediately. Staff does not approve or convert the charge; Staff records Payments and performs permitted audited corrections; Admin is read-only. Browser QA remains pending for the final Phase 14F browser visual/UAT acceptance. Deployment remains paused. Migrations: none.

Remaining post-MVP limitations include real AI integration, email forgot-password, unsupported professional fields, online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.

## Historical context

Phase 13 is complete. Phase 14A provided deterministic development data; Phase 14B froze the UI refocus design; Phase 14C.0 added Team/account-linkage APIs; and Phase 14C added shell, token, icon, preference, and shared-component foundations.
