# Backend Final Handoff

Project: Dental Clinic Management System Website

Current phase/status: 12K.Final.1 plus schedule/leave visibility hardening

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
- Patients: no hard delete, Staff archive/unarchive, archived patients hidden by default, archive blocked by `UPCOMING`, `CHECKED_IN`, `ACTIVE`, and `NEEDS_RESCHEDULE` appointments.
- Scheduling: working hours, availability exceptions, appointment capacity/conflict validation, doctor leave marking future overlapping appointments as `NEEDS_RESCHEDULE`, Staff reschedule back to `UPCOMING`, and leave cancel/void instead of hard delete.
- Visits and clinical records: Doctors start/complete own visits and edit own clinical notes; other roles are read-only or denied according to role.
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

Latest full regression:

```text
python -m pytest -q
397 passed
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

Recommended next step: frontend/backend integration pass.
