# Local development startup

Use the canonical local addresses below. Do not mix `localhost` and `127.0.0.1`.

```powershell
cd backend
Copy-Item .env.example .env
```

Edit the ignored `backend/.env` before starting PostgreSQL. Set
`PEARLIX_LOCAL_DB_PASSWORD` to a unique URL-safe local value (at least 32 random
alphanumeric characters), then set `DATABASE_URL` to
`postgresql://pearlix:<same-unique-local-password>@127.0.0.1:5433/pearlix`.
Both checked-in values are intentionally empty. Then start the loopback-only
database from the repository root and return to `backend`:

```powershell
cd ..
docker compose --env-file backend/.env up -d db
cd backend
.\.venv\Scripts\python.exe manage.py migrate --settings=config.settings.local
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.settings.local
```

The `--settings=config.settings.local` argument is required and intentionally explicit: Django entrypoints do not default to local settings. Use it for every local management command. The backend API is `http://127.0.0.1:8000/api`. `backend/.env` must retain the documented local `127.0.0.1:5173` CORS, CSRF, and frontend URL values from `.env.example`; production origins remain explicitly configured and restricted.

Docker Compose reads `PEARLIX_LOCAL_DB_PASSWORD` from that ignored file and
Django reads the matching password from `DATABASE_URL`. PostgreSQL is published
only at `127.0.0.1:5433`, never to the LAN by default. Starting Compose without
the required local password fails closed.

In a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:5173/login`. Vite uses a strict canonical port and exits if 5173 is unavailable; stop the process using that port before retrying. Verify the backend route with `curl.exe -i http://127.0.0.1:8000/api/auth/login/`; the expected unauthenticated `GET` response is `405 Method Not Allowed`.

For deterministic local QA data, run the development-only seed/reset command in `DEMO_STORY.md`. Do not commit `.env`, database, media, or log files.
