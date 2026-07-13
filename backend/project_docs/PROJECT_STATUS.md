# Project Status

This is the canonical current-phase tracker for the Dental Clinic Management System Website.

- Current completed phase: Phase 14D automated acceptance
- Current phase: Phase 14E supporting operations (in progress)
- Completed Phase 14E Tasks: Schedules and Leave; Visits; X-rays and AI; Billing
- Current Phase 14E task: Clinic Settings and Audit
- Next Phase 14E tasks: Clinic Settings and Audit
- Frontend regression baseline: 54 files, 176 tests
- Focused Phase 14E schedule/leave backend verification: 83 passed
- Focused Phase 14E visit backend verification: 248 passed
- Focused Phase 14E X-ray/AI backend verification: 131 passed
- Focused Phase 14E Billing backend verification: 71 passed
- Django check: passed; migration drift: no changes detected
- Backend runtime changes in Phase 14E: no
- Migrations in Phase 14E: none
- Browser QA/UAT: pending for the Phase 14F visual acceptance gate
- Release recommendation: deployment remains paused pending remaining Phase 14E work, Phase 14F, and browser visual/UAT evidence.

Phase 14D automated acceptance is complete. Phase 14E is in progress: Schedules and Leave, Visits, X-rays/AI, and Billing are complete. Billing acceptance now has typed EN/AR runtime copy, role-bound production page evidence for handoffs, invoices, payments, and print, and POST-only cancellation/dismissal coverage. Clinic Settings and Audit have not started and are the next Phase 14E tasks. Browser QA remains the explicitly deferred Phase 14F visual/UAT gate. The backend API, permissions, serializers, models, and migrations remain unchanged; backend runtime changed: no; migrations: none.

Remaining post-MVP limitations include real AI integration, email forgot-password, unsupported professional fields, online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.

## Historical context

Phase 13 is complete. Phase 14A provided deterministic development data; Phase 14B froze the UI refocus design; Phase 14C.0 added Team/account-linkage APIs; and Phase 14C added shell, token, icon, preference, and shared-component foundations.
