# Phase 14E.1A Collection Action Closure Record

## Scope

Phase 14E.1A corrects the direct collection-level Check in, More/menu, and action-cell allowance introduced by Phase 14E.1. It changes frontend presentation only; routes, backend APIs, authorization, migrations, and data contracts are unchanged.

## Decision applied

Collection records expose no mutation or overflow controls before the record is opened. Whole-row/card selection opens detail. Record-specific actions exist only inside the detail surface.

Appointment, patient, Team, Users & Access, billing handoff/invoice, X-ray, external X-ray, audit, dashboard preview, calendar, queue, schedule, and leave collections use row/card navigation with pointer, Enter, and Space behavior. Page creation, search, filter, refresh, date navigation, tabs, and pagination remain collection-level controls.

## Detail preservation

Staff appointment detail retains Edit, Reschedule, Check in, Mark no-show, and Cancel through the existing mutation handlers and confirmation dialog. Admin appointment detail is read-only. Patient profile retains Staff Edit/Archive/Reactivate and Doctor Edit without archive/reactivation; Admin remains read-only. Team, user/account, invoice, handoff, X-ray/AI, external X-ray, schedule, and leave operations remain in their existing detail surfaces.

`ActionMenu` remains a shared, tested component but is not used by primary collection screens. Phase 14E.1 is partially superseded only for its direct collection-level Check in and More/menu/action-cell allowance.

## Verification boundary

Frontend component tests cover action-free appointment and patient collections, keyboard row opening, and the Staff appointment-detail action mapping. Existing detail RBAC, backend, documentation, build, and browser acceptance gates remain required for delivery. This record is implementation evidence, not product authority.
