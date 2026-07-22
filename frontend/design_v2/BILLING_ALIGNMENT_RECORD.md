# Stage 6 — Billing alignment

Source branch and commit: `post-14f-medical-blue-team-management` / `c46c3b000873593623fdb588dab09ff52523dabe`. Stage branch: `post-14f-medical-blue-billing`. Implementation commit: pending finalization.

Active authority was `DOCUMENT_AUTHORITY.md`, runtime code/tests, backend billing contracts, and the v2 design sources. Historical QA and completed-stage records were intentionally excluded unless needed for route/evidence continuity.

Active route inventory: Staff and Admin `/billing` workspaces, direct handoff details, direct invoice details, invoice print routes, and Staff invoice payment detail route. Invoice list, new invoice, and handoff list exports redirect to their respective workspaces. Doctor billing handoff routes redirect to the Doctor dashboard; Doctor has no invoice administration route.

Scope: billing workspace/register, invoice detail/financial summary/payment history, handoff detail, dialogs, responsive/dark/RTL continuity, and A4 print. Protected contracts: Staff mutation authority; Admin read-only access; Doctor restrictions; handoff ownership/status; payment/currency/overpayment rules; paid/cancelled locking; cancellation and invoice number behavior; server query/pagination/order; and backend print data.

The billing UI now uses a command header, contained filter/register surfaces, aligned financial columns, a stronger settlement band, contextual detail cards, sticky payment history on wide screens, and print identity/settlement zones. Dialog behavior, focus safeguards, keyboard behavior, local table scrolling, logical CSS, theme tokens, and existing accessibility semantics remain intact.

- Backend changes: none. Migrations: none. Functional changes: none.
- Evidence: `frontend/design_v2/design_alignment_evidence/billing/`.
- Visual delta: `frontend/design_v2/BILLING_VISUAL_DELTA.md` — PASS.
- Deferred: only active routed and deterministic demo states are represented; no dormant export was activated.
