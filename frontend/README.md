# Pearlix Frontend

The React + Vite + TypeScript frontend implements authentication and role workspaces; patient, scheduling, visit, X-ray/AI, billing, Admin management, clinic-settings, and audit-log workflows. Phase 14A adds a deterministic development-only integrated demo story for all implemented views. See `backend/project_docs/PROJECT_STATUS.md` for canonical project status.

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

Use `frontend/QA_13C.md` for the auth/layout browser QA checklist. Use `frontend/QA_13D.md` for dashboard QA with the local QA accounts. Use `frontend/QA_13J.md` for Admin user management, clinic-settings, and audit-log QA. Use `frontend/QA_13K.md` for the final regression and browser UAT checklist, `frontend/QA_14A.md` for the integrated demo-story checklist, `frontend/QA_14B.md` for the design-freeze review, `frontend/QA_14C0.md` for Team API contract verification, and `frontend/QA_14C.md` for the shell foundation. Phase 14F browser visual/UAT is complete; current-head evidence is in `frontend/design_v2/phase14f_evidence/current_head_acceptance/`.
Use `frontend/QA_13E.md` for original patient list/profile QA and `frontend/QA_13E1.md` for the upgraded patient schema/version contract QA. Use `frontend/QA_13F.md` for appointment and reschedule QA, `frontend/QA_13F1.md` for schedules and leave, `frontend/QA_13G.md` for active visits and clinical notes, `frontend/QA_13H.md` for X-rays and AI, and `frontend/QA_13I.md` for billing handoffs, invoices, payments, and print-data QA.

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
- Patient workflows are implemented through Phase 13E.1; appointment/rescheduling through 13F; shift/availability through 13F.1; active visits through 13G; X-ray/AI through 13H; billing through 13I; Admin user management, clinic settings, and audit logs through 13J; and final regression/release-readiness polish through 13K. See `backend/project_docs/PROJECT_STATUS.md` for canonical current/next phase status.
- Current-head browser QA is complete with the seeded local QA accounts; see `frontend/design_v2/PHASE_14F_BROWSER_AUDIT.md`.

## Patient Management

Phase 13E adds real patient management routes. Phase 13E.1 upgrades the patient schema and frontend contract. Post-Phase-14F Stage 4 aligns the Staff, Admin, and Doctor patient workflow surfaces with the medical-blue system while preserving backend contracts; evidence is in `frontend/design_v2/design_alignment_evidence/patients/`.

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
- Patient profiles include Overview, Medical Summary, Visits, Appointments, X-rays & AI, and role-aware Billing/Handoff content. Admin and Staff profiles expose real billing links and invoice data; Doctor profiles do not expose invoices or payments.

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

## Active Visits And Clinical Notes

Phase 13G adds real visit and clinical note routes:

- Doctor: `/doctor/visits/active`, `/doctor/visits/:visitId`
- Staff: `/staff/visits/:visitId` (read-only)
- Admin: `/admin/visits/:visitId` (read-only)
- Patient visit history links open the appropriate role-scoped visit route.
- A Doctor starts a checked-in appointment from the existing appointment action, then enters the visit workspace.
- The owning Doctor can save `symptoms`, `diagnosis`, `treatment`, `clinical_notes`, and `follow_up_notes` while active or after completion when the backend permits it.
- Completing an active visit uses an explicit confirmation. When notes are dirty, the frontend saves notes first and completes only after that save succeeds.
- Phase 13G originally deferred X-ray/AI integration. Phase 13H now provides saved X-rays, authenticated protected media, AI results and overlays, and external X-ray workflows. Phase 13I now provides Doctor completed-visit handoff creation and role-aware handoff integration.

## Runtime Functional Implementation Through Phase 13K; Phase 14A–14C Foundations

- Vite, React, TypeScript app structure.
- TanStack Query provider.
- Typed API client and endpoint wrappers.
- Hardened auth store, route guards, login, and change-password forms.
- Role-aware guarded routes with reachable sidebar navigation and Not Found handling.
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
- Admin-controlled clinic default schedules, Doctor and Staff working shifts, explicit default application/copy modes, versioned leave cancellation, and Doctor/Staff read-only own-schedule routes.
- Phase 13F.1 QA contract: `frontend/QA_13F1.md`.
- Active visit details, own Doctor clinical note editing, confirmation-based completion, and role-scoped read-only visit history.
- Phase 13G QA contract: `frontend/QA_13G.md`.
- Saved X-ray list/detail routes, Doctor patient/own-visit upload, authenticated Blob media rendering, AI result/overlay presentation, and the Admin/Doctor external X-ray workspace.
- Phase 13H QA contract: `frontend/QA_13H.md`.
- Doctor own-visit handoffs; Staff billing operations; Admin read-only billing; backend-controlled invoices, payments, balances, and print data.
- Phase 13I QA contract: `frontend/QA_13I.md`.
- Admin user creation/update/temporary-password reset/deactivation, Admin full clinic settings, and Admin-only read-only audit logs.
- Phase 13J QA contract: `frontend/QA_13J.md`.
- Phase 13K final QA/release-readiness contract: `frontend/QA_13K.md`.
- Phase 14A added the deterministic development-only integrated demo data story.
- Phase 14B froze the replacement UI/UX design; runtime visual redesign has not started.
- Phase 14C.0 added Team APIs, transactional Doctor/Staff onboarding, linked-profile states, protected role transitions, reactivation, and frontend contract wrappers only; no runtime Team page was added.
- Phase 14C added the v2 token layer, fixed/retractable role shell, centralized Lucide navigation, LIGHT/DARK/SYSTEM and EN/AR preference foundations, shared primitives, and 23 focused Phase 14C tests, for 75 total frontend tests. Shell/common copy is EN/AR; feature copy remains Phase 14D–14E work.

## Design Contract

`frontend/design_v2/` is the authoritative UI refocus and implementation contract for Phases 14C.0 through 14F. It supersedes the old Phase 13B.1 documentation under `frontend/design/`, which remains historical reference only. When they conflict, `frontend/design_v2/` wins.

Mandatory implementation gates are `UI_REFOCUS_MANIFEST.md`, `SCREEN_BLUEPRINTS_V2.md`, `TEAM_USERS_ACCESS_SPEC_V2.md`, and `DESIGN_ACCEPTANCE_MATRIX.md`.

The old `frontend/design/` documents (`DESIGN_SYSTEM.md`, `RESPONSIVE_LAYOUT_SPEC.md`, `COMPONENT_CONTRACT.md`, `SCREEN_BLUEPRINTS.md`, `INTERACTION_STATES.md`) must not be treated as the ongoing authoritative contract.

## Intentionally Not Implemented Yet

- Real AI integration beyond the MVP `MOCK_ADAPTER`.
- Email forgot-password. Gender, qualifications, license, profile photo, Staff biography, and activity notes remain intentionally unsupported professional fields.
- Online payments, invoice itemization, tax, discount, and insurance workflows.
- Phase 14F completed browser visual/UAT acceptance for the required Staff, Admin, and Doctor route matrix.

## Project Status

Phase 14D automated acceptance and Phase 14E supporting operations automated acceptance are complete. Phase 14F browser visual/UAT acceptance is complete. Post-Phase-14F Stage 4 patient alignment is complete: 71 frontend test files / 246 tests, typecheck, and production build passed; backend changes: none; migrations: none; implementation commit `2e2309cc278a86bceaa78d2da3166fb12c127231`. Current-head browser evidence is `frontend/design_v2/phase14f_evidence/current_head_acceptance/` and patient evidence is `frontend/design_v2/design_alignment_evidence/patients/`.

`backend/project_docs/PROJECT_STATUS.md` is the canonical tracker. Phase 14D, Phase 14E, and Phase 14F browser visual/UAT acceptance are complete. See `frontend/design_v2/PHASE_14F_BROWSER_AUDIT.md`.
