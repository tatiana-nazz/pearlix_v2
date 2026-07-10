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

## Manual QA Checklist

- Login page loads at `/login`.
- Invalid login shows backend error from `/api/auth/login/`.
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

Automated browser QA against real backend credentials was not completed in this phase because no real Admin, Staff, or Doctor credentials were provided. Do not invent demo credentials. Manual credential-based QA should be completed by a developer with valid backend users.
