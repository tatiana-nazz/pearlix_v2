# Phase 14F.4 Active Visit, Patient Rail, Month, and X-ray Workspace Record

**Status:** delivered on 2026-07-26

**Starting authority:** `5d61ff7a2464bf25fccaa3387d7cc8c8531b8eb8` on `phase-14f3-visual-stability-active-visit-ai-overlay-cleanup`

**Reference:** `phase14f4/01_active_visit_target.png` and `PHASE14F4_ACTIVE_VISIT_VISUAL_CONTRACT.md`

## Delivered presentation

- Month appointment records use the shared semantic status system: UPCOMING/info blue, CHECKED_IN/teal, ACTIVE/AI violet, COMPLETED/success green, NEEDS_RESCHEDULE/warning amber, and CANCELLED/NO_SHOW/danger rose. Each compact whole-item button exposes time, patient, and localized status without restoring workflow actions.
- The Patient Profile identity rail is a single persistent DOM region. It is sticky below the topbar on desktop, internally scrollable only when required, logically positioned for RTL, and returns to normal stacked flow at 1023px and below.
- Active Visit keeps a vertical patient identity and visit summary plus the exact Visit Notes, Patient Profile, X-rays / Attachments, and Billing / Invoice Handoff tab strip together below the workspace header. The summary stays visible on desktop and does not replace the tab panels.
- The summary shows human-readable patient, appointment, appointment/visit status, Doctor, start, reason, and audit context. It retains dirty-state Save Notes, guarded full-profile navigation, and the existing confirmed Complete Visit flow.
- X-rays / Attachments is an inline clinical review workspace: saved thumbnails select a protected original without route navigation; the owning Doctor can use the existing visit upload mutation; a successful upload becomes selected; Staff and Admin remain read-only.
- The owning Doctor can invoke only the existing `POST /api/xrays/{id}/run-ai/` endpoint through `useRunSavedXrayAi`. Pending state disables duplicate execution; stored success refreshes the detail/result; `AI_SERVICE_NOT_CONFIGURED` and other errors are presented honestly.
- Original and authenticated overlay bytes share one transform layer. Show/Hide AI Overlay, Zoom In, Zoom Out, Reset, Fit to View, and Fullscreen/enlarged fallback are real controls. Overlay failure leaves the original visible.
- The structured AI side panel reports only backend-provided status, confidence, findings, model metadata, dates, overlay availability, and disclaimers. It explicitly says research-only, requires professional interpretation, and is not a clinical diagnosis.

## Responsive and inclusive contract

The accepted 1279px, 1023px, and 767px breakpoints remain unchanged. The summary, tab strip, viewer, thumbnail strip, toolbar, findings table, upload dialog, and Patient Profile were verified at 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1024×768, and 768×1024 without document-level horizontal overflow. English/Arabic, logical RTL layout, light/dark tokens, tab keyboard navigation, labelled controls, focus restoration, and protected-image alternatives remain supported.

## Runtime boundary and cleanup

Production backend behavior, API contracts, models, migrations, RBAC, visit ownership, billing, appointment transitions, protected-media authorization, and AI execution are unchanged. Backend edits are limited to the DEBUG-only deterministic seed and its test: Doctor One's active visit has two synthetic visit-owned X-rays, one with stored mock result/overlay and one eligible for the existing mock-adapter run.

The superseded simple `VisitXraySection` was removed. Month status mapping is centralized, X-ray copy is centralized, and the protected viewer remains the sole original/overlay canvas. No fake frontend result, confidence, finding, public media URL, new endpoint, or collection action was added.

## Phase 14F.4B visual acceptance closure

The 2026-07-27 closure aligned the existing Active Visit surface with the accepted visual reference without changing runtime behavior. The patient and visit summary is a flatter static context region with grouped clinical actions and the exact four icon-labelled tabs. The inline X-ray review keeps upload and selected-record context in the workspace header, places saved thumbnails above the structured AI result rail, and keeps the protected canvas larger than its aligned review rail. Viewer controls remain below the single protected canvas in the accepted zoom, reset, overlay, fit, and fullscreen order.

At 1024×768 on Lina Mansour's full Overview panel, the Patient Profile identity rail moved from 145.6px to its expected 88px sticky top while the real document scrolled 600px and the main panel moved from 145.6px to -454.4px. Horizontal overflow remained 0px. At 1023px the rail returned to static stacked flow.

The protected panoramic original and overlay both loaded at 320×180 natural pixels. At the measured 1440×900 review state, both occupied the same 692×389.25px rectangle at x=334.4px and y=-127.96px; x, y, width, and height deltas were all 0px. Both images shared the same `.protected-xray-canvas`, no separate overlay figure existed, and hiding the overlay left the original visible.

Focused Phase 14F.4 browser acceptance passed 3/3 scenarios. The complete serial browser suite passed 17/17 after the pre-existing Phase 14F appointment-action test pinned `/staff/appointments/day?date=2026-07-26`; this removed dependence on the workstation date crossing midnight without changing application behavior.

Acceptance evidence is recorded in [`../QA_14F4_ACTIVE_VISIT_PATIENT_RAIL_MONTH_XRAY_WORKSPACE.md`](../QA_14F4_ACTIVE_VISIT_PATIENT_RAIL_MONTH_XRAY_WORKSPACE.md).
