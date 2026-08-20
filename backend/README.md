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

In the ignored `backend/.env`, set `PEARLIX_LOCAL_DB_PASSWORD` to a unique
URL-safe value and set `DATABASE_URL` to the URL shape documented below using
that same value. Use at least 32 random alphanumeric characters. The checked-in
values are empty so an unedited copy fails closed. The credential must not be
committed or reused outside this local stack.

Start the local PostgreSQL database from the repository root:

```powershell
cd ..
docker compose --env-file backend/.env up -d db
cd backend
```

Then run:

```powershell
python manage.py migrate --settings=config.settings.local
python manage.py check --settings=config.settings.local
python -m pytest -q
python manage.py runserver --settings=config.settings.local
```

The explicit `--settings=config.settings.local` argument is required for local management commands. Deployable WSGI/ASGI startup has no local fallback; its host must explicitly select `config.settings.production` through `DJANGO_SETTINGS_MODULE`.

## Local Database

Local development uses Docker PostgreSQL by default, not an existing Windows PostgreSQL service.

The ignored `backend/.env` supplies both `PEARLIX_LOCAL_DB_PASSWORD` to Docker
Compose and the matching password inside `DATABASE_URL` for Django. Its local
URL has this shape:

```text
postgresql://pearlix:<same-unique-local-password>@127.0.0.1:5433/pearlix
```

The compose service is `db`, uses `postgres:16`, and binds container port
`5432` only to host loopback at `127.0.0.1:5433`; it is not published to the
LAN. Compose exits before startup when `PEARLIX_LOCAL_DB_PASSWORD` is missing.

## Troubleshooting

- All backend commands must run with `(.venv)` active.
- Docker Desktop must be running before `docker compose --env-file backend/.env up -d db`.
- If port `5433` is occupied, stop the conflicting service or change both `docker-compose.yml` and `DATABASE_URL` consistently.
- Do not use the user's existing local Windows PostgreSQL by default.
- If `.env` already exists from an older setup, add `PEARLIX_LOCAL_DB_PASSWORD`, remove the old shared example password from `DATABASE_URL`, and keep both values identical.
