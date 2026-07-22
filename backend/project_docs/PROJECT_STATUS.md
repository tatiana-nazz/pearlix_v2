# Project Status

This is the canonical current-phase tracker for the Dental Clinic Management System Website.

- Current completed phase: **Phase 14F browser visual/UAT acceptance**
- Phase 14D priority-workflow automated acceptance: complete
- Phase 14E supporting-operations automated acceptance: complete
- Phase 14F runtime-and-evidence commit: `4d8f00cdeed0001c1ee8de5fc47d9ec3917f4877`
- Browser evidence: `frontend/design_v2/phase14f_evidence/current_head_acceptance/`
- Frontend verification: 68 test files, 236 tests; TypeScript typecheck and production build passed
- Focused protected-media backend verification: 50 passed
- Full backend verification: 423 passed
- Django check passed; migration drift: no changes detected
- Backend runtime modified in Phase 14F: no; migrations: none
- Browser QA/UAT: complete for the required Staff, Admin, and Doctor matrix; console and network gates passed
- Release recommendation: the Phase 14F browser acceptance gate is complete. Proceed only through the repository’s normal deployment controls.

Phase 14F re-verified the historical 14F-FINAL-01 through 14F-FINAL-05 findings against the runtime-and-evidence commit above. The responsive geometry, Staff-safe Team access, setup-required Team cards, Arabic/RTL status copy, and documented no-active-visit empty state all passed. The pass also corrected protected-media requests whose API-rooted serializer links otherwise produced a doubled `/api/api/` path in the browser. No schema or backend contract change was required.

Post-Phase-14F activity: medical-blue visual-alignment Stage 1 is complete for frontend global tokens and shared components, and Stage 2 dashboard composition alignment is complete for Staff, Admin, and Doctor. Phase 14F remains complete; Stage 2 made no functional or backend change and added no migration. Evidence: `frontend/design_v2/design_alignment_evidence/dashboards/`.

Remaining post-MVP limitations include real AI integration, email forgot-password, unsupported professional fields, online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.

## Historical context

Phase 13 is complete. Phase 14A provided deterministic development data; Phase 14B froze the UI refocus design; Phase 14C.0 added Team/account-linkage APIs; Phase 14C added shell, token, icon, preference, and shared-component foundations; Phase 14D completed priority workflows; Phase 14E completed supporting operations; and Phase 14F completed browser visual/UAT acceptance.
