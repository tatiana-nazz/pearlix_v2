# Stage 4 Patient Alignment Record

## Scope

Post-Phase-14F Stage 4 aligns the patient directory and profile workflows for Staff, Admin, and Doctor to the medical-blue system. It covers only frontend presentation, accessibility, evidence, and documentation. Backend changes: none. Migrations: none.

## Workflow Matrix

Staff: directory, search/archive filters, creation, validation, edit, overview, appointments, visits, X-rays & AI, billing handoff, and archive confirmation. Admin: read-only directory and profile. Doctor: assigned-patient directory, Arabic/RTL profile, clinical history, and X-rays & AI.

## Reference Evidence

The reference remains the repository medical-blue design system and the completed Stage 1–3 records. Runtime evidence is indexed in `design_alignment_evidence/patients/EVIDENCE_INDEX.md`.

## Reference Inventory

The implementation uses the existing V2 shell, page headers, cards, buttons, form controls, table primitives, tokens, status language, and responsive rules; no external design asset or new runtime dependency was introduced.

## Codebase Reconnaissance

Reviewed patient pages, feature components, hooks, existing unit tests, translations, global styles, patient routes, role guards, documentation, and the documentation checker before editing.

## Route Inventory

Preserved `/staff/patients`, `/staff/patients/new`, `/staff/patients/:patientId`, `/admin/patients`, `/admin/patients/:patientId`, `/doctor/patients`, and `/doctor/patients/:patientId`; supported profile `?tab=` direct links remain available.

## API And Contract Inventory

Existing patient, visit, appointment, X-ray, billing-handoff, archive, and permission hooks remain authoritative. No serializer, endpoint, model, permission, or request shape changed.

## Role And Privacy Contract

Staff retains permitted patient management actions; Admin remains read-only; Doctor retains scoped clinical access without patient-management or invoice/payment mutation controls. Screenshots and records omit credentials and local identifiers.

## Route Component Map

`PatientsPage`, `NewPatientPage`, and `PatientProfilePage` compose `PatientTable`, profile header/tabs, clinical summaries, X-ray/AI summary, and billing handoff summary.

## Data Dependency Map

Directories use the established patient list data; profiles use existing details plus tab-appropriate visits, appointments, X-rays, and billing handoffs. Doctor billing requests are not enabled when that tab is unavailable.

## Reuse Decision

Reused the established V2 components and tokens. Stage 4 adds scoped patient modifiers rather than creating a parallel patient design system.

## Design System Extraction

Patient-specific spacing, accent, tab-strip, summary, table, and responsive rules use the repository V2 token palette and component conventions.

## Token Plan

No token definitions changed. The patient rules consume existing `--color-primary-soft`, `--v2-teal`, surface, border, text, spacing, and radius tokens.

## Component Plan

Align the directory filter card and table; establish profile hero/detail hierarchy; bound tab overflow locally; localize X-ray and billing copy; and make profile tabs keyboard-operable.

## Responsive Plan

Directory filters stack at compact widths, patient tables scroll only inside their own wrapper where required, and profile tabs use a bounded local strip rather than creating document-level overflow.

## Accessibility Plan

Profile tabs are a labelled horizontal tablist with roving tabindex, selected state, panel linkage, Home/End, Arrow navigation, and RTL-aware Arrow behavior.

## I18n Plan

Replace new user-facing X-ray and billing copy with feature translations and add paired English/Arabic patient-billing strings under the existing localization architecture.

## Performance And Failure Plan

Retain existing query enablement, loading, retry, empty, and error components. No data fetch is added for unavailable Doctor billing content.

## Implementation Sequence

Updated patient presentation/components and translations, added behavioral tests, ran focused checks, completed authenticated role evidence, then ran the repository verification gate.

## Foundation Changes

Added Stage 4 patient-scoped CSS overrides only; no global layout contract or backend implementation changed.

## Shared Component Changes

`PatientProfileTabs` now exposes semantic tab/panel relationships and keyboard navigation. `PatientTable` no longer presents an unsupported invented next-appointment value.

## Page-Level Changes

The directory, patient form, and profile receive medical-blue layout classes. Profile overview, visits, appointments, X-rays/AI, billing handoff, edit, validation, and archive-confirmation paths retain their original functional intent.

## Staff Workflow Changes

Staff can still search/filter, create, validate, edit, inspect all profile tabs, follow billing handoffs, and reach archive confirmation. The archive request’s existing conflict response was safely observed without changing the record.

## Admin Workflow Changes

Admin patient directory/profile presentation is aligned in dark mode while mutation controls remain absent.

## Doctor Workflow Changes

Doctor directory/profile presentation is aligned in Arabic RTL. Billing is not displayed as a selectable Doctor tab; a direct unavailable billing URL resolves to the visible overview selection without enabling billing data.

## Xray And Ai Changes

X-ray/AI loading, empty, error, retry, upload, result, and action copy now uses existing feature translation lookup. Existing protected-media and upload permissions are unchanged.

## Billing Changes

Billing summary copy is localized. Staff retains invoice handoff navigation; Doctor sees only the existing non-mutating handoff context.

## Error And Empty States

Existing empty X-ray/AI and data-summary states remain. A Staff archive attempt against a conflict-protected record displayed the established 409 error state and did not mutate the record.

## I18n Details

English and Arabic strings were added as matching feature-message keys. No new hardcoded Stage 4 user-facing copy remains in the updated X-ray or billing components.

## Accessibility Details

Tabs use `role=tablist`, `role=tab`, `role=tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, and roving focus. RTL reverses Left/Right navigation only; Home and End remain deterministic.

## Responsive Details

At 1024px Staff directory stays within document width. At 768px Arabic RTL Doctor profile has no document overflow; its tab strip may scroll locally by 11px when content requires it.

## Permission Verification

Authenticated live scenarios confirmed Staff actions, Admin read-only presentation, and Doctor clinical/X-ray scope. Doctor billing mutation/invoice controls were not rendered.

## Runtime Verification

Ran the real seeded demo in the browser with separate logout/new-tab sessions per role: Staff EN Light, Admin EN Dark, and Doctor AR Light RTL.

## Screenshot Verification

All required Stage 4 screenshots are unedited browser captures at the names and viewports listed in the evidence index.

## Geometry Verification

Each capture has recorded `innerWidth`, `innerHeight`, client width, document scroll width, and body scroll width in the evidence index. No document-level horizontal overflow was observed.

## Local Scroll Verification

Patient tables and profile tabs use local wrappers only. The evidence index records client/scroll widths and the one compact Doctor tab-strip overflow.

## Browser Console And Network Verification

Browser console error log was empty after the final Doctor scenario. No unexpected failed request was observed; the intentional archive conflict was visible as the product’s 409 error state.

## Test Changes

Added keyboard-profile-tab, X-ray summary, and billing-presentation coverage; updated patient-table and billing expectations for the supported data contract and localization.

## Test Results

Focused patient tests, full frontend tests, typecheck, and production build are recorded after final verification below.

## Backend Verification

Backend baseline remained unchanged. Django check and migration-drift verification are recorded after final verification below; no backend source or migration changed.

## Documentation Changes

Updated the alignment status, canonical project status, frontend status summary, and documentation consistency check. Added this record and the patient evidence index.

## Known Limitations

Stage 4 does not add new patient API fields, invoice/payment functionality, or a real AI service; it presents only already-supported data and actions.

## Non-Goals

No backend refactor, migration, permission expansion, route redesign, endpoint change, data-model change, or fabricated schedule data is in scope.

## Verification Commands

`npm.cmd run test:run`; `npm.cmd run typecheck`; `npm.cmd run build`; Django check; migration dry-run; documentation consistency check; and `git diff --check`.

## Documentation Consistency

The documentation checker now requires the Stage 4 record, evidence index, and key patient screenshots while preserving the existing Phase 14F closure checks.

## Final Repository State

Implementation commit: pending initial implementation commit. Documentation amendment commit: pending. Working tree is checked clean after final verification and commit.

## Commit And Push

Initial commit message: `feat: align medical-blue patient workflows`. Documentation amendment message: `docs: finalize patient alignment evidence`. Push target: `origin post-14f-medical-blue-patients`.

## Next Recommended Stage

Team and staff-management alignment.
