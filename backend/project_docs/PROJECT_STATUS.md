# Project Status

This is the canonical current-phase tracker. Other project documents describe capabilities and defer current/next-phase status to this file.

Project: Dental Clinic Management System Website

Phase 14D.3A appointments contract closure is delivered: role-aware Day/Week/Month/List surfaces, Needs Reschedule routing, clinic-local appointment pagination metadata, and a bounded searchable active-patient picker now use the established scheduling contracts. Staff no longer enters raw patient IDs; selected results map only to `patient_id`, while backend serialization independently rejects archived patients. Phase 14D.2 role dashboards and Phase 14D.1 Team and Users & Access remain delivered. Phase 14R repaired the stale scheduling-test clock and booking/availability defects; the current backend regression gate remains closed with 420 passing tests. Remaining Phase 14D patient redesign work is pending.

- Current completed phase: 14D.3A Appointments Contract and Test-Coverage Closure
- Phase 13 series: complete
- Next phase: remaining Phase 14D priority workflow — Patients
- Next step: implement the remaining approved Phase 14D patient scope
- Final backend full regression: 420 passed
- Final frontend regression: 104 passed in 38 files
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
- Backend regression gate: closed
- Browser QA/UAT: pending execution with seeded local QA accounts
- Release recommendation: deployment paused; implement Phases 14D–14F, then complete visual browser QA before controlled deployment

Completed capability summary: authenticated role workspaces; patient, scheduling, visit, X-ray/AI, and billing workflows; Admin account management, clinic settings, and audit-log visibility; deterministic development-only integrated demo story; the Phase 14B UI refocus design freeze; Phase 14C.0 Team APIs; Phase 14D.1 Team and Users & Access routes; Phase 14D.2 role dashboard redesign; and Phase 14R booking/availability stabilization. Team uses the User ID as its stable member ID, has transactional Doctor/Staff onboarding, profile optimistic locking, professional/login status separation, linkage-state reporting, protected role transitions, reactivation, and sanitized audit events. Phase 14A seed story remains available.

Remaining post-MVP limitations: real AI integration, email forgot-password, unsupported professional fields (gender, qualifications, license, profile photo, Staff biography, and activity notes), online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization. The remaining Phase 14D UI redesign scope is patients.
