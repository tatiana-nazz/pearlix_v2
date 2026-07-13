# Phase 14D Implementation Record

## Current branch implementation

- `pages/admin/TeamPages.tsx` implements the Admin Team directory/detail/onboarding/profile-status surface using the existing Team API only.
- `styles/v2/colors.css` now makes the accepted light and dark semantic palette authoritative and maps existing v2 aliases through it.
- `pages/dashboard/DashboardV2.tsx` provides non-underlined, focusable KPI/preview/action helpers with semantic KPI variants; number, label, helper, and action are separate elements.
- `pages/staff/StaffDashboardPage.tsx` now has the approved four-card Staff Dashboard composition, current-data operational queues, and only supported Staff routes/actions.
- Router and Admin navigation expose `/admin/team` distinctly from `/admin/users` and `/admin/doctors`.
- `AdminManagementPages.tsx` now separates Users & Access account/security/role/Team concerns and uses the signed Team role-transition API.
- `PatientTable` uses `ClickableRow`; profile edit/archive uses v2 overlays. `AppointmentsPage.tsx` now uses centered details, create/edit/reschedule, and status-confirmation overlays with actual dirty tracking, pending close protection, focus trap/return, localized EN/AR content, and bidi-safe patient/doctor/time values.

## Endpoint and role boundaries

Team uses only `/team-members/` and its existing detail, update, and professional-status actions. Doctor/Staff onboarding sends exactly one matching profile payload and invalidates Team and User queries. Backend runtime changed: no. Migrations: none.

Supported professional fields remain Doctor specialty/phone/bio and Staff position/phone. Gender, qualifications, license, photo, Staff biography, and activity notes are absent. Login status and professional status remain separate.

## Completion status

This is an in-progress implementation record, not a Phase 14D completion record. Palette correction, dark token implementation, Staff Dashboard visual correction, and the appointment modal/localization/RTL/interaction unit are complete. Automated frontend verification passed (88 tests); focused appointment backend checks passed (40 tests); browser QA is pending because the local app was unavailable, and the bounded migration-drift command timed out. Patient localization, RTL/bidi, visual acceptance, and final Phase 14D closure remain; Phase 14E has not started.
