# Project Status

This is the canonical current-phase tracker. Other project documents describe capabilities and defer current/next-phase status to this file.

Project: Dental Clinic Management System Website

Phase 14D.1 Team and Users & Access contract alignment is delivered: separate runtime routes use the existing Team and account-linkage APIs. Phase 14R repaired the stale scheduling-test clock and booking/availability defects, closing the backend regression gate with 418 passing backend tests. Remaining Phase 14D dashboard, appointment, and patient redesign work is pending.

- Current completed phase: 14R Backend Regression Stabilization
- Phase 13 series: complete
- Next phase: remaining Phase 14D priority workflows — Dashboards, Appointments, and Patients
- Next step: implement the remaining approved Phase 14D dashboard, appointment, and patient scope
- Final backend full regression: 418 passed
- Final frontend regression: 84 passed in 34 files
- Backend runtime changes in Phase 14C: no
- Migrations in Phase 14C: none
- Backend runtime changes in Phase 14C.0: yes
- Frontend visible UI changes in Phase 14C: shell/token/shared-component foundation
- Frontend contract types, wrappers, and tests changed in Phase 14C.0: yes
- Migrations in Phase 14C.0: accounts.0005 adds User/DoctorProfile/StaffProfile optimistic-lock versions
- Backend runtime changes in Phase 14R: yes
- Migrations in Phase 14R: none
- Backend regression gate: closed
- Browser QA/UAT: pending execution with seeded local QA accounts
- Release recommendation: deployment paused; implement Phases 14D–14F, then complete visual browser QA before controlled deployment

Completed capability summary: authenticated role workspaces; patient, scheduling, visit, X-ray/AI, and billing workflows; Admin account management, clinic settings, and audit-log visibility; deterministic development-only integrated demo story; the Phase 14B UI refocus design freeze; Phase 14C.0 Team APIs; Phase 14D.1 Team and Users & Access routes; and Phase 14R booking/availability stabilization. Team uses the User ID as its stable member ID, has transactional Doctor/Staff onboarding, profile optimistic locking, professional/login status separation, linkage-state reporting, protected role transitions, reactivation, and sanitized audit events. Phase 14A seed story remains available.

Remaining post-MVP limitations: real AI integration, email forgot-password, unsupported professional fields (gender, qualifications, license, profile photo, Staff biography, and activity notes), online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization. The remaining Phase 14D UI redesign scope is dashboards, appointments, and patients.
