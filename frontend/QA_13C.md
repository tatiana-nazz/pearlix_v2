# Phase 13C Browser QA

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment

Create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Expected backend URL: `http://127.0.0.1:8000/api`

## Local QA Accounts

Local QA users were successfully seeded in the development database. Create or reset them from the backend when needed:

```bash
cd backend
python manage.py seed_dev_qa_users --password "PearlixDev123!" --include-must-change-user
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

- Login page loads at `/login`.
- Invalid login shows backend error from `/api/auth/login/`.
- Admin QA login redirects to `/admin/dashboard`.
- Staff QA login redirects to `/staff/dashboard`.
- Doctor QA login redirects to `/doctor/dashboard`.
- Must-change-password Doctor QA login redirects to `/change-password`.
- Successful Admin login routes to `/admin/dashboard`.
- Successful Staff login routes to `/staff/dashboard`.
- Successful Doctor login routes to `/doctor/dashboard`.
- User with `must_change_password: true` routes to `/change-password`.
- Change password form rejects mismatched confirmation before calling backend.
- Change password success updates auth state and routes to role dashboard.
- Anonymous user visiting protected route redirects to `/login`.
- Authenticated user visiting `/login` redirects to role dashboard.
- Wrong role route shows Access Denied page with return-to-dashboard action.
- Logout clears local auth state and routes to `/login`.
- Refresh/reload keeps session if access/refresh token remains valid.
- Unknown routes show Not Found page.
- Sidebar active item highlights current route.
- Topbar shows user name and role workspace.
- 768px tablet layout does not break.
- 1024px layout does not break.
- 1280px layout does not break.
- 1440px layout does not break.

## QA Notes

Local QA accounts are available for credential-based testing. Browser QA execution is still pending and should be completed with the seeded Admin, Staff, Doctor, and must-change-password Doctor accounts.
