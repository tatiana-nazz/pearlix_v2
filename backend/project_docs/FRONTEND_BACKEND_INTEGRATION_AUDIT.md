# Frontend/Backend Integration Audit

## Phase 14C shell foundation

Phase 14C changes frontend shell and shared UI foundations only. Backend runtime changed: no; migrations: none. Theme and language preferences continue to persist through the existing authenticated `PATCH /api/me/preferences/` contract. Team and Users & Access runtime UI remains assigned to Phase 14D; no `/admin/team` runtime route is introduced in Phase 14C.

Phase: Originally created for 13A; capability audit through completed Phase 14C shell/token/icon/shared-component foundation. See `PROJECT_STATUS.md` for canonical current/next phase status.
Backend source of truth: GitHub `Tatiana-tay/pearlix_v2`, branch `main`  
API base URL: `/api/`  
Backend status: Phase 14A integrated development demo story, Phase 14B design documentation, Phase 14C.0 Team/account-linkage API foundation, and Phase 14C shell/token/icon/shared-component foundation are complete. The next phase is Phase 14D — Priority Workflows: Dashboards, Appointments, Patients, Team, and Users & Access; deployment remains paused.

This document maps the completed Django REST Framework backend to the React + Vite + TypeScript frontend contract. It is an audit and implementation plan only; it does not change backend behavior.

## Source Files Read

- `backend/config/urls.py`
- `backend/config/settings/base.py`
- `backend/apps/common/urls.py`, `views.py`, `errors.py`, `exceptions.py`, `permissions.py`, `protected_media.py`
- `backend/apps/accounts/urls.py`, `models.py`, `serializers.py`, `views.py`
- `backend/apps/clinic/urls.py`, `models.py`, `serializers.py`, `views.py`
- `backend/apps/patients/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`, `selectors.py`
- `backend/apps/scheduling/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`, `services.py`
- `backend/apps/visits/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`, `services.py`
- `backend/apps/xrays/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`, `services.py`
- `backend/apps/ai_results/models.py`, `serializers.py`, `services.py`
- `backend/apps/billing/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`, `services.py`
- `backend/apps/dashboard/urls.py`, `views.py`
- `backend/apps/audit/urls.py`, `models.py`, `serializers.py`, `views.py`, `permissions.py`
- `backend/project_docs/BACKEND_FINAL_HANDOFF.md`
- `backend/project_docs/CURRENT_BACKEND_DECISIONS.md`
- `_codex_backend_handoff/25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH.md`

## A. API Inventory

All authenticated list viewsets use DRF page-number pagination unless noted:

```ts
type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
```

Standard API errors use:

```ts
type ApiError = {
  code: string
  message: string
  details: Record<string, unknown>
}
```

### Auth / Accounts

- `POST /api/auth/login/` - public login. Body: `{ email, password }`. Returns `{ access, refresh, user }`.
- `POST /api/auth/refresh/` - SimpleJWT refresh. Body: `{ refresh }`. Returns `{ access }`.
- `POST /api/auth/logout/` - authenticated refresh blacklist. Body: `{ refresh }`. Returns `204`.
- `POST /api/auth/change-password/` - authenticated password change. Body: `{ current_password, new_password }`. Returns auth user.
- `GET /api/me/` - current user.
- `PATCH /api/me/preferences/` - body `{ theme_preference?, language_preference? }`. Returns auth user.
- `GET /api/users/` - Admin only, paged users.
- `POST /api/users/` - Admin only creates Admin accounts. Doctor/Staff creation returns `PROFILE_REQUIRED` and uses `POST /api/team-members/`.
- `GET /api/users/{id}/` - Admin only.
- `PATCH /api/users/{id}/` - Admin only for account fields; protected role changes cannot bypass `transition-role`.
- `POST /api/users/{id}/reset-password/` - Admin only. Body `{ temporary_password }`.
- `POST /api/users/{id}/deactivate/` - Admin only. Self-deactivation and last-active-admin deactivation are blocked.
- `POST /api/users/{id}/transition-role/` - Admin-only signed preview/confirm role transition.
- `POST /api/users/{id}/reactivate/` - Admin-only reactivation for inactive, profile-consistent accounts.
- User list/detail includes safe `linked_profile_state` and a valid `team_member_id` when a professional profile is linked.

Effective methods: no frontend `DELETE` for users. `UserViewSet` is limited to `GET`, `POST`, and `PATCH`.

### Team API

- `GET /api/team-members/` - Admin-only paged directory with `q`, `role`, `professional_status`, `availability`, and `page` filters.
- `POST /api/team-members/` - Admin-only transactional Doctor/Staff onboarding with matching profile payload.
- `GET /api/team-members/{id}/` - Admin-only profile, linked-account, schedule, leave, and bounded workload detail.
- `PATCH /api/team-members/{id}/` - Admin-only professional field update; current profile `version` is required.
- `POST /api/team-members/{id}/set-professional-status/` - Admin-only professional status update; current profile `version` is required and login status is unchanged.

User ID is the Team identifier. Team excludes Admin accounts and legacy unlinked professional accounts. Supported fields are Doctor `specialty`, `phone`, `bio` and Staff `position`, `phone`; no unsupported professional fields are fabricated.

### Clinic Settings

- `GET /api/clinic/settings/` - Admin gets full settings; Staff/Doctor get safe settings.
- `PATCH /api/clinic/settings/` - Admin only. Body can include full settings fields.

Full settings fields: `clinic_name`, `address`, `phone`, `email`, `timezone`, `capacity_per_slot`, `default_appointment_duration_minutes`, `allowed_durations_minutes`, `default_currency`, `supported_currencies`, `default_language`, `ai_mode`, `ai_service_url`.

Safe settings omit `ai_mode` and `ai_service_url`.

### Team / Users / Doctors / Staff

- `GET /api/users/` - Admin source for all accounts, with linked-profile state and Team identifier where valid.
- `GET /api/team-members/` - Admin-only paged Team directory; filters `q`, `role`, `professional_status`, `availability`, and `page`.
- `POST /api/team-members/` - Admin-only transactional Doctor/Staff onboarding. User ID is the Team identifier.
- `GET /api/team-members/{id}/` - Admin-only professional profile, linked account, shifts, leave, and bounded workload detail.
- `PATCH /api/team-members/{id}/` - Admin-only professional fields with required profile `version`.
- `POST /api/team-members/{id}/set-professional-status/` - Admin-only professional status with required profile `version`; it does not change login status.
- `GET /api/doctors/` - authenticated active doctors list with `doctor_profile` summary.
- `GET /api/doctors/{doctor_id}/working-hours/` - compatibility route backed by `WorkingShift`; Admin/Staff can read any Doctor and Doctor can read own only.
- `PUT /api/doctors/{doctor_id}/working-hours/` - Admin-only compatibility replacement backed by `WorkingShift`, with explicit confirmation when future appointments are affected.

Team onboarding and professional-profile update/status APIs are implemented. Supported fields are Doctor `specialty`, `phone`, `bio` and Staff `position`, `phone`; gender, qualifications, license, profile photo, Staff biography, and activity notes are absent. Legacy unlinked professional accounts remain visible in Users & Access as `PROFILE_SETUP_REQUIRED` but are excluded from Team.

### Patients

- `GET /api/patients/` - paged list.
- `POST /api/patients/` - Staff only create.
- `GET /api/patients/{id}/` - detail.
- `PATCH /api/patients/{id}/` - Staff and Doctor can update active profile fields with required `version`; Admin is read-only.
- `POST /api/patients/{id}/archive/` - Staff only, body `{ version }`.
- `POST /api/patients/{id}/unarchive/` - Staff only, body `{ version }`.
- `GET /api/patients/{id}/visits/` - patient visit history.
- `GET /api/patients/{id}/xrays/` - patient X-rays.
- `POST /api/patients/{id}/xrays/` - Doctor only upload patient-profile X-ray.
- `GET /api/patients/{id}/ai-results/` - saved AI results for patient X-rays.

Patient list query params: `is_archived`, `first_name`, `last_name`, `phone_number`, `email`, `national_id_or_passport`, `search`, and Doctor helper filters `my_patients`, `upcoming_with_me`, `last_visit_with_me`. Legacy `name` and `phone` aliases are tolerated but new frontend code should use canonical names.

### Scheduling / Working Hours / Availability Exceptions

- `GET /api/doctors/`
- `GET /api/clinic-default-shifts/`, `POST`, `PATCH`, and versioned `activate`/`deactivate` actions - Admin only; no DELETE.
- `GET /api/working-shifts/` - Admin sees all; Staff and Doctor see own rows only. Admin-only `POST`, `PATCH`, versioned `activate`/`deactivate`, `apply-default`, and `copy-schedule`; no DELETE.
- `POST /api/working-shifts/apply-default/` - modes `MISSING_ONLY` and `REPLACE_ALL`; copied rows are independent.
- `POST /api/working-shifts/copy-schedule/` - copies active source rows independently using `MISSING_ONLY` or `REPLACE_ALL`.
- `GET /api/doctors/{doctor_id}/working-hours/` - compatibility read backed by `WorkingShift`; Admin/Staff can read any Doctor and Doctor can read self.
- `PUT /api/doctors/{doctor_id}/working-hours/` - Admin-only compatibility replacement with explicit appointment-impact confirmation when required.
- `GET /api/availability-exceptions/`
- `POST /api/availability-exceptions/` - Admin only create leave/unavailable/available override.
- `GET /api/availability-exceptions/{id}/`
- `PATCH /api/availability-exceptions/{id}/` - Admin only update uncancelled exception; requires `version`.
- `POST /api/availability-exceptions/{id}/cancel/` - Admin only cancel/void leave; requires `version`.
- `DELETE /api/availability-exceptions/{id}/` - do not use. Admin receives `405 METHOD_NOT_ALLOWED`; Staff/Doctor receive permission denial.

Working shift query params: `employee_id`, `role`, `weekday`, `is_active`. Availability query params: `doctor_id`, `staff_id`, `type`, `start_from`, `end_to`, `is_cancelled`.

Shift/default/leave stale writes return `VERSION_CONFLICT`. Doctor schedule changes that invalidate future appointments return `SHIFT_CHANGE_REQUIRES_CONFIRMATION` until resent with `confirm_appointment_impact: true`; confirmed appointments expose `reschedule_source_type: SHIFT_CHANGE`.

### Appointments

- `GET /api/appointments/` - paged list.
- `POST /api/appointments/` - Staff only create.
- `GET /api/appointments/{id}/`
- `PATCH /api/appointments/{id}/` - Staff only update/reschedule. Direct `status` changes are rejected.
- `POST /api/appointments/{id}/check-in/` - Staff only.
- `POST /api/appointments/{id}/cancel/` - Staff only.
- `POST /api/appointments/{id}/no-show/` - Staff only.
- `POST /api/appointments/{id}/start-visit/` - Doctor only, own checked-in appointment.
- `GET /api/appointments/availability/` - Admin/Staff/Doctor availability slots.

Appointment query params: `doctor_id`, `patient_id`, `status`, `date`, `start_from`, `start_to`.

Availability query params: required `doctor_id`, `date=YYYY-MM-DD`; optional `duration_minutes`.

### Visits / Clinical Notes

- `GET /api/visits/` - paged visit list.
- `GET /api/visits/active/` - Doctor active visit.
- `GET /api/visits/{id}/`
- `PATCH /api/visits/{id}/clinical-notes/` - Doctor only, own visit.
- `POST /api/visits/{id}/complete/` - Doctor only, own active visit.
- `POST /api/visits/{id}/xrays/` - Doctor only, own visit X-ray upload.
- `POST /api/visits/{id}/billing-handoff/` - Doctor only, own completed visit.

Visit query params: `doctor_id`, `patient_id`, `appointment_id`, `status`, `started_from`, `started_to`.

### X-rays

- `GET /api/xrays/` - saved X-ray list.
- `GET /api/xrays/{id}/`
- `GET /api/xrays/{id}/file/` - protected binary media.
- `POST /api/xrays/{id}/run-ai/` - Doctor only on readable saved X-ray.
- `GET /api/xrays/{id}/ai-result/`
- `GET /api/xrays/{id}/ai-overlay/` - protected PNG media.

X-ray query params: `patient_id`, `visit_id`, `uploaded_by`.

Uploads are not done through `POST /api/xrays/`; use patient or visit upload endpoints.

### AI Results

AI results are accessed through X-ray or external X-ray actions:

- `POST /api/xrays/{id}/run-ai/`
- `GET /api/xrays/{id}/ai-result/`
- `GET /api/xrays/{id}/ai-overlay/`
- `POST /api/external-xrays/{id}/run-ai/`
- `GET /api/external-xrays/{id}/ai-result/`
- `GET /api/external-xrays/{id}/ai-overlay/`
- `GET /api/patients/{id}/ai-results/`

There is no standalone `/api/ai-results/` viewset.

### External X-ray Workspace

- `GET /api/external-xrays/` - Admin all; Doctor own; Staff denied.
- `POST /api/external-xrays/` - Admin/Doctor upload temporary case.
- `GET /api/external-xrays/{id}/`
- `GET /api/external-xrays/{id}/file/` - protected binary media.
- `POST /api/external-xrays/{id}/run-ai/` - temporary cases only.
- `GET /api/external-xrays/{id}/ai-result/`
- `GET /api/external-xrays/{id}/ai-overlay/` - protected PNG media.
- `POST /api/external-xrays/{id}/attach-to-patient/` - Doctor only, own temporary case.
- `POST /api/external-xrays/{id}/discard/` - Admin/Doctor on readable temporary case.

External query params: `status`, `uploaded_by`, `created_from`, `created_to`.

Effective methods are `GET`, `POST`, and action routes only. No frontend `PATCH` or `DELETE`.

### Billing Handoffs

- `GET /api/billing-handoffs/` - Admin/Staff all; Doctor own.
- `GET /api/billing-handoffs/{id}/`
- `POST /api/billing-handoffs/{id}/dismiss/` - Staff only.
- `POST /api/billing-handoffs/{id}/convert-to-invoice/` - Staff only.
- `POST /api/visits/{id}/billing-handoff/` - Doctor creates handoff for own completed visit.

Handoff query params: `status`, `doctor_id`, `patient_id`, `visit_id`, `created_from`, `created_to`.

### Invoices / Payments

- `GET /api/invoices/` - Admin/Staff only.
- `POST /api/invoices/` - Staff only.
- `GET /api/invoices/{id}/` - Admin/Staff only.
- `PATCH /api/invoices/{id}/` - Staff only.
- `POST /api/invoices/{id}/cancel/` - Staff only.
- `GET /api/invoices/{id}/payments/` - Admin/Staff only.
- `POST /api/invoices/{id}/payments/` - Staff only.
- `GET /api/invoices/{id}/print-data/` - Admin/Staff only.

Invoice query params: `status`, `patient_id`, `visit_id`, `appointment_id`, `currency`, `created_from`, `created_to`.

### Dashboard

- `GET /api/dashboard/admin/` - Admin only.
- `GET /api/dashboard/staff/` - Staff only.
- `GET /api/dashboard/doctor/` - Doctor only.

### Audit Logs

- `GET /api/audit-logs/` - Admin only, paged.
- `GET /api/audit-logs/{id}/` - Admin only.

Audit query params: `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `created_from`, `created_to`.

### Protected Media

Protected media endpoints require authenticated `Authorization: Bearer <access>` requests and return `FileResponse` with `Cache-Control: no-store`, `Pragma: no-cache`, and `X-Content-Type-Options: nosniff`.

- `GET /api/xrays/{id}/file/`
- `GET /api/xrays/{id}/ai-overlay/`
- `GET /api/external-xrays/{id}/file/`
- `GET /api/external-xrays/{id}/ai-overlay/`

### Health

- `GET /api/` - public API root, returns health URL.
- `GET /api/health/` - public health check, returns `{ "status": "ok" }`.

## B. Frontend Route Map

Recommended React route structure:

```txt
/login
/change-password

/admin
/admin/dashboard
/admin/team (planned Phase 14D; not exposed by the runtime router)
/admin/team/:memberId (planned Phase 14D; not exposed by the runtime router)
/admin/users
/admin/users/new
/admin/users/:userId
/admin/clinic-settings
/admin/doctors
/admin/doctors/:doctorId/schedule
/admin/leave
/admin/leave/:exceptionId
/admin/patients
/admin/patients/:patientId
/admin/appointments
/admin/appointments/day
/admin/appointments/week
/admin/appointments/month
/admin/appointments/list
/admin/appointments/needs-reschedule
/admin/visits/:visitId
/admin/xrays
/admin/xrays/:xrayId
/admin/external-xrays
/admin/external-xrays/:caseId
/admin/billing/handoffs
/admin/billing/handoffs/:handoffId
/admin/billing/invoices
/admin/billing/invoices/:invoiceId
/admin/billing/invoices/:invoiceId/print
/admin/audit-logs
/admin/audit-logs/:auditLogId

/staff
/staff/dashboard
/staff/patients
/staff/patients/new
/staff/patients/:patientId
/staff/appointments
/staff/appointments/day
/staff/appointments/week
/staff/appointments/month
/staff/appointments/list
/staff/appointments/needs-reschedule
/staff/appointments/:appointmentId/reschedule
/staff/doctors/:doctorId/schedule
/staff/profile/schedule
/staff/profile/leave
/staff/visits/:visitId
/staff/xrays
/staff/xrays/:xrayId
/staff/billing/handoffs
/staff/billing/handoffs/:handoffId
/staff/billing/invoices
/staff/billing/invoices/new
/staff/billing/invoices/:invoiceId
/staff/billing/invoices/:invoiceId/payments
/staff/billing/invoices/:invoiceId/print

/doctor
/doctor/dashboard
/doctor/appointments
/doctor/appointments/day
/doctor/appointments/week
/doctor/appointments/list
/doctor/appointments/needs-reschedule
/doctor/visits/active
/doctor/visits/:visitId
/doctor/patients
/doctor/patients/:patientId
/doctor/patients/:patientId/clinical-history
/doctor/xrays
/doctor/xrays/:xrayId
/doctor/external-xrays
/doctor/external-xrays/:caseId
/doctor/profile/schedule
/doctor/profile/leave
/doctor/billing/handoffs
/doctor/billing/handoffs/:handoffId
```

Patient profile nested views should include `overview`, `appointments`, `visits`, `clinical-notes`, `xrays`, `ai-results`, and role-aware `billing` links for Staff/Admin only.

Needs Reschedule must be a tab/view inside appointment pages, not a side panel.

## C. Role-Based Frontend Access Map

### Admin

Visible sidebar items:

- Dashboard
- Team (planned Phase 14D; API foundation is ready)
- Users
- Doctors and schedules
- Clinic settings
- Leave management
- Patients
- Appointments
- Visits / clinical history
- Saved X-rays / AI results
- External X-ray workspace
- Billing handoffs
- Invoices
- Audit logs

Allowed pages:

- Admin dashboard, user management, clinic settings, clinic default shifts, Doctor/Staff working shifts, availability exceptions, and audit logs.
- Read-only operational pages for patients, appointments, visits, X-rays, AI results, billing handoffs, invoices, payments.
- External X-ray workspace is available to Admin for upload, AI run, discard, and read.

Allowed actions:

- Create/update/deactivate users, reset passwords.
- Update clinic settings.
- Create, edit, activate, deactivate, apply, copy, and replace Doctor or Staff working shifts; manage clinic default templates.
- Create/update/cancel doctor or staff availability exceptions.
- Upload/run/discard external X-ray cases.

Read-only pages:

- Patients, appointments, visits, clinical notes, billing operational records, invoices/payments.

Hidden actions:

- Patient create/edit/archive/unarchive.
- Appointment create/update/status transitions/reschedule.
- Visit start/complete/clinical note edit.
- Saved patient/visit X-ray upload.
- Billing handoff conversion/dismissal.
- Invoice/payment create/update/cancel.
- Leave hard delete.

### Staff

Visible sidebar items:

- Dashboard
- Patients
- Appointments
- Needs Reschedule
- Doctor schedules/unavailable blocks
- Billing handoffs
- Invoices/payments
- Saved X-rays / AI results
- Profile schedule
- Profile leave

Allowed pages:

- Staff dashboard, patients, appointment calendar/list, Needs Reschedule tab, reschedule flow, billing handoffs, invoices, payments, read-only visits and X-rays, own leave/profile schedule views.

Allowed actions:

- Create/update/archive/unarchive patients.
- Create/update/reschedule appointments.
- Check in, cancel, mark no-show appointments.
- Convert/dismiss billing handoffs.
- Create/update/cancel invoices according to backend locks.
- Record payments.
- Read doctor unavailable blocks for scheduling.

Read-only pages:

- Visit details and clinical notes for Admin, Staff, and non-owning Doctors.
- Saved X-rays and AI results.
- Own leave/profile schedule.
- Doctor working hours and availability exceptions.

Hidden actions:

- User management, clinic settings update, schedule/leave create/update/cancel.
- Start/complete visits.
- Edit clinical notes.
- Upload patient/visit X-rays.
- External X-ray workspace.
- Run AI.
- Leave hard delete.

### Doctor

Visible sidebar items:

- Dashboard
- My appointments
- Needs Reschedule
- Active visit
- Patients
- Clinical history
- X-rays / AI
- External X-ray workspace
- My billing handoffs
- Profile schedule
- Profile leave

Allowed pages:

- Doctor dashboard, own appointment views, active visit, patient list/profile/clinical history for active/non-archived patients, saved X-rays/AI results, own external X-ray workspace, own billing handoffs, own schedule/leave profile views.

Allowed actions:

- Start own checked-in appointment.
- Complete own active visit.
- Edit only own visit clinical notes.
- Upload X-rays to own visit or patient profile.
- Run AI on readable saved X-rays.
- Upload/run/discard own temporary external X-ray cases.
- Attach own temporary external X-ray case to any active/non-archived patient; optional visit link must be own visit for that patient.
- Update allowed patient profile fields for active/non-archived patients.
- Create billing handoff for own completed visit.

Read-only pages:

- Other doctors' clinical notes and historical visits.
- Own schedule and leave.
- Own appointment list when not actionable.
- Own billing handoffs after creation.

Hidden actions:

- User management, clinic settings, global billing, invoices, payments, audit logs.
- Patient archive/unarchive.
- Appointment create/update/check-in/cancel/no-show/reschedule.
- Start or complete another doctor's visit.
- Edit another doctor's clinical notes.
- Create/update/cancel leave.
- Leave hard delete.

## D. Data Contract Map

### Shared Shapes

`AuthUser`:

```ts
{
  id: number
  email: string
  full_name: string
  role: "ADMIN" | "STAFF" | "DOCTOR"
  is_active: boolean
  theme_preference: "LIGHT" | "DARK" | "SYSTEM"
  language_preference: "EN" | "AR"
  must_change_password: boolean
  password_changed_at: string | null
}
```

`UserSummary`: `id`, `email`, `full_name`, `role`, `is_active`, `theme_preference`, `language_preference`.

`PatientList`: `id`, `first_name`, `last_name`, computed `full_name`, `gender` (`Male` or `Female`), `date_of_birth`, computed `age`, `phone_number`, `email`, `national_id_or_passport`, `blood_group`, `is_archived`, `version`, optional `last_visit_with_me_at`, `created_at`, `updated_at`.

`PatientDetail`: `PatientList` plus `address`, `emergency_contact`, `medical_conditions_history`, `insurance_info`, `general_notes`, `created_by`, `updated_by`.

`AppointmentDetail`: `id`, `patient`, `doctor`, `start_datetime`, `end_datetime`, `duration_minutes`, `reason`, `notes`, `status`, `reschedule_source_exception`, `reschedule_previous_status`, `created_by`, `updated_by`, timestamps.

`VisitDetail`: `id`, `appointment`, `patient`, `doctor`, `status`, `started_at`, `completed_at`, `symptoms`, `diagnosis`, `treatment`, `clinical_notes`, `follow_up_notes`, `created_by`, `updated_by`, timestamps.

`XrayAttachment`: `id`, `patient`, `visit`, `uploaded_by`, `source`, `title`, `notes`, `stored_file_name`, `original_file_name`, `content_type`, `size_bytes`, `file_endpoint`, `ai_result_endpoint`, `ai_overlay_endpoint`, `has_ai_result`, timestamps.

`AIResult`: `id`, `xray_attachment`, `external_xray_case`, `status`, `result_summary`, `overall_confidence`, `overall_confidence_percent`, `findings`, `overlay_available`, `model_version`, `error_message`, `disclaimer`, `disclaimer_ar`, timestamps.

### Login

- Endpoint: `POST /api/auth/login/`
- Payload: `{ email: string, password: string }`
- Success: `{ access, refresh, user: AuthUser }`
- Errors: `INVALID_CREDENTIALS` 401; `VALIDATION_ERROR` with `email` or `password`.
- Important behavior: inactive users fail authentication as invalid credentials.

### Change Password

- Endpoint: `POST /api/auth/change-password/`
- Payload: `{ current_password, new_password }`
- Success: `AuthUser` with `must_change_password: false`.
- Errors: `current_password` incorrect; Django password validator errors on `new_password`.

### Admin Dashboard

- Endpoint: `GET /api/dashboard/admin/`
- Response: counts for active patients, today's appointments, checked-in, needs-reschedule, active visits, pending handoffs, unpaid invoices; arrays `recent_appointments`, `recent_invoices`.
- Errors: 403 if not Admin.

### Staff Dashboard

- Endpoint: `GET /api/dashboard/staff/`
- Response: today counts and arrays for `upcoming_today_appointments`, `checked_in_appointments`, `needs_reschedule_appointments`, `pending_billing_handoffs`, `unpaid_or_partially_paid_invoices`, `recent_patients`, `own_working_schedule`, `own_availability_exceptions`, `doctor_unavailable_exceptions`.
- Errors: 403 if not Staff.

### Doctor Dashboard

- Endpoint: `GET /api/dashboard/doctor/`
- Response: `today_own_appointments`, `own_checked_in_appointments`, `own_needs_reschedule_appointments`, `own_active_visit`, `own_completed_visits_today_count`, `own_recent_visits`, `own_pending_billing_handoffs`, `own_working_schedule`, `own_availability_exceptions`.
- Errors: 403 if not Doctor.

### Users

- Endpoints: `GET/POST /api/users/`, `GET/PATCH /api/users/{id}/`, `POST /api/users/{id}/reset-password/`, `POST /api/users/{id}/deactivate/`, `POST /api/users/{id}/transition-role/`, `POST /api/users/{id}/reactivate/`.
- Create payload: generic users create Admin accounts only. Doctor/Staff account creation returns `PROFILE_REQUIRED` and is handled by Team onboarding.
- Update payload: editable account fields plus optional `password|temporary_password`; protected role changes are rejected and require transition preview/confirmation.
- Reset payload: `{ temporary_password }`
- Response: user management shape with `must_change_password`, `password_changed_at`, timestamps, `version`, `linked_profile_state`, and valid `team_member_id`.
- Errors: password validation, duplicate email, `PROFILE_REQUIRED`, protected-role error, self/last-active-Admin safeguards, and stable reactivation errors.

### Doctors / Staff Management

- Doctors selector: `GET /api/doctors/`
- Team directory: Admin-only `GET/POST /api/team-members/`, `GET/PATCH /api/team-members/{id}/`, and `POST /api/team-members/{id}/set-professional-status/`.
- Team create is transactional and accepts matching Doctor `{ specialty?, phone?, bio? }` or Staff `{ position?, phone? }` profile payloads only. Team update/status requires the current profile `version`.
- User management: generic `/api/users/` creates Admin accounts only and cannot change professional role state directly.
- Clinic defaults: current Admin-only `/api/clinic-default-shifts/` contract. Records are versioned templates and never propagate automatically.
- Generic employee schedules: current `/api/working-shifts/` contract supports Doctor and Staff. Admin manages rows; Staff and Doctor list/read only their own rows.
- Schedule actions: `POST /api/working-shifts/apply-default/` and `POST /api/working-shifts/copy-schedule/`, supporting `MISSING_ONLY` and `REPLACE_ALL`.
- Doctor compatibility route: `GET/PUT /api/doctors/{doctorId}/working-hours/`, backed by `WorkingShift`. Staff may read Doctor hours for appointment scheduling; Admin alone may use compatibility replacement.
- Shift/default/leave mutations require versions. Errors include `VERSION_REQUIRED`, `VERSION_CONFLICT`, `SHIFT_OVERLAP`, `INVALID_SHIFT_TIME`, and `SHIFT_CHANGE_REQUIRES_CONFIRMATION`.
- Professional/login status is intentionally separate. Team excludes legacy unlinked professional users; generic user detail represents them as `PROFILE_SETUP_REQUIRED`.

### Clinic Settings

- Endpoint: `GET/PATCH /api/clinic/settings/`
- Patch payload: full settings fields. Staff/Doctor must not see or patch `ai_mode` or `ai_service_url`.
- Important values: currencies `SYP`, `USD`; languages `EN`, `AR`; AI modes `MOCK_ADAPTER`, `DJANGO_INTERNAL`, `SEPARATE_SERVICE`.
- Errors: invalid capacity, unsupported durations, default duration not allowed, unsupported currencies, default currency not supported.

### Patients List

- Endpoint: `GET /api/patients/`
- Query params: `page`, `is_archived`, `first_name`, `last_name`, `phone_number`, `email`, `national_id_or_passport`, `search`, Doctor helper filters `my_patients`, `upcoming_with_me`, `last_visit_with_me`.
- Response: `Page<PatientList>`.
- Behavior: Admin/Staff default hides archived patients; Doctors only see active/non-archived patients.

### Patient Profile

- Endpoints: `GET/PATCH /api/patients/{id}/`, `POST /archive/`, `POST /unarchive/`
- Create payload: `{ first_name, last_name, gender, date_of_birth?, phone_number?, email?, national_id_or_passport?, address?, emergency_contact?, blood_group?, medical_conditions_history?, insurance_info?, general_notes? }`.
- Update payload: same editable fields plus required `{ version }`.
- Archive/unarchive payload: `{ version }`.
- Response: `PatientDetail`.
- Errors: required `first_name`, required `last_name`, required `gender`, future `date_of_birth`, duplicate non-null `national_id_or_passport`, `VERSION_REQUIRED` 400, `VERSION_CONFLICT` 409, `ARCHIVE_BLOCKED` 409 for blocking appointments.
- Role notes: Admin read-only; Staff edit/archive; Doctor can update full profile fields but cannot archive/unarchive and only sees active/non-archived patients. Direct `PATCH is_archived` is rejected.

### Appointment Day / Week / Month / List

- Endpoint: `GET /api/appointments/`
- Query params: `date` for day, `start_from` and `start_to` for week/month/list ranges, optional `doctor_id`, `patient_id`, `status`, `page`.
- Response: `Page<AppointmentList>`.
- Status values: `UPCOMING`, `CHECKED_IN`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `NEEDS_RESCHEDULE`.
- Admin/Staff can list all; Doctor list is limited to own appointments.

### Current Capability and Status Summary

- Phase 13E.1 is the accepted patient schema/frontend contract upgrade.
- Phase 13F.1 is complete and implements shift-aware scheduling and availability administration.
- Phase 13G is complete and implements Doctor active visit/detail routes, own clinical-note editing, explicit completion confirmation, and role-scoped read-only visit history with existing APIs.
- Phase 13H is complete: saved X-ray detail/upload, authenticated Blob requests with temporary object URLs, AI result/overlay presentation, and external workspace use the existing backend contract. Staff has no external workspace; only the owning Doctor may attach a temporary case. Browser QA remains pending.
- Phase 13I is complete: role-aware billing handoffs, invoices, payments, and print data use existing backend APIs and backend-controlled financial values.
- Historical Phase 13I verification: backend runtime and migrations unchanged; 405 backend tests and 49 frontend tests passed; browser QA remained pending.
- Phase 13J is complete: Admin routes implement user create/update/reset/deactivation, full clinic settings, and read-only audit logs.
- Phase 13K completed the functional frontend: final regression, route/navigation cleanup, accessibility polish, and documentation consistency validation required no backend runtime or migration changes.
- Phase 14A completed the deterministic, development-only integrated demo story across the implemented frontend views. Browser QA remains pending.
- Phase 14B completed the UI refocus design freeze.
- Phase 14C.0 completed the Admin-only Team/account-linkage API foundation: transactional onboarding, linked-profile states, protected role transitions, reactivation, and frontend contract wrappers. Runtime Team and Users & Access pages remain Phase 14D.
- Next is Phase 14D — Priority Workflows: Dashboards, Appointments, Patients, Team, and Users & Access; deployment remains paused.

### Needs Reschedule Tab

- Endpoint: `GET /api/appointments/?status=NEEDS_RESCHEDULE`
- Response: `Page<AppointmentList>`.
- Multiple `NEEDS_RESCHEDULE` appointments may point to the same `reschedule_source_exception`; show all rows independently and support one-by-one rescheduling.

### Reschedule Flow With Available Doctors / Timeslots

- Endpoints:
  - `GET /api/doctors/`
  - `GET /api/appointments/availability/?doctor_id={id}&date=YYYY-MM-DD&duration_minutes={minutes}`
  - `PATCH /api/appointments/{id}/`
- Patch payload: `{ doctor_id?, start_datetime?, duration_minutes?, reason?, notes? }`
- Availability response: `{ doctor_id, date, duration_minutes, capacity_per_slot, available_slots: [{ start_datetime, end_datetime, current_count, capacity }] }`
- Behavior: if a `NEEDS_RESCHEDULE` appointment is patched with `doctor_id`, `start_datetime`, or `duration_minutes`, backend returns it to `UPCOMING` and clears reschedule metadata.
- Errors: `OUTSIDE_WORKING_HOURS`, `DOCTOR_UNAVAILABLE`, `CAPACITY_FULL`, `DOCTOR_ALREADY_BOOKED`, `INVALID_STATUS_TRANSITION`, `VALIDATION_ERROR`.

### Working Shifts and Compatibility Working Hours

- `ClinicDefaultShift` is the versioned clinic template model. Defaults require explicit application and do not remain live-linked to employee schedules.
- `WorkingShift` is the schedule model for Doctor and Staff. Split shifts are supported, active overlaps are rejected, and shifts are deactivated rather than deleted.
- Generic endpoints: `/api/working-shifts/` with Admin-only create/update/activate/deactivate/apply-default/copy-schedule actions. Staff and Doctor generic reads are limited to their own rows.
- Compatibility endpoint: `GET/PUT /api/doctors/{doctorId}/working-hours/`, backed by `WorkingShift`. Admin/Staff can read any Doctor, Doctor can read self, and only Admin can use `PUT`.
- Doctor-impacting changes return `SHIFT_CHANGE_REQUIRES_CONFIRMATION` before mutation. Confirmed changes mark only affected future appointments `NEEDS_RESCHEDULE` with `SHIFT_CHANGE` source metadata.

### Availability / Leave Management

- Endpoints: `GET/POST /api/availability-exceptions/`, `GET/PATCH /api/availability-exceptions/{id}/`, `POST /api/availability-exceptions/{id}/cancel/`
- Create payload: `{ doctor_id? | staff_id?, start_datetime, end_datetime, type, reason? }`; update and cancel payloads require `version`.
- Type values: `UNAVAILABLE`, `AVAILABLE_OVERRIDE`.
- Response includes target summaries, `is_cancelled`, `cancelled_at`, `cancelled_by`, creator/updater summaries.
- Cancel response additionally includes `restored_appointments_count`, `still_blocked_appointments_count`.
- Errors: exactly one target required, end before start, updating cancelled exception, `VERSION_REQUIRED`, `VERSION_CONFLICT`, and already cancelled 409.

### Doctor / Staff Own Profile Schedule / Leave View

- Doctor endpoints: role-scoped `GET /api/working-shifts/`, compatibility `GET /api/doctors/{me.id}/working-hours/`, and own availability-exception/appointment queries.
- Staff endpoints: role-scoped `GET /api/working-shifts/` and own availability exceptions. Staff may also read any Doctor through the compatibility working-hours route for appointment scheduling.
- Staff and Doctor dashboards return real `own_working_schedule` rows from `WorkingShift` plus real own availability exceptions.
- Both roles are read-only and cannot create/update/cancel leave.

### Visit Details

- Endpoints: `GET /api/visits/{id}/`, `GET /api/visits/?patient_id={id}`, `GET /api/patients/{id}/visits/`
- Response: visit list/detail shapes.
- Doctor detail access includes full clinical history for active/non-archived patients.

### Active Visit

- Endpoints: `POST /api/appointments/{id}/start-visit/`, `GET /api/visits/active/`, `POST /api/visits/{id}/complete/`
- Start rule: appointment must be own, `CHECKED_IN`, and doctor must not already have an active visit.
- Complete rule: visit must be own and `ACTIVE`.
- Errors: `ACTIVE_VISIT_EXISTS`, `INVALID_STATUS_TRANSITION`, `NOT_FOUND`.

### Clinical Notes

- Endpoint: `PATCH /api/visits/{id}/clinical-notes/`
- Payload: `{ symptoms?, diagnosis?, treatment?, clinical_notes?, follow_up_notes? }`
- Response: `VisitDetail`.
- Errors: blocked fields return `VALIDATION_ERROR`; other doctors cannot edit; completed own visits are still editable by owning doctor because service does not reject completed status.

### Saved X-rays

- Endpoints:
  - `GET /api/xrays/`
  - `GET /api/patients/{id}/xrays/`
  - `POST /api/patients/{id}/xrays/`
  - `POST /api/visits/{id}/xrays/`
- Upload payload: `multipart/form-data` with `file`, optional `title`, `notes`.
- Allowed files: `.png`, `.jpg`, `.jpeg`; content type `image/png` or `image/jpeg`; max size `10 MB`.
- Errors: `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`, missing `file`.

### Saved AI Results

- Endpoints: `GET /api/patients/{id}/ai-results/`, `GET /api/xrays/{id}/ai-result/`, `POST /api/xrays/{id}/run-ai/`.
- Result status values: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
- Current MVP run behavior returns completed mock result when clinic `ai_mode` is `MOCK_ADAPTER`; other modes return `AI_SERVICE_NOT_CONFIGURED` 503.
- Frontend must display returned disclaimer text with AI output.

### External X-ray Workspace

- Endpoints: `GET/POST /api/external-xrays/`, detail/file/run-ai/ai-result/ai-overlay/discard/attach-to-patient actions.
- Upload payload: `multipart/form-data` with `file`, optional `title`, `notes`.
- Attach payload: `{ patient_id, visit_id?, title?, notes? }`
- Status values: `TEMPORARY`, `ATTACHED_TO_PATIENT`, `DISCARDED`.
- Temporary-only actions: run AI, discard, attach.
- Staff has no access.

### Billing Handoffs

- Doctor creation endpoint: `POST /api/visits/{id}/billing-handoff/`
- Doctor payload: `{ note?, suggested_amount?, currency? }`; if amount is supplied, currency is required.
- Staff endpoints: `GET /api/billing-handoffs/`, `POST /api/billing-handoffs/{id}/convert-to-invoice/`, `POST /api/billing-handoffs/{id}/dismiss/`
- Convert payload: `{ total_amount?, currency?, notes? }`; if omitted, backend can use handoff suggested amount/currency.
- Dismiss payload: `{ dismissed_reason? }`
- Handoff statuses: `PENDING`, `CONVERTED_TO_INVOICE`, `DISMISSED`.

### Invoices

- Endpoints: `GET/POST /api/invoices/`, `GET/PATCH /api/invoices/{id}/`, `POST /api/invoices/{id}/cancel/`, `GET /api/invoices/{id}/print-data/`.
- Create payload: `{ patient_id, visit_id?, appointment_id?, total_amount, currency, notes? }`
- Update payload: same fields optional.
- Cancel payload: `{ cancelled_reason? }`
- Status values: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`.
- Backend-controlled fields that frontend must never submit: `billing_handoff`, `billing_handoff_id`, `invoice_number`, `paid_amount`, `remaining_amount`, `status`, `payments`, `payment_count`.

### Payments

- Endpoint: `GET/POST /api/invoices/{id}/payments/`
- Create payload: `{ amount, currency, payment_date?, notes? }`
- Response: `{ payment, invoice }`, where `invoice` is summary with recalculated paid/remaining/status.
- Errors: `PAYMENT_CURRENCY_MISMATCH`, `OVERPAYMENT_NOT_ALLOWED`, `INVOICE_CANCELLED`, positive amount validation.

### Audit Logs

- Endpoint: `GET /api/audit-logs/`
- Query params: `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `created_from`, `created_to`, `page`.
- Response: `Page<ActivityLog>`.
- Admin only.

## E. Authentication Integration Plan

- Store `access`, `refresh`, and `user` in an auth store.
- Send `Authorization: Bearer ${access}` for all protected API and protected media requests.
- Access token lifetime is 30 minutes; refresh token lifetime is 1 day.
- Refresh endpoint is `POST /api/auth/refresh/` with `{ refresh }`.
- Logout endpoint is `POST /api/auth/logout/` with `{ refresh }`; clear local auth state even if logout fails due expired/invalid refresh.
- `must_change_password` is returned at login and `/api/me/`. If true, route only to `/change-password` until changed.
- Inactive users fail login as `INVALID_CREDENTIALS`; if a token for an inactive user later fails auth, handle as 401.
- Recommended auth state:

```ts
type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  mustChangePassword: boolean
  role: "ADMIN" | "STAFF" | "DOCTOR" | null
  authStatus: "unknown" | "authenticated" | "anonymous"
}
```

- Route guards:
  - `AuthGuard`: require token and user.
  - `PasswordChangeGuard`: if `must_change_password`, allow only `/change-password` and logout.
  - `RoleGuard`: enforce allowed role per workspace.
  - `GuestGuard`: redirect authenticated users away from `/login`.
- Permission-denied handling:
  - 401: attempt one refresh; if refresh fails, clear auth and redirect login.
  - 403: show permission-denied state and remove disallowed action from UI.
  - 404: show not-found; for doctors this can mean hidden cross-doctor/archived resources.

## F. Appointment Integration Plan

Appointment statuses:

- `UPCOMING` - scheduled and editable/reschedulable by Staff.
- `CHECKED_IN` - patient checked in; Doctor can start own visit.
- `ACTIVE` - visit started; appointment locked from Staff edits.
- `COMPLETED` - visit completed; locked.
- `CANCELLED` - cancelled; locked.
- `NO_SHOW` - no-show; locked.
- `NEEDS_RESCHEDULE` - created by doctor leave/unavailable exception; Staff reschedules back to `UPCOMING`.

Calendar behavior:

- Day view: `GET /api/appointments/?date=YYYY-MM-DD`.
- Week/month view: use `start_from` and `start_to` ISO datetimes.
- List view: same endpoint with filters and pagination.
- Needs Reschedule: tab using `status=NEEDS_RESCHEDULE`.
- Doctor appointment views are automatically scoped to own appointments by backend.

Action rules:

- Staff creates and edits appointments.
- Staff status actions: `check-in`, `cancel`, `no-show`.
- Doctor starts visit from own checked-in appointment.
- Direct `status` patch is rejected; always use action endpoints.
- Multiple affected appointments are independent. Rescheduling one appointment does not resolve the rest.

Availability and conflict handling:

- Load doctors with `GET /api/doctors/`.
- Load slots with `GET /api/appointments/availability/`.
- Show doctor unavailable blocks from `GET /api/availability-exceptions/?doctor_id={id}&type=UNAVAILABLE`.
- Backend validates duration, past start, working hours, unavailable exceptions, clinic capacity, and doctor conflict.
- Render 409 business errors near the slot picker and let user choose a new slot.

## G. Current Schedule and Leave Integration

- Admin manages clinic defaults and Doctor/Staff schedules through generic shift APIs and apply-default/copy-schedule actions. The Doctor working-hours route remains a compatibility adapter.
- Admin manages doctor/staff leave through availability exceptions.
- Admin cancellation must call `POST /api/availability-exceptions/{id}/cancel/`.
- Frontend must not expose or call hard delete for leave.
- Doctor leave creation/update can mark future overlapping `UPCOMING` or `CHECKED_IN` appointments as `NEEDS_RESCHEDULE`.
- Cancelling doctor leave restores only appointments still in `NEEDS_RESCHEDULE` from that leave when the original slot is valid.
- Already-rescheduled appointments are not moved back.
- Staff leave is visibility-only and does not affect appointments.
- Staff can see all doctor exceptions plus own staff exceptions.
- Doctor and Staff can read their own generic shifts and leave. Staff can additionally read Doctor compatibility hours required for appointment scheduling.
- Doctor unavailable blocks are needed in appointment scheduling and reschedule views.

## H. Patient Profile Integration Plan

- Patient profile should load `GET /api/patients/{id}/`.
- Doctor clinical history should load visits, X-rays, and AI results for active/non-archived patients.
- Admin profile UI must be read-only.
- Staff can create/edit/archive/unarchive and can view archived patients by `is_archived=true`.
- Doctor can update allowed profile fields but must not render archive controls or submit `is_archived`.
- Archived patients:
  - Hidden by default for Admin/Staff lists.
  - Not accessible to Doctors.
  - Cannot be archived if blocking appointment statuses exist: `UPCOMING`, `CHECKED_IN`, `ACTIVE`, `NEEDS_RESCHEDULE`.

## I. Visit and Clinical Notes Integration (Phase 13G Complete)

- Staff checks in appointment.
- Doctor starts own checked-in appointment with `POST /api/appointments/{id}/start-visit/`.
- Doctor works from `/doctor/visits/active` using `GET /api/visits/active/`.
- Doctor updates notes with `PATCH /api/visits/{id}/clinical-notes/`.
- Doctor completes visit with `POST /api/visits/{id}/complete/`; appointment status becomes `COMPLETED`.
- Only the owning Doctor can edit a visit's clinical notes, complete it, upload visit X-rays, or create billing handoff.
- Other-doctor notes should be displayed read-only in patient history.
- Phase 13G routes: Doctor `/doctor/visits/active` and `/doctor/visits/:visitId`; Admin and Staff `/[role]/visits/:visitId` read-only.
- When clinical notes are dirty, the frontend saves the accepted five-field payload before requesting completion; a completion failure retains successfully saved notes.
- Phase 13I now lets the owning Doctor create a billing handoff from a completed visit and review own handoff status.

## J. X-ray and AI Integration Plan

- Saved patient X-rays:
  - Patient profile upload: `POST /api/patients/{id}/xrays/`.
  - Visit upload: `POST /api/visits/{id}/xrays/`.
  - List/read: `GET /api/xrays/` or patient detail action.
- Protected media:
  - Fetch media as `Blob` with auth headers.
  - Use `URL.createObjectURL(blob)` for image previews.
  - Revoke object URLs on unmount.
  - Do not store protected media URLs as permanent public image URLs.
- Saved AI results:
  - Run with `POST /api/xrays/{id}/run-ai/`.
  - Read with `GET /api/xrays/{id}/ai-result/`.
  - Overlay with protected blob endpoint.
- External X-ray workspace:
  - Admin and Doctor can upload temporary cases.
  - Staff cannot access external workspace.
  - Doctor sees only own external cases.
  - Temporary case can be run through AI, discarded, or attached.
- Attach-to-patient:
  - Doctor can attach own temporary case to any active/non-archived patient.
  - `visit_id` is optional.
  - If `visit_id` is supplied, it must belong to selected patient and requesting Doctor.
- AI mode limitations:
  - `MOCK_ADAPTER` returns research-only mock result.
  - `DJANGO_INTERNAL` and `SEPARATE_SERVICE` return `AI_SERVICE_NOT_CONFIGURED` until real AI exists.
- Medical disclaimer:
  - Always display `disclaimer` and/or `disclaimer_ar` from the AI result near AI findings.
  - Do not label AI output as a diagnosis.

## K. Billing Integration - Phase 13I Complete

- Doctor handoff:
  - Available only for own completed visits.
  - Endpoint `POST /api/visits/{id}/billing-handoff/`.
  - Payload `{ note?, suggested_amount?, currency? }`.
  - Pending handoff per visit is unique.
- Staff conversion:
  - `POST /api/billing-handoffs/{id}/convert-to-invoice/`.
  - Can use suggested amount/currency or provide overrides.
  - Converted handoff links to invoice and becomes immutable operational history.
- Invoice sequence:
  - Backend generates `INV-YYYYMMDD-000001` using DB-backed sequence with locking.
  - Frontend never generates invoice numbers.
- Invoice locked states:
  - If invoice has a billing handoff, patient/visit/appointment/handoff cannot change.
  - After any payment exists, amount and currency are locked; relation fields are locked.
  - Paid invoices cannot be cancelled.
  - Cancelled invoices cannot receive payments.
- Payment recording:
  - Staff posts payments to invoice.
  - Backend recalculates paid amount, remaining amount, and status.
  - Overpayment is rejected.
- Restrictions:
  - Doctor cannot access invoices/payments/global billing.
  - Admin can read billing and invoices/payments but cannot mutate operational billing records.
  - MVP has no online payment, tax, itemization, discount, or insurance workflow.

Phase 13I frontend implementation:

- Doctors create handoffs from own completed visits and read only own handoffs; they have no invoice or payment access.
- Staff converts or dismisses pending handoffs, creates direct invoices, edits eligible invoices, cancels eligible invoices, records payments, and uses print data.
- Admin has read-only handoff, invoice, payment, and print-data access.
- Invoice numbers, totals, balances, and statuses are backend-generated or backend-controlled. The frontend uses no delete action or direct status PATCH.
- Browser QA remains pending; backend runtime and migrations remain unchanged.

## L. Error-Handling Plan

Standard display:

- If `details` has field arrays, show field-level errors.
- If `details.non_field_errors` or `details.target`, show form-level error.
- Always keep `message` as a general alert fallback.

Status handling:

- 400 `VALIDATION_ERROR`: keep form open, mark invalid fields.
- 401 `AUTH_REQUIRED` or invalid token: refresh once, then logout/redirect.
- 403 `PERMISSION_DENIED`: show access denied and hide the attempted action for that role.
- 404 `NOT_FOUND`: show not found; for security-scoped resources this may mean "not available to this user".
- 405 `METHOD_NOT_ALLOWED`: frontend is calling a disallowed route; treat as developer/integration bug.
- 409 workflow conflicts: show business conflict and suggest the next valid action. Codes include `INVALID_STATUS_TRANSITION`, `CAPACITY_FULL`, `DOCTOR_ALREADY_BOOKED`, `DOCTOR_UNAVAILABLE`, `OUTSIDE_WORKING_HOURS`, `ARCHIVE_BLOCKED`, `ACTIVE_VISIT_EXISTS`, `BILLING_HANDOFF_ALREADY_CONVERTED`, `OVERPAYMENT_NOT_ALLOWED`, `INVOICE_CANCELLED`.
- 503 `AI_SERVICE_NOT_CONFIGURED`: show AI unavailable message, not a generic crash.

Network/offline fallback:

- Preserve unsaved form state.
- Show retry action.
- For calendar/clinical/billing mutation failures, refetch the affected record after reconnect before retrying.

## M. Frontend Implementation Recommendations

- API client:
  - `src/api/http.ts` for fetch/axios wrapper, auth headers, refresh retry, error normalization.
  - `src/api/endpoints/*.ts` grouped by domain: `auth`, `users`, `clinic`, `patients`, `appointments`, `schedule`, `visits`, `xrays`, `billing`, `dashboard`, `audit`.
- TypeScript types:
  - `src/types/api.ts` shared primitives and `Page<T>`.
  - Domain type files under `src/types/*.ts`.
- Auth store:
  - Zustand or Redux Toolkit store with persisted tokens and in-memory user.
  - Rehydrate by calling `/api/me/`.
- Role guards:
  - Central route metadata: `{ roles, requiresAuth, requiresPasswordChangeComplete }`.
  - Central action guard helper for buttons/menus.
- Query/cache:
  - TanStack Query recommended.
  - Use stable keys: `["appointments", filters]`, `["patient", id]`, `["availability", doctorId, date, duration]`, `["invoice", id]`.
  - Invalidate related keys after mutations.
- Forms:
  - React Hook Form plus Zod schemas that mirror backend required fields without duplicating business locks.
  - Map backend `details` to form errors.
- Protected media:
  - Dedicated `getProtectedBlob(endpoint)` helper.
  - Cache blob object URLs per component/session only; do not put blobs in global persisted state.
- Dashboard loading:
  - One dashboard endpoint per role. Do not compose dashboard from many calls unless adding drill-downs.
- Appointment calendar state:
  - Keep view state `{ mode: "day"|"week"|"month"|"list"|"needs-reschedule", date, filters }`.
  - Derive query ranges from mode.
  - Keep selected doctor/duration separate for availability flow.

## N. Backend Gaps or Frontend Risks

- Final Team and Users & Access runtime UI is not yet built; it remains Phase 14D work.
- Unsupported professional fields remain absent: gender, qualifications, license, profile photo, Staff biography, and activity notes.
- Browser QA remains pending.

No critical backend blocker was found for frontend integration planning.

## O. Historical Phase Order

- 13B — frontend foundation: Vite/React/TypeScript app structure, API client, environment config, and shared types.
- 13B.1 — design-system and responsive contract.
- 13C — authentication, layout, and role guards: login, refresh/logout, required password change, and workspace shells.
- 13D — role dashboards from role-specific endpoints.
- 13D.1 — local QA account seeding.
- 13E — patient list and profile integration.
- 13E.1 — final patient schema and version contract.
- 13F — appointments and rescheduling, including Needs Reschedule and availability flows.
- 13F.1 — shifts and availability administration: clinic defaults, Doctor/Staff schedules, versioned leave, and appointment-impact confirmation.
- 13G — visits and clinical notes: active visit workflow, own-note editing, explicit completion, and read-only history.
- 13H — X-rays, protected media, AI, and external workspace.
- 13I — billing handoffs, invoices, payments, and print data.
- 13J — Admin users, clinic settings, and audit logs.
- 13K — final regression, accessibility, route cleanup, documentation consistency, and release readiness. Backend runtime and migrations remained unchanged.
- 14A — deterministic, development-only integrated demo story across the implemented frontend views. Production API behavior and migrations remain unchanged.

- 14B — UI refocus design freeze; runtime implementation unchanged.
- 14C.0 — Team/account-linkage API foundation: Team endpoints, transactional onboarding, profile integrity/versioning, protected transitions, reactivation, documentation, and frontend contract wrappers; no runtime Team page.
- 14C — Shell, tokens, Lucide icons, and shared components: frontend-only v2 token layers, fixed/retractable role shell, preference persistence, centralized icon map, shared primitives, and focused automated verification; no backend contract change and no runtime Team page.

## Historical Phase 13A Completion Criterion

Historically, Phase 13A completed when this document was reviewed and accepted as the frontend implementation contract. This document now reflects the production contract through completed Phase 14C.0.
