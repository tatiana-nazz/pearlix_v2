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

## Action hierarchy: approved pending design work

The current action-button treatment is an approved design issue, pending implementation. It is not an authorization to restore the pre-v2 interface or remove functionality. Future approved UI work should use one dominant primary action per page/modal/action area; quieter secondary actions; row click or an explicit detail control for detail; accessible More/Actions menus when appropriate; and visually separated, confirmed destructive actions. Core actions must remain discoverable and no functionality may be removed simply to reduce visible buttons.

## Stability and design-change rules

Troubleshooting fixes the affected behavior without restoring an older shell or unrelated design. A design change needs explicit scope, reconciliation with current contracts/tests/RBAC, and an implementation/acceptance record. The next planned current-UI refinement begins with action hierarchy or an explicitly approved Phase 14E scope.

## Rejected historical directions

- Restoring the pre-v2 interface, including `preview-pre-v2-ui` and commit `bdd5f6f`.
- Treating "Doctors & Staff" as the current Team/Users & Access model.
- Narrow "scoped patients only" Doctor object authorization.
- Using legacy navigation, permissions, appointment workflows, or stale frontend specifications as implementation authority.

## Unresolved future work

Action hierarchy implementation; any approved Phase 14E supporting-workspace refinement; remaining responsive/dark/RTL visual validation; real AI; and other post-MVP limits recorded in project status. None is authorization for a runtime change without an approved scope.
