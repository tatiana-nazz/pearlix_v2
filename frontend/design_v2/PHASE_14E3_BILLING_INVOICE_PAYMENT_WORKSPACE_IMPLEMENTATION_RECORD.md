# Phase 14E.3 Billing, Invoice, Payment, and Handoff Workspace Implementation Record

## Purpose and authority

Phase 14E.3 aligns the existing Staff billing handoff, invoice, payment, and print routes with the current clinical SaaS direction. Authority read: `CODEX_START_HERE.md`, the document register, project status, current backend decisions, current UI authority, Phase 14E.1/E.1A/E.2/E.2A records, current billing contracts/tests, deterministic seed, and applicable v2 token, component, table/list, form, overlay, responsive/RTL specifications.

The compatible reference principles adopted are white financial work surfaces, compact backend-derived summary cards, filter cards, readable money hierarchy, whole-record opening, detail-first operations, confirmed terminal actions, and designed loading/empty/error/success states. The reference's stale role, navigation, route, payment, PDF, responsive, and client-calculation assertions were excluded. Current routes and backend financial authority remain intact.

## Delivered workspace behavior

- Handoff and invoice collections are action-free tables. Whole rows open with pointer, Enter, or Space. Tables show human-readable related visit context, notes, dates, status, and formatted amounts rather than raw record IDs or ISO values.
- Handoff detail presents patient, Doctor, completed visit time, amount, description, provenance dates, terminal reason, and a linked invoice. Staff can only convert or dismiss an eligible pending handoff from the opened detail; conversion and dismissal use focus-trapping confirmations and wait for the backend response.
- Invoice collection has backend-supported status filtering, honest server count/pagination, and visible-page metrics. Balance cards never combine currencies; mixed currencies are identified rather than summed.
- Invoice detail has a three-value Total/Paid/Balance hierarchy, backend-returned status, related visit context, payment history, cancellation state, and detail-only Staff edit/payment/cancel actions. Admin sees the same records and print route without mutation controls.
- Payment uses the shared accessible modal, a positive amount validation, readonly invoice currency, pending protection, translated Arabic critical controls, server response refresh, and a readable history entry. Balances and statuses are never computed as authoritative frontend state.
- Cancelled invoices retain history and printability while hiding edit/payment/cancel actions. Print now renders the real `print-data` response as an invoice layout and calls the browser print action. There is no PDF endpoint, generator, export button, or fake export success.
- Staff New Invoice now uses the existing server-backed patient picker instead of a raw Patient ID control. Patient billing continues to open the authorized invoice workspace; Doctor patient billing remains informational and completed-visit handoff-only.
- Doctor global Billing navigation was removed. The existing direct own-handoff route remains available only as visit-scoped supporting context, with no invoice/payment capability.

## Accessibility, localization, themes, and responsive freeze

The revised collections retain semantic tables, whole-row keyboard activation, descriptive row names, text-bearing status pills, money/date bidi isolation, labelled filters/fields, status feedback, and shared Modal focus trap/Escape/close/focus restoration. English and Arabic critical payment controls are centralized in the component. Existing semantic light/dark tokens and logical layout are used.

No breakpoint, global shell, sidebar/topbar behavior, navigation transformation, or modal strategy changed. The existing contained billing table scroll remains the responsive strategy. Browser checks at 1920x1080, 1536x864, 1440x900, 1366x768, 1280x720, 1024x768, and 768x1024 found no document-level horizontal overflow. Arabic RTL at 768x1024 and the existing dark system presentation were exercised; the temporary viewport override was reset.

## Financial integrity and RBAC

No backend model, service, permission, serializer, endpoint, audit rule, migration, or API contract changed. Existing services remain authoritative for totals, payments, balances, statuses, conversion duplicate protection, cancellation eligibility, and overpayment rejection. Staff retains operational actions in detail; Admin is read-only with Print; Doctor has neither global Billing navigation nor invoice/payment mutation.

## Browser acceptance and limitations

The DEBUG-only `seed_demo_clinic_story --reset-demo --reference-date 2026-07-26` supplied pending/converted/dismissed handoffs and unpaid/partial/paid/cancelled invoices. In the browser, Staff converted a pending handoff, cancelled and saved an eligible invoice edit, cancelled/reopened/recorded a disposable payment, saw backend-refreshed partial payment values and history, cancelled an eligible invoice with the protected controls disappearing, filtered invoices, and opened a valid printable invoice. Admin collection/detail stayed read-only with Print only. Doctor navigation contained no Billing entry; direct own-handoff context had no operational invoice controls. Browser console reported no errors; successful state changes and refreshed records evidenced required local API requests. The seed was reset after QA; no browser artifacts, credentials, screenshots, PDFs, logs, or local databases are committed.

Known limitations: PDF export is honestly absent because the current backend exposes print data only. There are no tax, discount, insurance, line items, refund, online-payment, or new payment-method features. This record is implementation evidence, not product authority. Later Phase 14E work must keep adopting compatible visual principles while excluding stale functionality/permissions and keeping the responsive system frozen unless separately approved.

## Phase 14E.3A documentation validation closure

The Phase 14E.3 final report incorrectly said that no standalone documentation checker was available. The repository checker is `scripts/check_documentation_consistency.py`. From `backend`, the exact supported command `..\.venv\Scripts\python.exe ..\scripts\check_documentation_consistency.py` passed on the Phase 14E.3A closure branch. This corrects validation evidence only; it changes no runtime behavior, API contract, test, style, route, permission, or responsive behavior.
