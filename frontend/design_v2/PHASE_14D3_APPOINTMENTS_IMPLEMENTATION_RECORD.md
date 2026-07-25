# Phase 14D.3 Appointments Implementation Record

Starting commit: `1bc76e7f82790a5540a79ee1384f07589c8d9d19`.

## Scope and routes

This bounded slice redesigns the Admin, Staff, and Doctor appointment workspace at existing appointment routes, including the Staff Needs Reschedule queue and existing Staff reschedule route. Patients, visits, billing, imaging, Team, schedules, and leave administration remain out of scope.

## Workspace behavior

- A v2 workspace header provides clinic-date context, Day/Week/Month/List tabs, previous/Today/next navigation, refresh, and a Staff-only New Appointment action.
- Day uses the existing appointment list surface; Week provides seven accessible day columns; Month is a concise overview with an overflow count; List keeps server pagination, status/Doctor/date filters, and patient search.
- Detail shows localized status, timing, patient/Doctor context, reason, and created/updated timestamps. Staff retains only backend-supported actions; Admin and Doctor are read-only.
- Staff create/edit and reschedule continue to use existing backend availability and transition endpoints. Needs Reschedule remains a route/queue, not a permanent calendar tab.

## Role, timezone, and contract alignment

- Admin is read-only. Staff has scheduling mutations. Doctor remains read-only in this workspace, with visit start retained in the existing visit workflow.
- Appointment list pagination now adds `clinic_date` and `clinic_timezone`; the client uses these response fields for clinic-local heading and Today context. The list also supports server-side patient-name/phone `search`.
- Appointment creation now excludes archived patients at serializer level. No business rule, permission, migration, or existing field was removed.

## Shared presentation

- New appointment copy and status labels are localized in English and Arabic; StatusBadge replaces legacy raw enum display.
- Logical v2 token CSS covers responsive headers, week/month contained overflow, tables, focus, and Light/Dark/System tokens.
- Sidebar matching uses exact matching for the base Appointments route, so Needs Reschedule no longer activates both navigation items.

## Verification

- Backend focused scheduling API tests cover pagination clinic metadata and server-side search.
- Browser QA is pending; use `frontend/QA_14D3_APPOINTMENTS_WORKSPACE.md`.
- Frontend verification: 97 tests passed in 36 files; the focused appointments suite passed 15 tests in 7 files.
- Backend verification: the focused appointments API suite passed 38 tests; the scheduling directory passed 99 tests; complete backend regression passed 418 tests.
