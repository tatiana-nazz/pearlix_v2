# Medical-blue appointment alignment record

## Stage and authority

- Stage: post-Phase-14F medical-blue visual alignment — Stage 3, appointment workflows.
- Source branch and commit: `post-14f-medical-blue-dashboards` at `dac8cc295820e5c8d8f57a0c71a1d93ff7724c69`.
- Stage branch: `post-14f-medical-blue-appointments`.
- Authority order: backend contracts and RBAC; accepted appointment routes/workflows; accessibility, localization, RTL, responsive behavior, and browser acceptance; Stage 1 tokens/shared components; Stage 2 composition conventions; visual reference guidance.
- Implementation commit: pending final commit.

## Scope and protected contracts

Stage 3 aligns the appointment workspace header, calendar navigation, filters, Day/Week/Month/List/Needs Reschedule views, details, creation, availability, and rescheduling presentation. Backend APIs, serializers, permissions, transitions, availability rules, timezone handling, optimistic locking, query keys, payloads, server filtering/pagination, routes, and navigation destinations are unchanged. Functional changes: none. Backend changes: none. Migrations: none.

## Implementation

- Workspace/header: view-specific headings now pair the role description with localized calendar context; controls and appointment content have distinct token-backed surfaces.
- Toolbar and date navigation: compact icon-only previous/next controls use Lucide with localized accessible names; Today and view tabs remain unchanged.
- Filters: supported date, status, and doctor filtering remains server-backed and grouped with toolbar controls.
- Day/Week/Month/List: record hierarchy, semantic status tones, bounded local calendar/table scrolling, today/selected treatment, and responsive sizing use shared medical-blue tokens.
- Needs Reschedule: retained full-width worklist behavior; its existing reason/next-action introduction has a restrained warning accent.
- Details modal: preserved supported fields and role actions; details use a readable two-column desktop grid and safe long-value wrapping.
- Create, availability, and rescheduling: supported fields, live availability, validation, payloads, conflict handling, version behavior, and modal workflows are unchanged.
- Month accessibility: removed the nested interactive month cell pattern. Each month day now has a dedicated accessible day control, separate from its appointment-detail buttons.

## Role, responsive, and accessibility safeguards

- Staff retains only its existing creation, editing, rescheduling, and transition actions.
- Admin remains inspection-only; no creation or appointment mutation affordance is rendered.
- Doctor remains restricted to its authorized appointment scope and checked-in Start Visit path; Staff scheduling controls are absent.
- Calendar/table overflow is bounded to the local `.appointment-calendar-scroll` or `.table-scroll` container. The page document does not overflow.
- Dark surfaces use existing Stage 1 tokens. Arabic uses the existing language preference and root RTL direction; date labels and navigation continue to localize.
- Existing focus-visible styles, accessible tab labels, status icon-plus-text semantics, modal focus lifecycle, Escape handling, and icon-button labels are retained; the Month day control adds keyboard-safe semantics without nested buttons.

## Verification

- Focused appointment tests: 10 files / 28 tests passed.
- Full frontend tests: pending final run.
- TypeScript typecheck: passed.
- Production build: pending final run.
- Browser matrix: Staff Day/Week/Month/List/Needs Reschedule, details, creation, availability, rescheduling, responsive sentinel; Admin read-only workspace/details; Doctor Arabic/RTL workspace/details and empty filtered state all passed. Evidence: `frontend/design_v2/design_alignment_evidence/appointments/`.
- Inherited backend baseline: 423 passed; Django check passed; migration drift had no changes.

## Deferred work

Patient, Team, billing, and other non-appointment workflows remain outside Stage 3. The next recommended stage is patient workflow alignment.
