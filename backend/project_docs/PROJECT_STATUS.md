# Project Status

This is the canonical current-phase tracker. Other project documents describe capabilities and defer current/next-phase status to this file.

Project: Dental Clinic Management System Website

- Current completed phase: 14C.0 Team Profile API and Account Linkage Foundation
- Phase 13 series: complete
- Next phase: 14C Shell, tokens, Lucide icons, and shared components
- Next step: implement the approved Phase 14C visual foundation; Team and Users & Access runtime pages remain Phase 14D
- Final backend full regression: 414 passed
- Final frontend regression: 52 passed
- Backend runtime changes in Phase 14C.0: yes
- Frontend visible UI changes in Phase 14C.0: no
- Frontend contract types, wrappers, and tests changed in Phase 14C.0: yes
- Migrations in Phase 14C.0: accounts.0005 adds User/DoctorProfile/StaffProfile optimistic-lock versions
- Browser QA/UAT: pending execution with seeded local QA accounts
- Release recommendation: deployment paused; implement the approved Phase 14C–14F refocus sequence and complete visual browser QA before controlled deployment

Completed capability summary: authenticated role workspaces; patient, scheduling, visit, X-ray/AI, and billing workflows; Admin account management, clinic settings, and audit-log visibility; deterministic development-only integrated demo story; the Phase 14B UI refocus design freeze; and Phase 14C.0 Team APIs. Team uses the User ID as its stable member ID, has transactional Doctor/Staff onboarding, profile optimistic locking, professional/login status separation, linkage-state reporting, protected role transitions, reactivation, and sanitized audit events. Phase 14A seed story remains available.

Remaining post-MVP limitations: real AI integration, email forgot-password, final Team and Users & Access runtime UI (Phase 14D), unsupported professional fields (gender, qualifications, license, profile photo, Staff biography, and activity notes), online payments, invoice itemization, tax, discounts, insurance billing, automatic notifications, multi-clinic tenancy, and full mobile-first optimization.
