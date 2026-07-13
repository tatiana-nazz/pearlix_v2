# Project Status

This is the canonical current-phase tracker for the Dental Clinic Management System Website.

- Current phase: Phase 14D acceptance-test closure in progress
- Next phase: Phase 14E — Schedules and Leave, Visits, X-rays and AI, Billing, Clinic Settings, and Audit
- Frontend regression baseline: 38 files, 104 tests
- Focused backend verification baseline: Team/account and Users/role transition 35 passed; appointments 39 passed; patients and IDOR/security 25 passed
- Full backend verification: 414 passed
- Backend runtime changes in Phase 14D: no
- Migrations in Phase 14D: none
- Browser QA/UAT: pending for the Phase 14F visual acceptance gate
- Release recommendation: deployment remains paused pending acceptance-test closure, Phase 14E, Phase 14F, and browser visual/UAT evidence.

Phase 14D acceptance-test closure is in progress for shared overlays, Team, Users & Access, New Patient, Patient Profile, patient list, and Doctor clinical-history routing. Phase 14E has not started. Browser QA remains the Phase 14F visual/UAT gate. The backend API, permissions, serializers, models, and migrations remain unchanged; backend runtime changed: no; migrations: none.

Remaining post-MVP limitations include real AI integration, email forgot-password, unsupported professional fields, online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.

## Historical context

Phase 13 is complete. Phase 14A provided deterministic development data; Phase 14B froze the UI refocus design; Phase 14C.0 added Team/account-linkage APIs; and Phase 14C added shell, token, icon, preference, and shared-component foundations.
