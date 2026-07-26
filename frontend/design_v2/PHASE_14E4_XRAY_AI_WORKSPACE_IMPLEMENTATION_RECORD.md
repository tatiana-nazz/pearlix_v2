# Phase 14E.4 X-ray, Attachment, Viewer, and AI-Result Workspace Design Alignment

## Purpose, authority, and scope

Phase 14E.4 refines the existing saved X-ray, Active Visit attachment, protected-viewer, stored-result, and external-X-ray surfaces. Authority read: `CODEX_START_HERE.md`, the register and status, current backend decisions, current UI authority, Phase 14E.1/E.1A/E.2/E.2A/E.3/E.3A evidence, the applicable v2 specifications, current X-ray/AI QA, runtime contracts, serializers, permissions, protected-media endpoints, and regression tests.

Compatible reference principles adopted are calm white work surfaces, dark neutral media canvases, readable metadata, restrained AI decision-support, detail-first record actions, quiet secondary controls, separated destructive controls, and explicit loading/error/empty states. Stale reference assertions concerning Doctor scope, routes, navigation, upload ownership, AI availability, external-workspace roles, and responsive transformations were excluded.

## Delivered alignment

- Saved X-ray and patient/visit attachment collections remain action-free. Whole rows open through pointer, Enter, or Space and expose no Open, Delete, Run AI, overflow, or action column. Identity, relationship, date, and AI state are human-readable; raw paths, ISO strings, null/undefined placeholders, and raw IDs are not primary identity.
- The upload dialog now uses the shared focus-trapping modal, supported PNG/JPEG and 10 MB guidance, selected-file feedback, backend-error preservation, pending protection, and centralized English/Arabic critical copy. It continues to submit only the existing file/title/notes contract.
- Viewer detail has a record/status header, protected original-image canvas, metadata definition list, stored-result panel, and detail-only external temporary-case operations. It adds no image editing, zoom, download, public URL, or browser-storage behavior.
- Stored AI data is shown only when returned by the existing backend: status, findings, confidence, model version, timestamps, returned disclaimer, and an on-demand protected overlay. The UI no longer exposes a Run AI trigger for the current mock-only environment and truthfully describes the unavailable analysis state where no stored result exists. No prediction, status, finding, or confidence is fabricated by the frontend.
- External collections remain action-free. The existing Admin/Doctor external upload and temporary-case detail contracts remain intact; attachment is Doctor-owner-only, discard is detail-only and danger-styled, and no external record is presented as a patient record unless the backend has already attached it.

## Security, RBAC, accessibility, themes, and responsive freeze

No backend model, serializer, permission, endpoint, storage configuration, file validation, AI schema/status transition, external-workspace contract, API, or migration changed. Protected content still uses authenticated Blob requests and temporary in-memory object URLs; no raw media URL, storage path, token, browser-storage cache, or client image processing was added. A FileReader in-memory fallback is used only if the current browser does not implement object URLs; it is not persisted.

Doctor upload eligibility remains current patient/own-visit behavior; Staff remains saved-X-ray read-only and has no external route; Admin patient X-rays remain read-only while the existing external workspace contract remains available. Existing collection-action closure and billing boundaries remain preserved.

The changed upload/result strings are centralized in `features/xrays/i18n.ts`; Arabic labels and toggle semantics are supplied through the same source. Existing semantic light/dark tokens, logical CSS, shared Modal focus handling, button names, status text, whole-row keyboard activation, and overlay `aria-pressed` semantics are used. No shell width, breakpoint, sidebar/topbar, navigation, table/card transformation, modal strategy, or global RTL behavior changed.

## Verification and evidence

Baseline frontend validation was 130 tests in 45 files. Final validation passed: TypeScript typecheck, 133 frontend tests in 46 files, production build, Django check, migration-drift check, and 420 backend tests. New focused coverage verifies action-free saved collections with pointer/keyboard opening, upload file validation/preservation, no Run AI control, and an explicit overlay toggle.

The DEBUG-only `seed_demo_clinic_story --reset-demo --reference-date 2026-07-26` supplied disposable saved, external, attached, discarded, stored-result, and no-result records. Browser checks confirmed Doctor and Staff saved-X-ray action-free collections, detail metadata/AI disclaimer/no Run AI control, Staff read-only boundaries, and Admin's action-free external collection with its existing upload entry point. Phase 14E.4A closed the former object-URL visual gap in Chromium and records the corrected API-base-relative protected endpoint handling, visible original/overlay rendering, dimensions, toggle, revocation, and failure evidence in `PHASE_14E4A_PROTECTED_MEDIA_VISUAL_ACCEPTANCE_CLOSURE_RECORD.md`. The seed was reset after QA and no media, database, screenshot, trace, credential, log, or generated artifact is tracked.

## Known limitations

Real AI remains unavailable. Existing backend mock-adapter records are displayed only as stored, labelled supportive information; no real inference is claimed. This record is implementation evidence, not product authority.
