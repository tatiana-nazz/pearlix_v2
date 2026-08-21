# Pearlix Frontend

Read [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md) before frontend work. This README provides setup and supporting implementation context, not product/role authority. Current UI authority is [`CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md`](CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md); current status is [`../backend/project_docs/PROJECT_STATUS.md`](../backend/project_docs/PROJECT_STATUS.md). The reconciled v2 runtime lineage continues from `e54a858`; Phase 14F visually adopts the supplied reference pack on the current runtime application. Team and Users & Access remain separate, active Doctors retain all-active/non-archived patient access, and `preview-pre-v2-ui` / `bdd5f6f` remain rejected historical material.

Phase 14F consolidates the reference-derived token system, shell, components, overlays, and route presentation across every current Admin, Staff, Doctor, authentication, and settings route without changing backend contracts or RBAC. See `design_v3/DESIGN_SOURCE_ADOPTION_CONTRACT.md`, `design_v3/FULL_VISUAL_SOURCE_MIGRATION_RECORD.md`, and `QA_14F_FULL_VISUAL_SOURCE_MIGRATION.md`.

Phase 14D.4A closes the patient workspace contract: server-backed directory state, Staff-only General Information creation, read-first patient detail, explicit medical-history editing, versioned archive/reactivation, accessible URL-backed tabs, centralized English/Arabic copy, and behavioral coverage. Doctors have canonical access to every active/non-archived patient; Doctor helper filters narrow lists only. See `QA_14D4_PATIENT_WORKSPACE.md`, `design_v2/PHASE_14D4_PATIENT_WORKSPACE_IMPLEMENTATION_RECORD.md`, and `design_v2/PHASE_14D4A_PATIENT_CLOSURE_RECORD.md`.

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

## Deterministic local login

Use `127.0.0.1` consistently for the local frontend and API:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.settings.local

cd ..\frontend
npm run dev
```

- Frontend: `http://127.0.0.1:5173/login`
- API: `http://127.0.0.1:8000/api`
- `frontend/.env.local` must set `VITE_API_BASE_URL=http://127.0.0.1:8000/api`.
- `backend/.env` must use the matching `http://127.0.0.1:5173` values from `backend/.env.example` for `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `FRONTEND_URL`.
- Vite uses `strictPort`; if port 5173 is occupied, it exits with an explicit error. Stop the conflicting process rather than opening an automatically selected port.
- Verify the API is reachable with `curl.exe -i http://127.0.0.1:8000/api/auth/login/`; a `405 Method Not Allowed` response confirms that the route is running and only accepts `POST`.

To reset local demo QA data, see `backend/project_docs/DEMO_STORY.md`. Do not commit `.env` files or local credentials.

Useful checks:

```bash
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
```

## Auth Flow

- `/login` posts to `/auth/login/`.
- Tokens are persisted in local storage for the MVP foundation.
- The API client sends `Authorization: Bearer <access>`.
- One automatic refresh is attempted on 401 using `/auth/refresh/`.
- If refresh fails, local auth state is cleared. A terminal 401 also publishes
  `SESSION_REVOKED` so matching sibling tabs clear auth and query caches.
- Users with `must_change_password` are routed to `/change-password`.
- Role guards separate Admin, Staff, and Doctor workspaces.
- Authenticated users visiting `/login` are redirected to their role dashboard.
- Logout is per login/token family. `/auth/logout/` revokes that family's access
  and refresh authority on the backend; account-version changes still invalidate
  every older family for the account.
- `LOGOUT`, `SESSION_REVOKED`, and `IDENTITY_CHANGED` storage events carry only
  the opaque `auth_session_id`. Matching sibling tabs synchronously clear auth
  and rotate the QueryClient without rebroadcasting; independent login families
  ignore the event. Backend session validation remains authoritative.

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

The integrated Phase 14F browser acceptance gate is closed with Admin, Staff, Doctor, protected-media, responsive, RTL, dark-mode, console, and network coverage. See `QA_14F_FULL_VISUAL_SOURCE_MIGRATION.md` and `design_v3/FULL_VISUAL_SOURCE_MIGRATION_RECORD.md`. Phase 14D records remain historical verification references.
Use `frontend/QA_13E.md` for original patient list/profile QA and `frontend/QA_13E1.md` for the upgraded patient schema/version contract QA. Use `frontend/QA_13F.md` for appointment and reschedule QA, `frontend/QA_13F1.md` for schedules and leave, `frontend/QA_13G.md` for active visits and clinical notes, `frontend/QA_13H.md` for X-rays and AI, and `frontend/QA_13I.md` for billing handoffs, invoices, payments, and print-data QA.

Phase 14E.4 aligns the existing X-ray/AI surfaces while preserving protected backend media access and current RBAC. Phase 14F closes the prior visual gap: authenticated original pixels and stored AI output render in Chromium through the private Blob client. See `design_v2/PHASE_14E4_XRAY_AI_WORKSPACE_IMPLEMENTATION_RECORD.md` and `design_v3/FULL_VISUAL_SOURCE_MIGRATION_RECORD.md`; do not replace authenticated Blob access with public URLs.

## Local QA Accounts

Phase 13D.1 adds a local development QA account command. Local browser QA users were successfully seeded and can be created or reset from the backend:

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

## Role Dashboards

- Admin dashboard uses `GET /dashboard/admin/`.
- Staff dashboard uses `GET /dashboard/staff/`.
- Doctor dashboard uses `GET /dashboard/doctor/`.
- Dashboards render real backend data only; no permanent demo dashboard data is hardcoded.
- Each response includes `clinic_date` and `clinic_timezone`; the dashboard heading formats the backend clinic date rather than a browser-local date.
- The Admin dashboard is supervisory and read-only; Staff shortcuts stay operational; Doctor content stays own-scope and has no billing or appointment-creation action.
- Loading, empty queue, retryable error, refresh, EN/AR status labels, RTL, light/dark tokens, and frozen responsive layouts are implemented and covered by the Phase 14F browser gate.
- Patient workflows are implemented through Phase 13E.1; appointment/rescheduling through 13F; shift/availability through 13F.1; active visits through 13G; X-ray/AI through 13H; billing through 13I; Admin user management, clinic settings, and audit logs through 13J; and final regression/release-readiness polish through 13K. See `backend/project_docs/PROJECT_STATUS.md` for canonical current/next phase status.
- Seeded local browser QA covers current role surfaces; backend authorization tests remain authoritative for 401/403 enforcement.

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
- Patient profiles include Overview, Medical Summary, Visits, Appointments, X-rays & AI, and role-aware Billing content. Admin and Staff profiles expose real billing links and invoice data; Doctor profiles do not expose invoices or payments.

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
- Phase 13G originally deferred X-ray/AI integration. Phase 13H added saved X-rays, authenticated protected media, AI results and overlays, and external X-ray workflows. Phase 13I and Stage 6 financial behavior are historical; Stage 7 makes Doctor Visit completion create one OPEN Handoff/Bill with zero Invoices.

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
- Historical Phase 13I Doctor own-visit handoffs and Stage 6 debt-Invoices are superseded by Stage 7. Current Billing uses backend-controlled Handoff/Bills, payment-receipt Invoices, balances, and receipt print data; Staff owns collection and Admin is read-only.
- Phase 13I QA contract: `frontend/QA_13I.md`.
- Admin user creation/update/temporary-password reset/deactivation, Admin full clinic settings, and Admin-only read-only audit logs.
- Phase 13J QA contract: `frontend/QA_13J.md`.
- Phase 13K final QA/release-readiness contract: `frontend/QA_13K.md`.
- Phase 14A added the deterministic development-only integrated demo data story.
- Phase 14B froze the replacement direction; Phase 14F now delivers the reconciled runtime visual adoption.
- Phase 14C.0 added Team APIs, transactional Doctor/Staff onboarding, linked-profile states, protected role transitions, reactivation, and frontend contract wrappers only; no runtime Team page was added.
- Phase 14C added the v2 token layer, fixed/retractable role shell, centralized Lucide navigation, LIGHT/DARK/SYSTEM and EN/AR preference foundations, shared primitives, and 23 focused Phase 14C tests, for 75 total frontend tests. Shell/common copy is EN/AR; feature copy remains Phase 14D–14E work.

## Design Contract

`frontend/design_v2/` is supporting UI implementation context. The reconciled current product/UI authority is `CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md`; it supersedes stale functional, role, navigation, and phase assertions in any older specification. The old Phase 13B.1 material under `frontend/design/` remains historical reference only.

Read affected v2 specifications only after the root authority chain and relevant runtime contracts/tests; they are supporting gates, not independent global authority.

The old `frontend/design/` documents (`DESIGN_SYSTEM.md`, `RESPONSIVE_LAYOUT_SPEC.md`, `COMPONENT_CONTRACT.md`, `SCREEN_BLUEPRINTS.md`, `INTERACTION_STATES.md`) must not be treated as the ongoing authoritative contract.

## Intentionally Not Implemented Yet

Phase 14F.3 closes content-sized status presentation, repeated-card row stability, a deterministic Doctor One active visit, and a same-canvas authenticated stored AI overlay. It adds no client inference, public media URL, API contract, model, migration, or production backend behavior. See `design_v3/PHASE_14F3_VISUAL_STABILITY_ACTIVE_VISIT_AI_OVERLAY_CLEANUP_RECORD.md`.

Phase 14F.4 gives Month items shared semantic appointment-status tones, makes the Patient Profile identity rail sticky on desktop, and recomposes Active Visit around a static patient/visit summary plus the exact four approved tabs. The X-ray tab now selects protected visit X-rays inline, supports the owning Doctor's existing upload and `POST /api/xrays/{id}/run-ai/` workflows, layers the stored overlay on the original transform, exposes working viewer controls, and shows only backend-provided research-only result data. Production backend behavior, API contracts, models, migrations, and RBAC are unchanged. See `design_v3/PHASE_14F4_ACTIVE_VISIT_PATIENT_RAIL_MONTH_XRAY_WORKSPACE_RECORD.md` and `QA_14F4_ACTIVE_VISIT_PATIENT_RAIL_MONTH_XRAY_WORKSPACE.md`.

- Separate-service AI inference; the current real integration is the locked backend `DJANGO_INTERNAL` DENTEX path.
- Email forgot-password. Gender, qualifications, license, profile photo, Staff biography, and activity notes remain intentionally unsupported professional fields.
- Online payments, invoice itemization, tax, discount, and insurance workflows.
- No additional browser phase is implicitly authorized; new work requires approved scope.

## Project Status

`backend/project_docs/PROJECT_STATUS.md` is the canonical tracker. Phase 14E.1A closes collection-level record actions: collection records expose no mutation or overflow controls before detail is opened; whole rows/cards open detail; record-specific actions remain inside the detail surface. Pages retain one dominant primary operation, quieter secondary controls, and visually separated confirmed destructive actions. Remaining work requires its own approved scope. See `frontend/design_v2/PHASE_14E1A_COLLECTION_ACTION_CLOSURE_RECORD.md`.

Historical Phase 14E.2 aligned the opened Active Visit with the clinical visual system. Stage 7 retains that workspace and role boundary while making completion create one OPEN Handoff/Bill with zero Invoices. See `design_v2/PHASE_14E2_ACTIVE_VISIT_CLINICAL_WORKSPACE_IMPLEMENTATION_RECORD.md`.

Phase 14E.2A closes the deterministic live browser workflow: Staff checks in an appointment in its opened detail, the owning Doctor starts the visit from its opened checked-in detail, and the existing Active Visit workflow is exercised against real local API data. See `design_v2/PHASE_14E2A_ACTIVE_VISIT_BROWSER_ACCEPTANCE_RECORD.md`.

Historical Phase 14E.3 aligned the former handoff, invoice, payment, and print workspaces without changing that phase's financial contracts. Stage 7 supersedes both Phase 14E.3 and Stage 6 financial hierarchies; Staff mutations remain detail-only, Admin Billing remains read-only, and Doctors still have no global Billing navigation or Invoice authority. See `design_v2/PHASE_14E3_BILLING_INVOICE_PAYMENT_WORKSPACE_IMPLEMENTATION_RECORD.md`.

Stage 7 is the current financial model: Handoff is the Bill/amount owed, one Handoff has zero or many Invoices, and each Invoice is one completed payment receipt. Doctor Active Visit completion is the only current-workflow Bill creation path and atomically creates an OPEN Handoff with zero Invoices. Staff cannot create, edit, or cancel Bills and issues Invoices only by recording payment from eligible Handoff detail; Admin stays read-only; Patient Billing is read-only financial history; and print is an A4 payment-Invoice document with current Bill totals. Standalone Invoice creation and the user-facing Payment entity are removed. See `design_v3/STAGE_7_HANDOFF_BILL_INVOICE_LEDGER_RECORD.md`. Stage 6 is explicitly superseded.
