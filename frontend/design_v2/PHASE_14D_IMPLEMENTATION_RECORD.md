# Phase 14D Implementation Record

## Current branch implementation

- `pages/admin/TeamPages.tsx` implements the Admin Team directory/detail/onboarding/profile-status surface using the existing Team API only.
- `pages/dashboard/DashboardV2.tsx` provides v2 dashboard KPI and bounded-preview composition helpers used by all three dashboard pages.
- Router and Admin navigation expose `/admin/team` distinctly from `/admin/users` and `/admin/doctors`.
- `AdminManagementPages.tsx` now separates Users & Access account/security/role/Team concerns and uses the signed Team role-transition API.
- `PatientTable` uses `ClickableRow`; profile edit/archive uses v2 overlays. `AppointmentsPage.tsx` owns v2 appointment Drawers/ConfirmDialogs directly.

## Endpoint and role boundaries

Team uses only `/team-members/` and its existing detail, update, and professional-status actions. Doctor/Staff onboarding sends exactly one matching profile payload and invalidates Team and User queries. Backend runtime changed: no. Migrations: none.

Supported professional fields remain Doctor specialty/phone/bio and Staff position/phone. Gender, qualifications, license, photo, Staff biography, and activity notes are absent. Login status and professional status remain separate.

## Completion status

This is an in-progress implementation record, not a Phase 14D completion record. Remaining EN/AR, acceptance, browser, and documentation closure work is recorded in `frontend/QA_14D.md`; Phase 14E has not started.
