# Phase 14D QA — Priority Workflows

## Implemented in this branch

- Admin Team runtime routes: `/admin/team` and `/admin/team/:memberId`, with Admin-only route guarding supplied by the Admin workspace.
- Transactional Doctor/Staff Team onboarding, supported professional-profile editing, and separate professional-status confirmation.
- Team directory filtering, tabs, server pagination, linked account navigation, supported shift/leave/workload detail, and no unsupported professional fields.
- Visual Pass 1 corrects the v2 semantic palette, including the approved dark surfaces. Shared interactive KPI cards, preview rows, card links, and dashboard actions no longer use browser-default underlines.
- Staff Dashboard now has exactly four semantic KPI cards (today, checked in, needs reschedule, unpaid/partial invoices), with separate count/label/helper/action elements and current dashboard-response mapping. Pending handoffs remain in the secondary operational queue.
- Users & Access now separates account identity, security/password state, role transition, and linked Team record; Admin account creation and Team-only Doctor/Staff onboarding are explicit.
- Patient rows are keyboard-operable whole rows and no longer render a routine View control. Patient edit/archive overlays use v2 Modal/ConfirmDialog.
- Appointment centered-modal conversion remains the next Phase 14D unit; it is not part of this visual pass.

## Automated verification

- Focused palette, shared-interaction, and Staff Dashboard component tests cover light/dark token values, non-underlined interactive surfaces, four-card composition, semantic variants, primary actions, and API-derived KPI counts.
- Browser visual QA remains pending.

## Browser QA

Not completed. Pending: Admin 1440 Team/dashboard; Staff dark dashboard/appointment/patient flows; Doctor AR dashboard/patient/appointment flows; widths, dark surfaces, RTL/bidi, focus return, and filter preservation.

## Scope status

Phase 14D is not complete. Palette and Staff Dashboard visual correction are checkpointed; appointment centered-modal conversion is next. Full EN/AR feature dictionary, comprehensive workflow coverage, visual browser QA, acceptance-matrix closure, and canonical documentation/checker transition remain required. Phase 14E has not started.
