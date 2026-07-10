# Pearlix Frontend

Phase 13C makes the React + Vite + TypeScript frontend foundation operational for auth, role guards, workspace shell behavior, and browser QA documentation.

## Install

```bash
cd frontend
npm install
```

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

The frontend API client reads `import.meta.env.VITE_API_BASE_URL`. Do not hardcode production URLs in source files.

## Run

```bash
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
```

## Auth Flow

- `/login` posts to `/auth/login/`.
- Tokens are persisted in local storage for the MVP foundation.
- The API client sends `Authorization: Bearer <access>`.
- One automatic refresh is attempted on 401 using `/auth/refresh/`.
- If refresh fails, auth state is cleared.
- Users with `must_change_password` are routed to `/change-password`.
- Role guards separate Admin, Staff, and Doctor workspaces.
- Authenticated users visiting `/login` are redirected to their role dashboard.
- Logout calls `/auth/logout/` when a refresh token exists and clears local auth state even if backend logout fails.

## Role Redirects

- Admin: `/admin/dashboard`
- Staff: `/staff/dashboard`
- Doctor: `/doctor/dashboard`

## Route Guard Behavior

- Anonymous users visiting protected routes go to `/login`.
- Users who must change password can only use `/change-password` and logout.
- Wrong-role workspace access shows the Access Denied page.
- Unknown routes show the Not Found page.
- Backend permissions remain authoritative; frontend guards do not replace API authorization.

## Browser QA

Use `frontend/QA_13C.md` for the manual browser QA checklist. The checklist covers login, invalid credentials, role redirects, must-change-password flow, wrong-role denial, logout, token reload behavior, and 768/1024/1280/1440px layout checks.

## Included Through Phase 13C

- Vite, React, TypeScript app structure.
- TanStack Query provider.
- Typed API client and endpoint wrappers.
- Hardened auth store, route guards, login, and change-password forms.
- Role-aware route skeletons and placeholder pages.
- Workspace layout with sidebar, topbar, and medical SaaS styling tokens.
- Shared TypeScript contracts based on the Phase 13A integration audit.
- Browser QA documentation for auth/layout guard verification.

## Design Contract

Phase 13B.1 adds strict design documentation under `frontend/design/`:

- `DESIGN_SYSTEM.md`
- `RESPONSIVE_LAYOUT_SPEC.md`
- `COMPONENT_CONTRACT.md`
- `SCREEN_BLUEPRINTS.md`
- `INTERACTION_STATES.md`

Future frontend phases must follow these files for the professional dental clinic SaaS visual direction, responsive behavior, component contracts, screen blueprints, and interaction states.

## Intentionally Not Implemented Yet

- Full dashboards.
- Patient, appointment, visit, billing, X-ray, AI, audit, and admin management workflows.
- Detailed form validation beyond the auth foundation.
- Protected media rendering screens.
- Backend behavior changes.
