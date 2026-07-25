# Current Product and UI Source of Truth

**Authority marker:** `CURRENT_CANONICAL_PRODUCT_UI`
**Reconciled:** 2026-07-25
**Read first:** [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md) and [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md).

## Product direction

Pearlix is a professional medical SaaS for dental-clinic operations. The accepted current direction is the delivered v2 shell and role workspaces from `e54a85842f1c683b27f12e0da93987ae128c861d`: calm clinical visual language, responsive desktop/tablet layouts, English/Arabic with RTL, and light/dark support. Existing runtime behavior remains protected; this document records decisions and does not authorize visual implementation.

## Current product rules

- **Shell and navigation:** retain the current v2 shell. Role navigation exposes delivered dashboards, appointments, patients, clinical/visit work, X-ray/AI, billing where authorized, Team, and Users & Access as supported by routes and role guards.
- **Team and Users & Access:** Team is the professional profile, availability, shifts, leave, and workload workspace. Users & Access is account identity, login status, security, and role management. Do not merge them into an older "Doctors & Staff" surface.
- **Patients:** retain the read-first patient workspace, role-aware tabs, versioned edits, dedicated archive actions, and Staff-only General Information creation. Active Doctors may access every active, non-archived patient and permitted clinical history; workflow filters are not authorization restrictions.
- **Appointments and dashboards:** retain delivered role dashboards and appointment workspace contracts. Staff performs operational scheduling; Doctors work only their permitted own appointment/visit actions; Admin remains supervisory where the backend enforces it.
- **Billing, visits, and imaging:** Doctors have no global Billing or payment processing. They may perform only current own-visit handoff actions. Visits, X-ray/AI, protected media, and AI boundaries remain governed by current backend contracts and role tests.
- **Accessibility and presentation:** preserve bilingual/RTL, responsive behavior, light/dark support, accessible controls, and backend-enforced RBAC.

## Action hierarchy: Phase 14E.1A collection-action closure

The action-button treatment is delivered in Phase 14E.1 and refined by Phase 14E.1A. This is not an authorization to restore the pre-v2 interface or remove functionality: one dominant primary action per page/modal/action area; quieter secondary actions; and visually separated, confirmed destructive actions. Collection records expose no mutation or overflow controls before the record is opened. Whole-row/card selection opens detail. Record-specific actions exist only inside the detail surface. Core actions remain discoverable. Future UI work must preserve this system and the runtime/RBAC boundaries above.

## Active Visit workspace: Phase 14E.2

The opened Active Visit workflow uses a compact patient/visit summary and one accessible tab level for notes, read-first patient context, authorized X-rays/attachments, and the existing billing handoff. Save Notes is the dominant dirty-state action; completion is a separately confirmed clinical finalization. It preserves role ownership, protected media/stored AI boundaries, Doctor-only own-completed-visit handoff, and no payment/global Billing behavior. Later Phase 14E work adopts compatible reconciled visual/interaction principles from the user reference, but must not adopt stale functionality, permissions, navigation, or responsive behavior; the current responsive system is preserved unless explicitly redesigned.

Phase 14E.2A closes the live acceptance gap: an owning Doctor can start a visit only from an opened checked-in appointment detail, then enters the existing Active Visit workspace. Appointment collection rows remain action-free, and the current Staff/Admin read-only clinical boundary is unchanged.

## Billing workspace: Phase 14E.3

Billing handoffs and invoices retain their separate current routes while using backend-derived summary cards, backend-supported filtering/pagination, readable financial details, human-labelled related visit context, and whole-row detail opening. Collections remain action-free; convert, dismiss, edit, payment, cancellation, and Print are detail-only according to current RBAC. Staff performs supported billing mutations, Admin remains read-only with Print, and Doctors have no global Billing navigation or invoice/payment capability; own-completed-visit handoff context remains governed by existing visit contracts. Totals, paid amounts, balances, statuses, eligibility, and duplicate prevention remain backend-authoritative. PDF export is absent unless a real backend implementation is later approved. The responsive shell and transformations remain frozen.

## Stability and design-change rules

Troubleshooting fixes the affected behavior without restoring an older shell or unrelated design. A design change needs explicit scope, reconciliation with current contracts/tests/RBAC, and an implementation/acceptance record. The next planned current-UI refinement begins with action hierarchy or an explicitly approved Phase 14E scope.

## Rejected historical directions

- Restoring the pre-v2 interface, including `preview-pre-v2-ui` and commit `bdd5f6f`.
- Treating "Doctors & Staff" as the current Team/Users & Access model.
- Narrow "scoped patients only" Doctor object authorization.
- Using legacy navigation, permissions, appointment workflows, or stale frontend specifications as implementation authority.

## Unresolved future work

Any approved Phase 14E supporting-workspace refinement; remaining responsive/dark/RTL visual validation; real AI; and other post-MVP limits recorded in project status. None is authorization for a runtime change without an approved scope.
