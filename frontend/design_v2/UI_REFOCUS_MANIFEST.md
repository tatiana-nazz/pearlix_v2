# Pearlix Phase 14B UI Refocus Manifest

## Decision

Phase 14B is complete. Every item in `PEARLIX_CURRENT_UI_REFOCUS_BRIEF.md` is a **current accepted defect**, not an option, enhancement, or deferred idea. The runtime frontend and backend remain unchanged. Phase 14C implementation may begin only against this v2 contract.

Pearlix is a desktop/laptop-first operational dental SaaS: calm blue/teal foundation, controlled vivid semantics, clear information density, and a recognizable clinical workspace. Directional inspiration informs hierarchy only; Pearlix workflows, RBAC, and actual API payloads are authoritative.

## Non-negotiable product outcomes

- Fixed/sticky topbar; fixed desktop sidebar; independently scrolling content; expanded 272 px and compact 84 px sidebar; persisted user choice; 768 px off-canvas navigation.
- Header has page identity, contextual action, Light/Dark, EN/AR, and avatar/name/role menu. Search appears only on discovery-heavy routes. Notifications are absent because no feature exists.
- Lucide React is the only functional icon set in 14C.
- Detail-first operation: eligible rows/cards open detail; one page primary action; Edit is at authorized detail header; mutations remain in detail; destructive controls are separated.
- Summary lists render 4–6 items, count, Show more, Collapse, and optional View all. Primary datasets use server pagination/filtering.
- Team is an operational directory and Users & Access is authentication/authorization. They are separate sidebar destinations and screens.

## Design evidence and audit baseline

Read and reconciled: current runtime React pages/layouts/components/features/styles/routes/tests; account/profile models, serializers, views and tests; all supplied Phase 14B briefs and screenshots; Phase 14A documentation and source-of-truth project documents. The current shell has clipped compact labels, empty topbar utility space, technical copy, generic white surfaces, inconsistent dialogs, sparse forms, one-off CSS, and Team/User conflation. Those defects are recorded in `UI_AUDIT.md`.

## Scope and phase gate

This contract covers 1440, 1280, 1024, and 768 px; light/dark; English/Arabic/RTL; Admin/Staff/Doctor; populated/loading/empty/error/permission/read-only/locked states. Below 768 px must not crash, but mobile-first work is not part of this phase.

Phase 14C.0 is required before Team profile editing because the verified profile API/linkage gap exists. Then: 14C foundation, 14D priority operational screens, 14E supporting screens, 14F visual/UAT validation, 14G controlled deployment.

## Acceptance

No Phase 14C screenshot is accepted merely because a route opens. It must meet the acceptance matrix, preserve backend behavior and role boundaries, use only stored/returned fields, and remove stale technical/developer copy.
