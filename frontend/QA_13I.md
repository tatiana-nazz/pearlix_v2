# Phase 13I QA - Billing, Invoices, And Payments

## Scope

Phase 13I is complete: it integrates existing billing handoff, invoice, payment, and print-data APIs. Backend runtime code and migrations are unchanged; browser QA remains pending.

## Role Contract

- Doctors create and read only own completed-visit handoffs; they have no invoice, payment, or print route.
- Staff converts/dismisses pending handoffs, creates invoices, records payments, cancels eligible invoices, and prints.
- Admin has read-only handoff, invoice, payment, and print visibility.
- Invoice numbers, totals, balances, and status remain backend-controlled. No delete or status PATCH is used.

## Automated Checks

```bash
cd backend
python -m pytest tests/billing -q
python -m pytest tests/visits -q
python -m pytest tests/dashboard -q
python -m pytest tests/workflows -q
python -m pytest tests/security -q
python -m pytest -q
python manage.py check
python manage.py makemigrations --check --dry-run

cd ../frontend
npm run typecheck
npm run test:run
npm run build
```

## Browser QA - Pending Execution

Browser QA remains pending with the seeded local accounts. Verify Doctor own completed-visit handoffs, Staff convert/dismiss/direct invoice/payment/cancellation/print paths, Admin read-only behavior, Doctor invoice-route denial, currency mismatch and overpayment errors, returned balance/status updates, and 1440/1280/1024/768 layouts.

## Verification Results

- Frontend: typecheck passed; 22 test files and 49 tests passed; build passed.
- Targeted backend: billing 35 passed, visits 40 passed, dashboard 6 passed, workflows 7 passed, security 27 passed.
- Full backend: 405 passed. Django check passed. Migration drift check reported no changes detected.
