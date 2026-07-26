# Project Status

**Authority marker:** `CURRENT_CANONICAL_PROJECT_STATUS`
Read [`../../CODEX_START_HERE.md`](../../CODEX_START_HERE.md) before using this tracker. Authority reconciliation is documentation governance only; it changes no runtime behavior. The reconciled v2 runtime lineage continues from `e54a858`; Phase 14F visually adopts the supplied reference pack on starting commit `78052117fb7014932ff407226923567b0d788b6d` while preserving current runtime authority. The rejected pre-v2 preview (`preview-pre-v2-ui`, `bdd5f6f`) is not an implementation source. Team and Users & Access remain separate; active Doctors have all-active/non-archived patient access as summarized in `CURRENT_BACKEND_DECISIONS.md`.

This is the canonical current-phase tracker. Other project documents describe capabilities and defer current/next-phase status to this file.

Project: Dental Clinic Management System Website

Phase 14D browser acceptance is delivered after Phase 14D.4A patient workspace contract closure. Live Admin, Staff, and Doctor browser execution closed responsive RTL overflow and static shell-navigation localization defects without changing backend runtime contracts. The backend regression gate remains closed with 420 passing tests.

Local login connectivity is now deterministic: the documented frontend uses `127.0.0.1:5173` with Vite strict-port behavior, and the local CORS/CSRF example is aligned to that origin. See `frontend/design_v2/LOCAL_LOGIN_NETWORK_FIX_RECORD.md`.

- Current phase: 14F Full Frontend Visual Source Adoption — delivered
- Phase 13 series: complete
- Next phase: no phase is implicitly authorized; use a new approved scope
- Next step: preserve the Phase 14F visual system and current runtime/RBAC contracts
- Final backend full regression: 420 passed
- Final frontend regression: 136 passed in 47 files
- Final browser regression: 7 passed in Chromium, including 4 Phase 14F visual acceptance tests
- Backend runtime changes in Phase 14C: no
- Migrations in Phase 14C: none
- Backend runtime changes in Phase 14C.0: yes
- Frontend visible UI changes in Phase 14C: shell/token/shared-component foundation
- Frontend visible UI changes in Phase 14E.1: shared action menu, row-action consolidation, and primary/secondary/danger hierarchy
- Frontend visible UI changes in Phase 14E.1A: collection records have no mutation or overflow controls; record actions are available only after opening detail
- Frontend visible UI changes in Phase 14E.2: active visit patient/visit summary, one accessible clinical tab workspace, localized notes and state feedback, read-first patient context, protected X-ray access, and existing billing handoff alignment
- Frontend visible UI changes in Phase 14E.2A: Doctor Start visit action connected to the opened checked-in appointment detail; real browser acceptance closure completed
- Frontend visible UI changes in Phase 14E.3: action-free billing handoff/invoice collections, backend-derived visible-page financial summaries, detail-first Staff operations, readable payment/print detail, Doctor global Billing navigation removal, and browser billing acceptance
- Backend runtime changes in Phase 14E.3: none
- Migrations in Phase 14E.3: none
- Phase 14E.3A: documentation validation evidence closure; `scripts/check_documentation_consistency.py` passed
- Backend runtime changes in Phase 14E.3A: none
- Migrations in Phase 14E.3A: none
- Frontend visible UI changes in Phase 14E.4: action-free X-ray/attachment collections, shared upload modal, protected viewer hierarchy, structured stored-result/overlay presentation, and external temporary-case detail alignment
- Backend runtime changes in Phase 14E.4: none
- Migrations in Phase 14E.4: none
- Phase 14E.4 historical acceptance note: the original browser surface limitation is superseded by the closed Phase 14F protected-media Chromium acceptance
- Frontend visible UI changes in Phase 14F: supplied reference tokens, shell, navigation, topbar, shared components, overlays, appointments, profiles, Team/Users & Access, dashboards, Active Visit, Billing, X-ray/AI, authentication, and settings adopted across every current route family
- Phase 14F protected-media acceptance: authenticated original pixels rendered with non-zero natural width and stored AI result in Chromium; accidental duplicated `/api/api/...` media paths are normalized in the frontend Blob client without public media URLs
- Backend runtime changes in Phase 14F: none
- API changes in Phase 14F: none
- Migrations in Phase 14F: none
- Backend runtime changes in Phase 14E.2A: none
- Migrations in Phase 14E.2A: none
- Backend runtime changes in Phase 14E.2: none
- Migrations in Phase 14E.2: none
- Backend runtime changes in Phase 14E.1: none
- Migrations in Phase 14E.1: none
- Frontend contract types, wrappers, and tests changed in Phase 14C.0: yes
- Migrations in Phase 14C.0: accounts.0005 adds User/DoctorProfile/StaffProfile optimistic-lock versions
- Backend runtime changes in Phase 14R: yes
- Migrations in Phase 14R: none
- Backend runtime changes in Phase 14D.2: yes — additive dashboard clinic-date/timezone fields only
- Migrations in Phase 14D.2: none
- Backend runtime changes in Phase 14D.3: yes — additive appointment-list clinic metadata and server-side search; archived patients excluded from appointment creation
- Migrations in Phase 14D.3: none
- Backend runtime changes in Phase 14D.3A: no - focused tests only; the existing patient list/search and archived-patient serializer contracts are consumed by the frontend picker
- Migrations in Phase 14D.3A: none
- Backend runtime changes in Phase 14D.4: none
- Migrations in Phase 14D.4: none
- Backend runtime changes in Phase 14D.4A: none
- Migrations in Phase 14D.4A: none
- Backend regression gate: closed
- Browser QA/UAT: Phase 14D integrated acceptance passed with seeded local QA accounts
- Release recommendation: deployment paused; complete Phases 14E–14F before controlled deployment

Completed capability summary: authenticated role workspaces; patient, scheduling, visit, X-ray/AI, and billing workflows; Admin account management, clinic settings, and audit-log visibility; deterministic development-only integrated demo story; the Phase 14B UI refocus design freeze; Phase 14C.0 Team APIs; Phase 14D.1 Team and Users & Access routes; Phase 14D.2 role dashboard redesign; and Phase 14R booking/availability stabilization. Team uses the User ID as its stable member ID, has transactional Doctor/Staff onboarding, profile optimistic locking, professional/login status separation, linkage-state reporting, protected role transitions, reactivation, and sanitized audit events. Phase 14A seed story remains available.

Remaining post-MVP limitations: real AI integration, email forgot-password, unsupported professional fields (gender, qualifications, license, profile photo, Staff biography, and activity notes), online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization. Phase 14D priority workspace redesigns and browser acceptance are delivered.
