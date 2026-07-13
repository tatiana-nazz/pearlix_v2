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
- Frontend automated verification: `npm run typecheck` passed; `npm run test:run` passed (33 files, 90 tests); `npm run build` passed.
- Backend verification: `manage.py check` passed; focused appointment tests passed (40), `tests/patients/test_patients_api.py` passed (22), and `tests/security/test_idor_frontend_fields_security.py` passed (3). `makemigrations --check --dry-run` exceeded the bounded task timeout and remains pending rerun in the normal development terminal.

## Browser QA

Not completed. The available browser could not connect to `http://localhost:5173` (`ERR_CONNECTION_REFUSED`). Pending: Staff patient 1440 EN/light list/create/profile/edit/archive; Admin patient 1024 EN/dark read-only list/profile; Doctor patient 768 AR/light filters/profile/clinical history/edit with no archive or billing; appointment modal matrix remains pending.

## Scope status

Phase 14D implementation is complete. Dashboards, Team, Users & Access, appointments, and patient workflows use the accepted v2 palette, EN/AR copy, RTL/bidi utilities, and safe centered overlays. Backend runtime changed: no. Migrations: none. Phase 14F remains the final browser visual/UAT gate; Phase 14E has not started.
