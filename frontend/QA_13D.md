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

## Local QA Accounts

Local QA users were successfully seeded in the development database. Create or reset them from the backend when needed:

```bash
cd backend
python manage.py seed_dev_qa_users --password "<LOCAL_QA_PASSWORD>" --include-must-change-user --settings=config.settings.local
```

- Admin: `admin.qa@pearlix.local`
- Staff: `staff.qa@pearlix.local`
- Doctor: `doctor.qa@pearlix.local`
- Must-change-password Doctor: `doctor.mustchange@pearlix.local`
- Password is whichever value was passed to the command.
- Do not hardcode credentials in frontend code.
- Do not commit credentials to Git.
- These accounts are for local QA only.

## Manual QA Checklist

- Admin QA login routes to `/admin/dashboard` and dashboard loads real data.
- Staff QA login routes to `/staff/dashboard` and dashboard loads real data.
- Doctor QA login routes to `/doctor/dashboard` and dashboard loads real data.
- Admin dashboard loads real data from `GET /api/dashboard/admin/`.
- Staff dashboard loads real data from `GET /api/dashboard/staff/`.
- Doctor dashboard loads real data from `GET /api/dashboard/doctor/`.
- Dashboard loading state appears during a delayed request.
- Dashboard error state appears and retry refetches the endpoint when a request fails.
- Empty states appear for returned empty arrays.
- 401 behavior still attempts refresh and redirects to `/login` when refresh fails.
- Wrong-role dashboard access is blocked by route guards and backend 403 remains handled.
- Wrong-role dashboard access is denied for the QA accounts.
- Admin dashboard stays read-only for operational records.
- Staff dashboard links only to existing placeholder route shells for later workflows.
- Doctor dashboard does not show global invoices, payments, or Staff/Admin actions.
- Layout checked at 768px with compact sidebar and 1-2 dashboard columns.
- Layout checked at 1024px with readable cards and lists.
- Layout checked at 1280px with 2-3 dashboard card columns.
- Layout checked at 1440px with 4 dashboard KPI cards.

## QA Notes

Local QA accounts are available for credential-based dashboard testing. Browser QA execution is still pending and should be completed with the seeded Admin, Staff, Doctor, and must-change-password Doctor accounts.
