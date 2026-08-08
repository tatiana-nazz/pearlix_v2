# Current Product and UI Source of Truth

**Authority marker:** `CURRENT_CANONICAL_PRODUCT_UI`
**Reconciled:** 2026-08-08
**Read first:** [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md) and [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md).

## Product direction

Pearlix is a professional medical SaaS for dental-clinic operations. The reconciled v2 runtime lineage continues from `e54a858`. Phase 14F was implemented but rejected in direct user acceptance; Phase 14F.1 is the accepted correction layer and Phase 14F.2 is the accepted information-architecture, permission, and responsive closure. The current direction is a calm reference-derived clinical visual language, corrected workspace hierarchy, responsive desktop/tablet/mobile transformations, English/Arabic with RTL, and light/dark support. Existing runtime behavior, API contracts, and RBAC remain protected.

## Current product rules

- **Shell and navigation:** retain the Phase 14F.2-closed reference-derived shell and semantic token system. Use the Pearlix brand SVG, fixed-top simple arrow collapse, text-only `EN`/`AR`, no top-right account menu, and one sidebar profile destination. Staff has one Team and one Billing destination; Admin/Staff Billing has exactly Overview, Handoffs, and Invoices tabs. Staff/Doctor schedule and leave belong inside profile. The appointment reschedule queue is a Calendar sibling tab, not a sidebar item.
- **Team and Users & Access:** Team is the professional profile, availability, shifts, leave, and workload workspace. Admin manages Team; Staff has a safe read-only Team directory/detail; Doctor has no Team access. Users & Access is Admin-only account identity, login status, security, and role management. Do not merge them into an older "Doctors & Staff" surface.
- **Patients:** retain the compact initials/contact directory with backend-derived Last Visit and Next Appointment plus the read-first patient workspace, role-aware tabs, versioned edits, dedicated archive actions, and Staff-only General Information creation. Active Doctors may access every active, non-archived patient and permitted clinical history; workflow filters are not authorization restrictions.
- **Appointments and dashboards:** retain meaningful KPI colors and role-specific primary actions without a generic Refresh button. The appointment workspace has one aligned 44px toolbar with Calendar/Reschedule Queue siblings and Day/Week/Month/List calendar views for every permitted role. Day/Week/Month period totals use backend counts and status summaries disclose loaded-page scope. Staff performs operational scheduling; Doctors work only their permitted own appointment/visit actions; Admin remains supervisory where the backend enforces it.
- **Billing, visits, and imaging:** The owning Doctor's Active Visit completion is the only current-workflow path that creates a Handoff/Bill, atomically producing one OPEN Handoff with zero Invoices while completing the Visit and Appointment. A Handoff is the amount owed; each Invoice is one completed payment receipt, so one Handoff has zero or many Invoices. Staff cannot create, edit, or cancel Bills and may only issue an Invoice from an eligible existing Handoff. Admin is read-only; Patients cannot create financial records. Historical migrated manual/cancelled Bills remain readable. Visits, X-ray/AI, protected media, and AI boundaries remain governed by current backend contracts and role tests.
- **Accessibility and presentation:** preserve bilingual/RTL, responsive behavior, light/dark support, accessible controls, and backend-enforced RBAC.

## Full visual source adoption: Phase 14F

The supplied reference pack is adopted as the current visual authority for color, typography, spacing, geometry, elevation, shell styling, cards, controls, tabs, tables, overlays, appointment composition, profile composition, and related route presentation. It is not functional authority. Prototype APIs, mock data/state, fake authentication, fake X-ray/AI behavior, mutation columns, role assumptions, and conflicting breakpoints are excluded.

The current implementation uses the reference-derived 264px/76px sidebar, 68px topbar, Manrope-first typography, `#f6f8fc` canvas, `#3f63f2` primary, 12px controls, 20px cards, 24px dialogs, supplied gradients/shadows, and one consolidated semantic token layer. The frozen 1279px, 1023px, and 767px transformations remain current. See `design_v3/DESIGN_SOURCE_ADOPTION_CONTRACT.md` and `design_v3/FULL_VISUAL_SOURCE_MIGRATION_RECORD.md`.

All current route families are visually migrated and the Phase 14F.1 acceptance corrections supersede conflicting Phase 14F presentation. Future work must extend this token/component system rather than restore pre-14F route styling or copy excluded prototype behavior. See `design_v3/PHASE_14F1_UI_ACCEPTANCE_CORRECTION_RECORD.md`.

## Action hierarchy: Phase 14E.1A collection-action closure

The action-button treatment is delivered in Phase 14E.1 and refined by Phase 14E.1A. This is not an authorization to restore the pre-v2 interface or remove functionality: one dominant primary action per page/modal/action area; quieter secondary actions; and visually separated, confirmed destructive actions. Collection records expose no mutation or overflow controls before the record is opened. Whole-row/card selection opens detail. Record-specific actions exist only inside the detail surface. Core actions remain discoverable. Future UI work must preserve this system and the runtime/RBAC boundaries above.

## Active Visit workspace: Phase 14E.2

The opened Active Visit workflow uses a compact patient/visit summary and one accessible tab level for notes, read-first patient context, authorized X-rays/attachments, and final billing. Save Notes is the dominant dirty-state action; completion is a separately confirmed clinical finalization that atomically completes the visit and appointment and creates exactly one OPEN Handoff/Bill with no Invoice. It preserves role ownership, protected media/stored AI boundaries, and the Doctor's no-payment/no-global-Billing boundary.

Phase 14E.2A closes the live acceptance gap: an owning Doctor can start a visit only from an opened checked-in appointment detail, then enters the existing Active Visit workspace. Appointment collection rows remain action-free, and the current Staff/Admin read-only clinical boundary is unchanged.

## Handoff bill and Invoice receipt ledger: Stage 7

Billing uses the Pearlix hierarchy `Visit → Handoff/Bill → zero or many Invoices`. Handoffs are complete financial obligations with OPEN, PARTIALLY_PAID, PAID, or historical CANCELLED status and backend-authoritative paid, remaining, and Invoice counts. Invoices are immutable receipts for individual completed payments and have no Patient, Currency, or Treatment selector. Overview, Handoffs, and Invoices are first-class tabs; dashboards and summaries use Handoff debt and Invoice collection metrics without combining currencies. Doctor Active Visit completion is the only Bill-creation authority. Staff opens an existing Bill and may only record payment, which creates an Invoice; Staff has no New Bill, edit, or cancellation workflow. Admin and Doctor Bill detail are read-only. Patient Billing is read-only financial history. Mutations invalidate Handoff, Invoice, Patient Billing, Visit/Appointment, summary, and dashboard caches, with focus refresh and bounded operational refresh retained. Stage 7 supersedes the Stage 6 financial hierarchy; see `design_v3/STAGE_7_HANDOFF_BILL_INVOICE_LEDGER_RECORD.md`.

## X-ray and AI workspace: Phase 14E.4

Saved X-ray, attachment, viewer, stored-result, and external-X-ray surfaces retain authenticated backend media access, current role contracts, and the collection-action closure. Collections open the whole record and carry no row actions. Viewer detail separates protected image, metadata, stored AI-assisted information, optional backend overlay, and authorized external temporary-case actions. No image editing, fake inference, client result generation, public media URL, or expanded role permission is authorized. The existing responsive shell and transformations remain frozen. See `design_v2/PHASE_14E4_XRAY_AI_WORKSPACE_IMPLEMENTATION_RECORD.md` for implementation evidence and its remaining object-URL-capable browser acceptance limitation.

## Stability and design-change rules

### Phase 14F.3 stability closure

Status badges are one content-sized shared primitive: machine status selects semantic tone while an optional localized label supplies presentation. Repeated Dashboard KPI, Team, Billing summary, and Clinic Settings cards stretch only within their grid row and return to natural height on mobile. Protected original and stored overlay bytes render in one authenticated viewer canvas with a localized `aria-pressed` toggle; textual stored findings remain available and no client inference is authorized. See `design_v3/PHASE_14F3_VISUAL_STABILITY_ACTIVE_VISIT_AI_OVERLAY_CLEANUP_RECORD.md`.

### Phase 14F.4 clinical workspace closure

Month appointment items visibly reuse canonical semantic status tones and include localized status text. The individual Patient Profile keeps one sticky logical-start identity rail on desktop and stacks it at 1023px and below. Active Visit keeps a static patient-and-visit summary followed by exactly Visit Notes, Patient Profile, X-rays / Attachments, and Billing; Stage 7 makes completion create one OPEN Handoff/Bill and zero Invoices. The X-ray tab owns a large inline authenticated viewer, saved selection, authorized visit upload, the existing saved-X-ray AI mutation, same-canvas overlay, real viewer controls, backend-derived AI result panel, and explicit research-only/non-diagnostic language. See `design_v3/PHASE_14F4_ACTIVE_VISIT_PATIENT_RAIL_MONTH_XRAY_WORKSPACE_RECORD.md` and `design_v3/STAGE_7_HANDOFF_BILL_INVOICE_LEDGER_RECORD.md`.

Troubleshooting fixes the affected behavior without restoring an older shell or unrelated design. A design change needs explicit scope, reconciliation with current contracts/tests/RBAC, and an implementation/acceptance record. The next planned current-UI refinement begins with action hierarchy or an explicitly approved Phase 14E scope.

## Rejected historical directions

- Restoring the pre-v2 interface, including `preview-pre-v2-ui` and commit `bdd5f6f`.
- Treating "Doctors & Staff" as the current Team/Users & Access model.
- Narrow "scoped patients only" Doctor object authorization.
- Using legacy navigation, permissions, appointment workflows, or stale frontend specifications as implementation authority.

## Unresolved future work

Real AI and the post-MVP limits recorded in project status remain unresolved. Phase 14F.1 responsive, dark, RTL, console/network, protected-media, patient-edit, appointment-workspace, and settings acceptance is closed. No future item authorizes a runtime change without approved scope.
