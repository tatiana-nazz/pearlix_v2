# Stage 7 - Visits and clinical workflows alignment

Branch: `post-14f-medical-blue-visits`
Source commit: `7e048bfc11d6fef6aeabe393c4a1c7a43e945885`
Implementation commit: `1cc67e199473d662859c21c76127093f6ab555b7`

Stage 7 aligns the active-visit and visit-detail workspace with the medical-blue hierarchy. The work is limited to frontend presentation: structured clinical-note fields, a contained notes grid, clearer visit identity/context, tab-frame spacing, action grouping, dialog composition, responsive reflow, and readonly presentation. Existing routes, payloads, query keys, completion flow, ownership rules, and backend contracts remain authoritative.

Active route inventory: Doctor `/doctor/visits/active` and `/doctor/visits/:visitId`; Staff `/staff/visits/:visitId`; Admin `/admin/visits/:visitId`. The workspace exposes Notes, History, X-rays & AI, and Appointment info; Appointment info retains the embedded billing boundary.

Protected behavior verified by focused tests and browser evidence includes five-field clinical-note save payloads, dirty-state route blocking and beforeunload protection, explicit Keep editing/Discard choices, save-before-complete behavior, ownership-based Doctor mutation controls, Staff/Admin readonly behavior, completed-visit completion locking, History current-visit exclusion, embedded X-ray/Billing boundaries, RTL direction, and responsive no-overflow rendering. The existing backend contract intentionally allows the owning Doctor to continue editing clinical notes after completion; only a second completion is locked.

- Functional changes: none; visual composition and hierarchy only.
- Backend changes: none.
- Migrations: none.
- Focused frontend visit tests: 4 files, 10 tests passed.
- Full frontend suite: 74 files, 257 tests passed.
- TypeScript typecheck, production build, Django check, migration drift, documentation consistency, and diff check: passed.
- Evidence: `frontend/design_v2/design_alignment_evidence/visits/`.
- Visual delta: `frontend/design_v2/VISIT_VISUAL_DELTA.md` - PASS.
