# Phase 14D QA — Priority Workflows

## Implemented in this branch

- Admin Team runtime routes: `/admin/team` and `/admin/team/:memberId`, with Admin-only route guarding supplied by the Admin workspace.
- Transactional Doctor/Staff Team onboarding, supported professional-profile editing, and separate professional-status confirmation.
- Team directory filtering, tabs, server pagination, linked account navigation, supported shift/leave/workload detail, and no unsupported professional fields.
- Visual Pass 1 corrects the v2 semantic palette, including the approved dark surfaces. Shared interactive KPI cards, preview rows, card links, and dashboard actions no longer use browser-default underlines.
- Staff Dashboard now has exactly four semantic KPI cards (today, checked in, needs reschedule, unpaid/partial invoices), with separate count/label/helper/action elements and current dashboard-response mapping. Pending handoffs remain in the secondary operational queue.
- Users & Access now separates account identity, security/password state, role transition, and linked Team record; Admin account creation and Team-only Doctor/Staff onboarding are explicit.
- Patient rows are keyboard-operable whole rows and no longer render a routine View control. Patient edit/archive overlays use v2 Modal/ConfirmDialog.
- Appointment Details, Add, Edit, Reschedule, and status confirmation now use centered v2 overlays. Appointment forms track actual edits, protect pending mutations, and return focus to their originating controls.
- Appointment EN/AR copy, status labels, patient combobox labels/search, RTL logical layout, and bidi isolation are implemented. Raw Patient ID and developer-facing scheduling copy are removed.

## Automated verification

- Focused palette, shared-interaction, and Staff Dashboard component tests cover light/dark token values, non-underlined interactive surfaces, four-card composition, semantic variants, primary actions, and API-derived KPI counts.
- Frontend automated verification: `npm run typecheck` passed; `npm run test:run` passed (34 files, 94 tests); `npm run build` passed. Patient mutation errors now clear independently of local validation, known duplicate/format errors are localized, and the Staff create-patient route blocks dirty SPA navigation.
- Backend verification: `manage.py check` passed; focused appointment API tests passed (38), and the focused patient API plus patient-field security suites passed (25). `makemigrations --check --dry-run --verbosity 2` passed with `No changes detected`.

## Browser QA

Not completed. Phase 14F browser matrix remains pending: Staff 1440 EN/light; Admin 1024 EN/dark; Doctor 768 AR/light; dashboards, Team, Users & Access, appointments, patients, focus return, dirty close, route blocking, filter preservation, RTL/bidi, dark surfaces, overflow, and clinic-local date. Do not treat automated verification as browser acceptance.

## Scope status

Phase 14D remains in progress. Admin Dashboard uses the approved four-card composition with pending handoffs retained in the secondary summary. Shared pagination is localized and covered for EN/AR. Patient route-level correctness, conflict focus, navigation blocking, and route-level tests remain the final Phase 14D unit. Browser QA remains pending; backend runtime changed: no; migrations: none; Phase 14E has not started.
