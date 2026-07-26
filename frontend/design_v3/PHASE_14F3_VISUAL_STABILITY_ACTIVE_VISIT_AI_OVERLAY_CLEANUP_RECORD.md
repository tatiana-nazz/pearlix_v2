# Phase 14F.3 Visual Stability, Active Visit, AI Overlay, and Cleanup Record

**Status:** delivered on 2026-07-26

**Starting authority:** `5aee3b4a9d8cdfd1139e2823e795e8bd7f1faea5` on `phase-14f2-information-architecture-permission-responsive-closure`

**Phase 14F.4 note:** the compact Active Visit/X-ray presentation described here is superseded by the Phase 14F.4 static summary, exact four-tab composition, and full inline selected-X-ray analysis workspace. Phase 14F.3 protected-media and production-runtime boundaries remain in force.

## Delivered closure

- Consolidated status presentation on the shared `StatusBadge` implementation. Badges size to content, do not stretch in flex/grid/table contexts, retain machine-status semantics independently from localized labels, and are protected from broad descendant selectors.
- Stabilized Dashboard KPI, Team, Billing summary, and Clinic Settings card rows with grid-owned stretching and natural mobile height. KPI support space is structural and contains no invented copy.
- Expanded the DEBUG-only deterministic demo story with named, non-overlapping split shifts. Doctor One has Morning 08:00–12:00 and Evening 14:00–18:00 Monday–Friday with weekends Off; Doctor Two and Staff One have distinct split-shift examples.
- Created exactly one Doctor One active visit through the existing checked-in-to-started service transition. A separate Doctor Two appointment remains checked in and eligible for Start Visit.
- Replaced separate original/overlay figures with `ProtectedXrayViewer`: authenticated original and transparent same-size overlay bytes share one canvas and one accessible localized toggle. Overlay failure leaves the original available.
- Removed the superseded protected-image component, separate overlay control, broad table descendant styling, duplicate status CSS, and the old StatusPill wrapper implementation. The import alias remains temporarily so untouched modules resolve to the canonical implementation.

## Runtime boundary

Production backend behavior, API contracts, models, migrations, RBAC, protected-media authorization, AI execution behavior, and clinical/financial rules are unchanged. Backend changes are limited to the DEBUG-only demo command and regression tests. No real inference was added.

## Verification

Acceptance evidence is recorded in [`../QA_14F3_VISUAL_STABILITY_ACTIVE_VISIT_AI_OVERLAY_CLEANUP.md`](../QA_14F3_VISUAL_STABILITY_ACTIVE_VISIT_AI_OVERLAY_CLEANUP.md). Generated screenshots, traces, and browser artifacts remain outside Git.
