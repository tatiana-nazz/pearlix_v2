# Pearlix Frontend

Phase 13B creates the React + Vite + TypeScript foundation for the Dental Clinic Management System.

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

## Included In Phase 13B

- Vite, React, TypeScript app structure.
- TanStack Query provider.
- Typed API client and endpoint wrappers.
- Auth store, route guards, login, and change-password forms.
- Role-aware route skeletons and placeholder pages.
- Workspace layout with sidebar, topbar, and medical SaaS styling tokens.
- Shared TypeScript contracts based on the Phase 13A integration audit.

## Intentionally Not Implemented Yet

- Full dashboards.
- Patient, appointment, visit, billing, X-ray, AI, audit, and admin management workflows.
- Detailed form validation beyond the auth foundation.
- Protected media rendering screens.
- Backend behavior changes.
