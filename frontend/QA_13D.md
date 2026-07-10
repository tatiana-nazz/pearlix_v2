# Phase 13D Dashboard QA

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment

Use `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Expected backend URL: `http://127.0.0.1:8000/api`

## Manual QA Checklist

- Admin dashboard loads real data from `GET /api/dashboard/admin/`.
- Staff dashboard loads real data from `GET /api/dashboard/staff/`.
- Doctor dashboard loads real data from `GET /api/dashboard/doctor/`.
- Dashboard loading state appears during a delayed request.
- Dashboard error state appears and retry refetches the endpoint when a request fails.
- Empty states appear for returned empty arrays.
- 401 behavior still attempts refresh and redirects to `/login` when refresh fails.
- Wrong-role dashboard access is blocked by route guards and backend 403 remains handled.
- Admin dashboard stays read-only for operational records.
- Staff dashboard links only to existing placeholder route shells for later workflows.
- Doctor dashboard does not show global invoices, payments, or Staff/Admin actions.
- Layout checked at 768px with compact sidebar and 1-2 dashboard columns.
- Layout checked at 1024px with readable cards and lists.
- Layout checked at 1280px with 2-3 dashboard card columns.
- Layout checked at 1440px with 4 dashboard KPI cards.

## QA Notes

Automated browser QA against live role credentials was not completed in this phase because no real Admin, Staff, or Doctor credentials were provided. Manual credential-based QA should be completed by a developer with valid backend users.
