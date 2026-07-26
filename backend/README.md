# Dental Clinic Management System Backend

Read [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md) before backend work. This is setup guidance, not product/role authority. Current status is [`project_docs/PROJECT_STATUS.md`](project_docs/PROJECT_STATUS.md), current backend decisions are [`project_docs/CURRENT_BACKEND_DECISIONS.md`](project_docs/CURRENT_BACKEND_DECISIONS.md), and the current UI continues from `e54a85842f1c683b27f12e0da93987ae128c861d`, never the rejected `preview-pre-v2-ui` preview. Team and Users & Access remain distinct; doctor patient filters are not object-level authorization.

Django REST Framework backend for the Pearl Dental Clinic management system.

## Current verification status

Phase 14F.3 leaves production backend behavior unchanged. Its backend edits are confined to the DEBUG-only deterministic demo command and focused tests for named non-overlapping shifts, one service-started Doctor One active visit, an independent checked-in Doctor Two appointment, and distinct same-size transparent stored overlay media. The complete backend gate is 425 passing tests.

Phase 14R closed the backend regression gate with 418 passing tests. Scheduling evaluates clinic capacity by overlapping appointment intervals, uses the validated clinic IANA timezone for availability, excludes past same-day slots, and supports available overrides while unavailable exceptions take precedence. Browser/manual QA remains pending.

The API base path is `/api/`; the foundation health endpoint is:

```text
http://127.0.0.1:8000/api/health/
```

## Windows PowerShell Setup

Run backend commands from the `backend` directory with the virtual environment active.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
copy .env.example .env
```

Start the local PostgreSQL database from the repository root or from `backend`:

```powershell
docker compose up -d db
```

Then run:

```powershell
python manage.py migrate
python manage.py check
python -m pytest -q
python manage.py runserver
```

## Local Database

Local development uses Docker PostgreSQL by default, not an existing Windows PostgreSQL service.

Default `DATABASE_URL`:

```text
postgresql://pearlix:pearlix_dev_password@127.0.0.1:5433/pearlix
```

The compose service is `db`, uses `postgres:16`, and maps host port `5433` to container port `5432`.

## Troubleshooting

- All backend commands must run with `(.venv)` active.
- Docker Desktop must be running before `docker compose up -d db`.
- If port `5433` is occupied, stop the conflicting service or change both `docker-compose.yml` and `DATABASE_URL` consistently.
- Do not use the user's existing local Windows PostgreSQL by default.
- If `.env` already exists from an older setup, update its `DATABASE_URL` to match `.env.example`.
