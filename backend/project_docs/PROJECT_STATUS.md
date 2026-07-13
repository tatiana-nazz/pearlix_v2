# Project Status

This is the canonical current-phase tracker for the Dental Clinic Management System Website.

- Current completed phase: Phase 14D automated acceptance
- Current phase: Phase 14E supporting operations (in progress)
- Completed Phase 14E Tasks: Schedules and Leave; Visits
- Next Phase 14E task: X-rays and AI
- Frontend regression baseline: 43 files, 157 tests
- Focused Phase 14E schedule/leave backend verification: 83 passed
- Focused Phase 14E visit backend verification: 248 passed
- Django check: passed; migration drift: no changes detected
- Backend runtime changes in Phase 14E: no
- Migrations in Phase 14E: none
- Browser QA/UAT: pending for the Phase 14F visual acceptance gate
- Release recommendation: deployment remains paused pending remaining Phase 14E work, Phase 14F, and browser visual/UAT evidence.

Phase 14D automated acceptance is complete. Phase 14E is in progress: Schedules and Leave plus Visits are complete with 43 frontend files / 157 tests, 83 focused schedule/leave backend tests, and 248 focused visit backend tests. X-rays/AI, Billing, Clinic Settings, and Audit have not started. Browser QA remains the explicitly deferred Phase 14F visual/UAT gate. The backend API, permissions, serializers, models, and migrations remain unchanged; backend runtime changed: no; migrations: none.

Remaining post-MVP limitations include real AI integration, email forgot-password, unsupported professional fields, online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.

## Historical context

Phase 13 is complete. Phase 14A provided deterministic development data; Phase 14B froze the UI refocus design; Phase 14C.0 added Team/account-linkage APIs; and Phase 14C added shell, token, icon, preference, and shared-component foundations.
