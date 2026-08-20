# Backend Final Handoff

Project: Dental Clinic Management System Website

Current phase/status: Phase 14C.0 Team Profile API and Account Linkage Foundation complete; deployment remains paused

Backend stack: Django, Django REST Framework, PostgreSQL

API base path: `/api/`

## Runtime

Local development expects Python virtualenv at `backend/.venv` and PostgreSQL from Docker Compose:

- Compose service: `db`
- Image: `postgres:16`
- Database: `pearlix`
- User: `pearlix`
- Host port: `5433`
- Local `DATABASE_URL`: use the ignored `backend/.env` and its unique
  `PEARLIX_LOCAL_DB_PASSWORD` as documented in `LOCAL_DEVELOPMENT.md`; the
  database binds only to `127.0.0.1:5433`.

Run backend commands from `backend` with the virtualenv active.

## Roles

- Admin: account management, password resets, clinic settings update, working hours and availability exception management, read-only operational records.
- Staff: patient creation/update/archive, appointment scheduling and rescheduling, read-only Handoff/Bill history, and payment-Invoice issuance from eligible existing Handoffs only.
- Doctor: clinic-wide active patient profile/history access, own appointment/visit workflow, own clinical notes, X-ray upload/AI run, and one OPEN Handoff/Bill created only by completing an own Visit.

## Capabilities

- Accounts: no public signup, Admin-created accounts, temporary-password flow, required password change support, authenticated change-password, Admin reset-password, self/last-admin deactivation safeguards, supported reactivation, and protected role transitions.
- Team profiles: Admin-only paged `/api/team-members/` list/detail/create/update/status APIs; User ID Team identifiers; transactional Doctor/Staff onboarding; profile/user optimistic versions; linkage-state summaries; profile-integrity command; and history-preserving transition blocks.
- Patients: final Phase 13E.1 patient schema, `Male`/`Female` gender contract, optional profile fields, nullable unique national ID/passport, computed `full_name`/`age`, versioned updates, no hard delete, Staff archive/unarchive, archived patients hidden by default, archive blocked by `UPCOMING`, `CHECKED_IN`, `ACTIVE`, and `NEEDS_RESCHEDULE` appointments.
- Scheduling: clinic default shift templates, independent Doctor and Staff working shifts, split-shift availability, versioned availability exceptions, explicit Doctor appointment-impact confirmation, appointment capacity/conflict validation, `NEEDS_RESCHEDULE` leave/shift source tracking, and no hard deletion.
- Visits and clinical records: Doctors start/complete own visits and edit own clinical notes; completed own notes remain editable where supported by the current service. The Phase 13G frontend provides Doctor active/detail routes and Admin/Staff read-only visit detail routes without changing backend behavior.
- X-rays and AI: authenticated Blob requests support saved X-ray list/detail/upload, protected persisted overlays, structured real DENTEX results in `DJANGO_INTERNAL` mode, and Admin/Doctor external workspace routes. Staff has no external-workspace access; only an owning Doctor may attach a temporary external case to a patient. The deterministic mock adapter is disabled outside explicit test settings, and unavailable modes fail closed with `AI_SERVICE_NOT_CONFIGURED`.
- Clinic settings: Admin sees and updates full settings; Staff/Doctor see safe settings only.
- Billing: Handoff is the total Bill and Invoice is one completed payment receipt. Doctor Active Visit completion is the only current-workflow Handoff creation path. One Visit has at most one Handoff, one Handoff has zero or many Invoices, Staff cannot create/edit/cancel Bills and may only issue Invoices from eligible Handoff detail, and all paid/remaining/status values are backend-controlled. Invoice numbers use a DB-backed date sequence with row locking. Historical migrated manual/cancelled Bills remain readable.
- Audit: key account, patient, scheduling, visit, X-ray, AI, Handoff/Invoice, clinic settings, and dashboard-adjacent actions are logged with sensitive metadata stripped.

## Security Decisions

- Backend permissions are authoritative; frontend hiding is not relied on.
- Direct status spoofing and calculated-field spoofing are rejected.
- Protected files are served through authenticated endpoints, not public media URLs.
- No broad rate limiting is enabled for normal clinic workflows.
- Secrets and local runtime files must remain uncommitted.

## Known MVP Limitations

- AI is mock-only; real internal/separate AI service integration is post-MVP.
- Email forgot-password is post-MVP; Admin reset-password is the MVP recovery path.
- Billing is cash/manual recording only.
- No online payments.
- No invoice itemization, tax, discount, or insurance.
- No automatic notifications for rescheduling or leave.
- Single-clinic scope only.

## Verification

Phase 13E.1 local migration precheck before applying the migration:

```text
patient_count=0
archived_count=0
gender_distribution=[]
unsafe_gender_sample=[]
appointment_fk_count=0
visit_fk_count=0
```

Safe local backup command before applying the migration:

```bash
cd backend
pg_dump "$DATABASE_URL" --file ../_local_backups/pearlix_before_13e1_patient_schema.sql
```

Phase 13E.1 migration checks:

```text
python manage.py showmigrations patients --settings=config.settings.local
patients.0001_initial applied
patients.0002_patient_schema_upgrade pending before migrate

python manage.py migrate --plan --settings=config.settings.local
patients.0002_patient_schema_upgrade planned

python manage.py migrate --settings=config.settings.local
patients.0002_patient_schema_upgrade OK
```

Post-migration aggregate checks:

```text
patient_count=0
archived_count=0
appointment_fk_count=0
visit_fk_count=0
null_patient_pk_count=0
missing_version_count=0
gender_distribution=[]
unexpected_gender_count=0
```

Phase 13F.1 scheduling migration precheck and postcheck:

```text
doctor_working_hour_count_before=0
active_doctor_working_hour_count_before=0
availability_exception_count_before=0
future_appointment_count_before=0
working_shift_count_after=0
availability_exception_count_after=0
appointment_count_after=0
staff_shift_count_after=0
clinic_default_shift_count_after=0
```

Safe local backup command:

```bash
pg_dump "$DATABASE_URL" --file ../_local_backups/pearlix_before_13f1_schedules.sql
```

Scheduling migration `0005_admin_shifts_availability` is applied locally; `migrate --plan` reports no planned operations.

## Current Verification (Phase 14C.0)

Latest full backend regression:

```text
python -m pytest -q
414 passed
```

Phase 14C.0 focused Team/account-linkage tests: 40 passed during development. The complete suite passed after stabilization. Phase 14A focused seed tests remain covered by the full suite.

Frontend Phase 14C.0 contract verification: 52 passed; typecheck and production build passed. No runtime Team/Users UI exists yet.

`accounts.0005_doctorprofile_version_staffprofile_version_and_more` is the only Phase 14C.0 migration. Browser QA remains pending; deployment remains paused.

Historical Phase 13K verification (superseded): 405 backend tests and 51 frontend tests passed.

Django check:

```text
passed
```

Migration drift check:

```text
no changes detected
```

Health endpoint:

```text
200 {"status":"ok"}
```

## Packaging Hygiene

Before handoff or upload, exclude:

- `.env`, `.env.*` except `.env.example`
- `.venv`, `venv`, `env`
- `media`, `test_media`
- `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`
- `db.sqlite3`
- `*.pyc`, local logs, generated uploads, protected X-rays, AI overlays
- local archives such as `*.zip`

## Next Step

Recommended next step: Phase 14C shell, tokens, Lucide icons, and shared components. Runtime Team and Users & Access screens remain Phase 14D. Deployment remains paused.
