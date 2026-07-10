# Pearlix Frontend

Phase 13E.1 plus Phase 13F make the React + Vite + TypeScript frontend foundation operational for auth, role guards, workspace shell behavior, role dashboards, upgraded patient list/profile workflows, and appointment scheduling/rescheduling workflows backed by real backend APIs.

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
npm run test:run
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

Use `frontend/QA_13C.md` for the auth/layout browser QA checklist. Use `frontend/QA_13D.md` for dashboard QA with the local QA accounts. Local QA accounts were successfully seeded; browser QA execution is still pending.
Use `frontend/QA_13E.md` for original patient list/profile QA and `frontend/QA_13E1.md` for the upgraded patient schema/version contract QA. Use `frontend/QA_13F.md` for appointment and reschedule QA.

## Local QA Accounts

Phase 13D.1 adds a local development QA account command. Local browser QA users were successfully seeded and can be created or reset from the backend:

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

## Role Dashboards

- Admin dashboard uses `GET /dashboard/admin/`.
- Staff dashboard uses `GET /dashboard/staff/`.
- Doctor dashboard uses `GET /dashboard/doctor/`.
- Dashboards render real backend data only; no permanent demo dashboard data is hardcoded.
- Full patient, appointment, billing, visit, X-ray, AI, audit, and admin management workflows remain later phases.
- Browser QA is still pending execution with the seeded local QA accounts to verify live role data, 401 refresh behavior, and backend 403 handling.

## Patient Management

Phase 13E adds real patient management routes. Phase 13E.1 upgrades the patient schema and frontend contract:

- Admin: `/admin/patients`, `/admin/patients/:patientId`
- Staff: `/staff/patients`, `/staff/patients/new`, `/staff/patients/:patientId`
- Doctor: `/doctor/patients`, `/doctor/patients/:patientId`, `/doctor/patients/:patientId/clinical-history`

Role behavior:

- Admin can list and view patients read-only.
- Staff can create, edit, archive, unarchive, and view active or archived patients.
- Doctor can list active/non-archived patients and edit profile fields, but cannot archive or view archived filters.
- Create uses `first_name`, `last_name`, and `gender` (`Male` or `Female`); `full_name` and `age` are read-only computed fields.
- Optional profile fields include `date_of_birth`, `phone_number`, `email`, `national_id_or_passport`, `address`, `emergency_contact`, `blood_group`, `medical_conditions_history`, `insurance_info`, and `general_notes`.
- Updates, archive, and unarchive send the current `version` for optimistic locking. `VERSION_CONFLICT` keeps local edits visible and offers a reload path.
- Direct `is_archived` edits are not sent by frontend code; archive state uses backend action endpoints.
- Patient profiles include Overview, Medical Summary, Visits, Appointments, X-rays & AI, and role-aware Billing/Handoff placeholder content.

Frontend tests use Vitest, jsdom, and Testing Library:

```bash
npm run test:run
```

## Appointment Management

Phase 13F adds real appointment routes:

- Admin: `/admin/appointments/day`, `/admin/appointments/week`, `/admin/appointments/month`, `/admin/appointments/list`, `/admin/appointments/needs-reschedule`
- Staff: `/staff/appointments/day`, `/staff/appointments/week`, `/staff/appointments/month`, `/staff/appointments/list`, `/staff/appointments/needs-reschedule`, `/staff/appointments/:appointmentId/reschedule`
- Doctor: `/doctor/appointments/day`, `/doctor/appointments/week`, `/doctor/appointments/list`, `/doctor/appointments/needs-reschedule`

Role behavior:

- Admin can view appointment calendars and worklists read-only.
- Staff can create, edit, reschedule, check in, cancel, and no-show appointments using existing backend action endpoints.
- Doctor can view their own appointment data and start a visit from a checked-in appointment when backend permissions allow.
- Needs Reschedule is a full tab/view with a full-width list/table, not a side panel.
- Availability selection reads from `GET /appointments/availability/`.
- Appointment forms do not PATCH `status`; status changes use dedicated backend action endpoints.

## Included Through Phase 13F

- Vite, React, TypeScript app structure.
- TanStack Query provider.
- Typed API client and endpoint wrappers.
- Hardened auth store, route guards, login, and change-password forms.
- Role-aware route skeletons and placeholder pages.
- Workspace layout with sidebar, topbar, and medical SaaS styling tokens.
- Shared TypeScript contracts based on the Phase 13A integration audit.
- Real-data Admin, Staff, and Doctor dashboard pages.
- Shared dashboard UI components for cards, states, headers, status pills, and summary lists.
- Local dev QA account command for seeded Admin, Staff, Doctor, and must-change-password Doctor users.
- Real patient list/profile integration with role-aware actions, filters, pagination, and profile tabs.
- Phase 13E.1 upgraded patient schema fields, canonical patient filters, versioned update/archive payloads, and conflict handling.
- Focused frontend patient feature tests.
- Real appointment day/week/month/list/needs-reschedule views with role-aware Staff actions and Doctor start-visit entry point.
- Focused frontend appointment feature tests.
- Browser QA documentation for auth/layout guard, dashboard, patient, and appointment verification.

## Design Contract

Phase 13B.1 adds strict design documentation under `frontend/design/`:

- `DESIGN_SYSTEM.md`
- `RESPONSIVE_LAYOUT_SPEC.md`
- `COMPONENT_CONTRACT.md`
- `SCREEN_BLUEPRINTS.md`
- `INTERACTION_STATES.md`

Future frontend phases must follow these files for the professional dental clinic SaaS visual direction, responsive behavior, component contracts, screen blueprints, and interaction states.

## Intentionally Not Implemented Yet

- Visit, billing, X-ray, AI, audit, and admin management workflows.
- Clinical note editing and active-visit completion workflows.
- Protected media rendering screens.
- X-ray upload, AI run, overlays, and external X-ray workspace flows.
- Full billing, invoice, payment, itemization, tax, discount, insurance, and online payment workflows.

## Future Phase Order

- Accepted next sequence: Phase 13F.1 shift-aware appointment/frontend adjustments, then 13G, 13H, 13I, 13J, and 13K.
- Shift rules are locked for future work; Phase 13E.1 does not implement shift behavior.
