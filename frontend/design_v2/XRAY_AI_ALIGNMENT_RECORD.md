# Stage 8 — X-rays and AI alignment

Source: `post-14f-medical-blue-visits` at `a9cdd031f6f2a4b220993c57331c1bef627763cb`. Stage branch: `post-14f-medical-blue-xrays-ai`. Implementation commit: `5cdd84c30f7668b9710832f411230c7560d33d0e`.

The active authority was backend protected-media/RBAC contracts, current frontend routes and tests, the Stage 1 token system, and the Stage 7 visit composition. Historical design documents were not used as implementation authority.

Active routes: Doctor, Staff, and Admin `/[role]/xrays` and `/[role]/xrays/:xrayId`; Doctor/Admin `/[role]/xrays/cases/:caseId`; visit and patient embedded X-ray sections. Legacy `/[role]/external-xrays*` routes redirect to the cases workspace. Staff has no external workspace route. No new routes were added.

Stage 8 changes saved X-rays from a dense row table into a keyboard-accessible clinical gallery, adds a dedicated protected-image canvas and fact frame, groups AI lifecycle, findings, overlay state, and the visible non-diagnostic disclaimer, and structures upload selection as a bounded file guidance surface. Staff and Admin retain read-only saved-X-ray presentation; external-case mutation remains governed by existing backend checks.

- Protected media remains authenticated blob access; no storage URL, token, raw object key, or identifier is displayed.
- Upload type/size validation, request shape, pending/close behavior, cache invalidation, AI endpoint/statuses, existing overlay endpoint, and role/object permissions are unchanged.
- Backend changes: none. Migrations: none. Functional classification: frontend composition and accessibility only.
- Focused X-ray checks: 7 files / 13 tests passed. Full frontend verification: 75 files / 258 tests passed. Typecheck and production build passed. Django check and migration drift passed.
- Browser evidence used isolated terminal-Playwright Microsoft Edge sessions with deterministic seeded data. Evidence: `frontend/design_v2/design_alignment_evidence/xrays-ai/`.
- Active limitations: deterministic synthetic protected image bytes render as an empty canvas in the browser; capture verifies the authenticated protected-media state and surrounding UX, not image diagnostic content. Pending/failed/delete/Arabic captures are unavailable as seed state or require a destructive mutation and are covered by existing contract tests.
