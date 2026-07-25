# Phase 14E.1 Action Hierarchy Implementation Record

> **Partially superseded by Phase 14E.1A:** only the direct collection-level Check in and More/menu/action-cell allowance below is superseded. All other Phase 14E.1 hierarchy, detail, RBAC, accessibility, and verification decisions remain historical implementation evidence.

## Purpose and authority

Phase 14E.1 refines the delivered v2 interface without changing routes, APIs, backend behavior, role permissions, or the rejected historical UI. Authority read before implementation: `CODEX_START_HERE.md`, the document register, project status, backend decisions, reconciled product/UI source, v2 component/table/overlay/form/responsive/token specifications, and the Phase 14D implementation and QA records.

## Action inventory

The action inventory covered authentication, role dashboards, appointment Day/Week/Month/List/Needs Reschedule and dialogs, patient directory/profile/tabs/archive, Team, Users & Access, visits, billing, X-ray/AI, settings, and shared form/overlay controls. The highest-density rows were appointment, patient, invoice/handoff, and X-ray lists. Existing detail pages retain full contextual workflow controls.

## Shared changes

`v2.tsx` now provides primary, secondary, ghost, and danger button variants plus a reusable accessible `ActionMenu`. The menu has an icon trigger with localized accessible name/tooltip, `aria-haspopup`, `aria-expanded`, a menu/menuitem model, Arrow navigation, Escape close, outside-click close, focus restoration, and fixed-position viewport collision containment. Loading and disabled button geometry are retained. V2 styles add visible focus, dark-token-compatible menu surfaces, and RTL-aware positioning.

## Screen decisions

- Dashboards retain their one role-specific operational primary action and quieter navigation links.
- Appointment rows open details by row interaction; Staff has at most a justified Check in quick action and receives Edit, Reschedule, No-show, and separately divided Cancel in More. Admin and Doctor remain read-only.
- Patient rows open detail. Staff and Doctor edit/archive controls move into More; archive/reactivation is divided and danger-styled. Admin retains no operational menu.
- Team and Users & Access remain contextual-detail workflows with their existing Admin-only creation and confirmation paths; activation/deactivation stays separate from ordinary controls.
- Visit Save Notes remains the editable-state primary action; Complete Visit remains confirmed and distinct.
- Invoice, billing-handoff, and X-ray list rows now open details by click, Enter, or Space without a routine Open button. Invoice payment remains primary; cancellation is danger-styled and separated from Edit/Payment.
- X-ray upload/open/delete, settings Save/Cancel, authentication, forms, and dialogs retain their existing primary/secondary/danger assignments and workflows.

## Preservation and verification

No endpoint, query invalidation, optimistic-locking, backend authorization, migration, route, or role guard changed. All former row operations remain reachable through row detail, More, or their existing detail controls. English/Arabic copy supplies the new More labels; logical CSS and fixed positioning support RTL, light/dark, and responsive containment.

Focused shared-menu, appointment, and patient behavioral tests cover keyboard opening, Escape/outside close, focus restoration, row behavior, role action visibility, menu reachability, and destructive separation. Final regression, build, backend, documentation, and local browser evidence are recorded with the delivery commit and intentionally kept outside Git.

## Known limitations

No new UI dependency, mock behavior, or mobile-only workflow was introduced. Some older feature-local labels remain governed by their existing localization modules; this slice does not change their APIs or role rules.
