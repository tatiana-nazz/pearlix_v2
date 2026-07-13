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
- Frontend automated verification: `npm run typecheck` passed; `npm run test:run` passed (33 files, 88 tests); `npm run build` passed.
- Backend verification: `manage.py check` passed; focused `tests/scheduling/test_appointments_api.py` passed (38), `test_shift_management.py -k availability` passed (1), and `test_needs_reschedule_status.py` passed (1). `makemigrations --check --dry-run` exceeded the 30-second bounded task timeout and remains pending rerun in the normal development terminal.

## Browser QA

Not completed. The available browser could not connect to `http://localhost:5173` (`ERR_CONNECTION_REFUSED`). Pending: Staff appointment 1440 EN/light, 1024 EN/dark, and 768 AR/light browser matrix; centered overlays, dirty-close, focus return, filter preservation, mixed-script values, and responsive overflow.

## Scope status

Phase 14D is not complete. The appointment modal/localization/RTL/interaction unit is complete in source and automated frontend coverage; patient localization, RTL/bidi, visual acceptance, browser QA, and final Phase 14D closure remain. Phase 14E has not started.
