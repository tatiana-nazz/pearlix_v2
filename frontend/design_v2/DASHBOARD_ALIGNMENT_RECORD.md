# Stage 2 dashboard alignment record

## Scope and authority

- Scope: page-level medical-blue composition alignment for the Staff, Admin, and Doctor dashboards.
- Source baseline commit: `25ebd632d812ce68a4356479f2db24d1cbc7a88a`.
- Authority order: backend/API and RBAC contracts; accepted routes and workflows; accessibility, localization, RTL, responsive behavior, and browser acceptance; Stage 1 shared tokens/components; external visual-reference guidance.
- Protected contracts: dashboard endpoints, query keys, KPI meanings, role capabilities, routes, navigation destinations, theme/language persistence, RTL/LTR behavior, loading/error/empty states, 272/84 px sidebar geometry, 72 px header, off-canvas navigation, Lucide icons, and Phase 14F overflow behavior.
- Functional changes: none. Backend changes: none. Migrations: none.

## Implementation

- Staff: retained the title/date, appointment and patient actions, patient quick-find, four backend-derived KPIs, operational appointment queues, invoice preview, recent patients, and existing destinations. The appointment queues lead the desktop composition; invoice and patient previews share a quieter supporting grid.
- Admin: retained the title/date, Clinic Settings, Users & Access, four backend-derived KPIs, needs-attention, recent appointments, clinic summary, and existing destinations. Needs attention has the dominant operational surface at compact desktop widths.
- Doctor: retained the clinical title/date, four backend-derived KPIs, appointment queue, every queue tab, cancelled/no-show selector, appointment records, status badges, and current destinations. The queue remains the primary panel with contained tabs and two-up usable KPIs at 768 px.
- Shared CSS: token-backed spacing, borders, shadows, radii, compact-desktop grids, and a one-column safeguard below 768 px. No global overflow suppression was introduced.
- Dark mode: Admin evidence confirms tokenized navy surfaces, legible text, borders, and status treatments.
- Arabic/RTL: Doctor evidence confirms Arabic labels, logical RTL ordering, and contained queue controls.
- Accessibility: existing semantic headings, labelled controls, focus-visible treatments, status text, and keyboard-operable tabs/links remain in use.

## Verification and evidence

- Focused dashboard tests: 3 files, 6 tests passed.
- Full frontend suite: 69 files, 240 tests passed.
- TypeScript typecheck and production build: passed.
- Backend baseline retained: 423 tests passed, Django check passed, migration drift none.
- Browser evidence: `frontend/design_v2/design_alignment_evidence/dashboards/`.
- Browser matrix: Staff 1440x900 EN Light LTR; Admin 1024x900 EN Dark LTR; Doctor 768x1024 AR Light RTL, including every queue tab plus the No-Show selector. All recorded document/body scroll widths are at or below client width; no uncaught console errors or unexpected failed requests were observed.

## Deferred work

Non-dashboard page-level composition alignment remains deferred to later medical-blue stages. Phase 14F is not reopened.

Implementation commit SHA: `81c45696ed055ec62a9a44c0fc93b37f5f5079a4`.
