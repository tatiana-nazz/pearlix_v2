# Backend Final Handoff

Project: Dental Clinic Management System Website

Current phase/status: 13G active visits and clinical notes frontend integration complete; backend contract unchanged

Backend stack: Django, Django REST Framework, PostgreSQL

API base path: `/api/`

## Runtime

Local development expects Python virtualenv at `backend/.venv` and PostgreSQL from Docker Compose:

- Compose service: `db`
- Image: `postgres:16`
- Database: `pearlix`
- User: `pearlix`
- Host port: `5433`
- Default local `DATABASE_URL`: `postgresql://pearlix:pearlix_dev_password@127.0.0.1:5433/pearlix`

Run backend commands from `backend` with the virtualenv active.

## Roles

- Admin: account management, password resets, clinic settings update, working hours and availability exception management, read-only operational records.
- Staff: patient creation/update/archive, appointment scheduling and rescheduling, billing handoff conversion, invoice and payment operations.
- Doctor: clinic-wide active patient profile/history access, own appointment/visit workflow, own clinical notes, X-ray upload/AI run, billing handoff creation for own completed visits.

## Capabilities

- Accounts: no public signup, Admin-created users, temporary-password flow, required password change support, authenticated change-password, Admin reset-password, self/last-admin deactivation safeguards.
- Patients: final Phase 13E.1 patient schema, `Male`/`Female` gender contract, optional profile fields, nullable unique national ID/passport, computed `full_name`/`age`, versioned updates, no hard delete, Staff archive/unarchive, archived patients hidden by default, archive blocked by `UPCOMING`, `CHECKED_IN`, `ACTIVE`, and `NEEDS_RESCHEDULE` appointments.
- Scheduling: clinic default shift templates, independent Doctor and Staff working shifts, split-shift availability, versioned availability exceptions, explicit Doctor appointment-impact confirmation, appointment capacity/conflict validation, `NEEDS_RESCHEDULE` leave/shift source tracking, and no hard deletion.
- Visits and clinical records: Doctors start/complete own visits and edit own clinical notes; completed own notes remain editable where supported by the current service. The Phase 13G frontend provides Doctor active/detail routes and Admin/Staff read-only visit detail routes without changing backend behavior.
- X-rays and AI: protected media, saved and external X-ray workflows, clinic-wide Doctor patient-profile attach for own temporary external cases, mock AI adapter with disclaimer, disabled real-service modes return `AI_SERVICE_NOT_CONFIGURED`.
- Clinic settings: Admin sees and updates full settings; Staff/Doctor see safe settings only.
- Billing: Doctors create handoffs for own completed visits; Staff converts handoffs to invoices and records payments; invoices/payments are hidden from Doctors; status and totals are backend-controlled; invoice numbers use a DB-backed date sequence with row locking.
- Audit: key account, patient, scheduling, visit, X-ray, AI, billing, payment, clinic settings, and dashboard-adjacent actions are logged with sensitive metadata stripped.

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
python manage.py showmigrations patients
patients.0001_initial applied
patients.0002_patient_schema_upgrade pending before migrate

python manage.py migrate --plan
patients.0002_patient_schema_upgrade planned

python manage.py migrate
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

Latest full regression:

```text
python -m pytest -q
405 passed
```

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

Recommended next step: Phase 13H, then 13I, 13J, and 13K.
