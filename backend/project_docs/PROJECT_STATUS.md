# Project Status

This is the canonical current-phase tracker. Other project documents describe capabilities and defer current/next-phase status to this file.

Project: Dental Clinic Management System Website

Phase 14D browser acceptance is delivered after Phase 14D.4A patient workspace contract closure. Live Admin, Staff, and Doctor browser execution closed responsive RTL overflow and static shell-navigation localization defects without changing backend runtime contracts. The backend regression gate remains closed with 420 passing tests.

- Current completed phase: 14D Browser Acceptance Gate
- Phase 13 series: complete
- Next phase: Phase 14E workflow redesigns
- Next step: begin Phase 14E workflow redesign planning
- Final backend full regression: 420 passed
- Final frontend regression: 113 passed in 40 files
- Backend runtime changes in Phase 14C: no
- Migrations in Phase 14C: none
- Backend runtime changes in Phase 14C.0: yes
- Frontend visible UI changes in Phase 14C: shell/token/shared-component foundation
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
