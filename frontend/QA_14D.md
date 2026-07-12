# Phase 14D QA — Priority Workflows

## Implemented in this branch

- Admin Team runtime routes: `/admin/team` and `/admin/team/:memberId`, with Admin-only route guarding supplied by the Admin workspace.
- Transactional Doctor/Staff Team onboarding, supported professional-profile editing, and separate professional-status confirmation.
- Team directory filtering, tabs, server pagination, linked account navigation, supported shift/leave/workload detail, and no unsupported professional fields.
- Dashboard compositions now use v2 KPI cards, bounded four-to-eight previews, read-only Admin actions, Staff's two approved quick actions, and conditional Doctor active-visit banner.
- Users & Access now separates account identity, security/password state, role transition, and linked Team record; Admin account creation and Team-only Doctor/Staff onboarding are explicit.
- Patient rows are keyboard-operable whole rows and no longer render a routine View control. Patient edit/archive overlays use v2 Modal/ConfirmDialog.
- Appointment create/edit/detail/status overlays use v2 Drawer/ConfirmDialog directly from the workspace; legacy Phase 14D appointment dialogs were removed.

## Automated verification

- Typecheck: passed using the bundled Node runtime.
- Focused Team/User API, patient, appointment, shell, and shared-component tests cover transactional onboarding, security actions, Admin-only Team navigation, and whole-row navigation.
- Full frontend regression: 77 passed. Typecheck and production build passed.
- Django check and migration drift: passed. Focused Team/User/dashboard/patient/appointment contract tests: 102 passed.

## Browser QA

Not completed. Pending: Admin 1440 Team/dashboard; Staff dark appointment/patient flows; Doctor AR dashboard/patient/appointment flows; widths, dark surfaces, RTL/bidi, focus return, and filter preservation.

## Scope status

Phase 14D is not complete. Full EN/AR feature dictionary, comprehensive Phase 14D workflow coverage, visual browser QA, acceptance-matrix closure, and canonical documentation/checker transition remain required.
