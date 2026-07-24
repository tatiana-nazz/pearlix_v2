# Phase 14D.2 Role Dashboard Implementation Record

Phase 14D.2 replaces the three generic dashboard implementations with shared v2 dashboard compositions while retaining the established role routes and endpoint ownership.

## Architecture

- `features/dashboard/DashboardShared.tsx` provides the heading, clinic-local date presentation, loading/error/empty states, metrics, lists, sections, and role-safe shortcut navigation.
- `AdminDashboard`, `StaffDashboard`, and `DoctorDashboard` each query exactly one existing role endpoint through `dashboardApi` and render only their permitted data/actions.
- The legacy route page modules are compatibility re-exports to keep router contracts stable; the old generic dashboard behavior is removed.

## Contract and backend alignment

- Existing endpoints remain `GET /api/dashboard/admin/`, `GET /api/dashboard/staff/`, and `GET /api/dashboard/doctor/` with existing role permissions and response fields preserved.
- Each endpoint now adds `clinic_date` and `clinic_timezone`, derived from `ClinicSettings.timezone`. This enables a clinic-local dashboard heading without consulting the browser-local date.
- No serializers, permissions, models, migrations, or existing response fields changed.

## Role boundaries

- Admin is supervisory/read-only and links to management/read-only destinations only.
- Staff exposes only front-desk operational destinations: New appointment, New patient, Needs Reschedule, and Billing.
- Doctor exposes only own-work destinations and no billing, check-in, appointment creation, or Admin controls.

## Localization and presentation

- New dashboard copy and appointment/status labels are present in English and Arabic.
- The shared layout uses existing v2 theme tokens, logical layout behavior, and responsive breakpoints for 1440 through 768 widths.
- Focusable links/buttons retain semantic names; loading, error/retry, and empty-list states are explicit.

## Verification

- Frontend regression: 94 passed in 35 files (baseline 84 passed in 34 files; 10 dashboard tests added in one focused file; no tests deleted).
- Focused frontend coverage adds role boundaries, all-role Arabic rendering, loading, retry, empty queue, and populated-refresh behavior in `RoleDashboards.test.tsx`.
- Focused dashboard API tests: 6 passed, asserting clinic date/timezone fields and existing role/RBAC/data boundaries.
- Backend complete suite: 418 passed. Typecheck, production build, Django system check, migration-drift check, documentation consistency, and diff check passed.
- Browser QA was not executed; use `frontend/QA_14D2_ROLE_DASHBOARDS.md` for the required matrix.
