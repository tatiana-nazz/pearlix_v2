# Local development startup

Use the canonical local addresses below. Do not mix `localhost` and `127.0.0.1`.

```powershell
cd backend
Copy-Item .env.example .env
.\.venv\Scripts\python.exe manage.py migrate --settings=config.settings.local
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.settings.local
```

The `--settings=config.settings.local` argument is required and intentionally explicit: Django entrypoints do not default to local settings. Use it for every local management command. The backend API is `http://127.0.0.1:8000/api`. `backend/.env` must retain the documented local `127.0.0.1:5173` CORS, CSRF, and frontend URL values from `.env.example`; production origins remain explicitly configured and restricted.

In a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:5173/login`. Vite uses a strict canonical port and exits if 5173 is unavailable; stop the process using that port before retrying. Verify the backend route with `curl.exe -i http://127.0.0.1:8000/api/auth/login/`; the expected unauthenticated `GET` response is `405 Method Not Allowed`.

For deterministic local QA data, run the development-only seed/reset command in `DEMO_STORY.md`. Do not commit `.env`, database, media, or log files.
