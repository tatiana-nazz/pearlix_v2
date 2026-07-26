# Phase 14F.2 Information Architecture, Permission, and Responsive Closure Record

**Status:** delivered on 2026-07-26

**Starting authority:** `7ebce1f8e2bf9156bd759c939690c319f0cae427` on `phase-14f1-ui-correction-rich-demo-story`

## Delivered closure

- Removed the profile workload surface and its data request. Staff and Doctor profiles now place a shared semantic Shift-by-Monday-to-Sunday working-hours matrix directly above the chronological leave table.
- Consolidated Staff navigation to one Team destination and one Billing destination. Staff and Admin Billing preserve the existing handoff/invoice deep routes behind one shared Billing header and tabs. Doctor has no global Billing navigation.
- Added Staff read-only Team list/detail routes. `GET /api/team-members/` and detail allow authenticated Staff through a safe professional projection; Team mutations remain Admin-only, and Doctor/unauthenticated access remains denied.
- Rebuilt Team as reference-aligned professional cards while keeping Users & Access a separate compact account/security identity table.
- Added patient directory Last Visit and Next Appointment annotations and rendered a compact identity/contact table with initials and contained horizontal overflow.
- Aligned Calendar/Reschedule Queue and Day/Week/Month/List controls in one 44px appointment toolbar. Queue and calendar views preserve filters and the remembered calendar view. Day, Week, and Month use one honest summary component: period total comes from the backend count, while status counts are explicitly labelled as loaded-page values.
- Made status machine values and localized display labels separate, with shared success, information, warning, danger, AI, and neutral semantics.
- Kept the sidebar collapse arrow fixed in the brand row across expanded, collapsed, 1279px compact, RTL, and scroll states.
- Closed document-level horizontal overflow at the 1023px and 767px acceptance breakpoints; wide semantic tables scroll inside their own containers.

## Backend and persistence boundary

This phase changes additive read projections and Team read permissions only. It adds no model field, migration, destructive workflow, financial rule, clinical authorization, or media behavior. The deterministic local demo story remains populated after acceptance.

## Evidence

Automated and real-browser evidence is recorded in [`../QA_14F2_INFORMATION_ARCHITECTURE_PERMISSION_RESPONSIVE_CLOSURE.md`](../QA_14F2_INFORMATION_ARCHITECTURE_PERMISSION_RESPONSIVE_CLOSURE.md). Generated screenshots and traces remain outside Git and are not product authority.
