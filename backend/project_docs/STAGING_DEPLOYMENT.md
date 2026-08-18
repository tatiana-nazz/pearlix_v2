# Pearlix Staging Deployment Runbook

**Scope:** deployment infrastructure only. This runbook does not change Pearlix product behavior, RBAC, billing semantics, or the locked DENTEX model contract.

**Environment classification:** research/demo staging. Pearlix and its AI assistance are not clinically validated diagnostic systems. Do not use real patient data in this free staging environment.

## Target architecture

```text
Vercel Hobby
├── pearlix-web-staging  -> frontend/  (React + Vite)
└── pearlix-api-staging  -> backend/   (Django + DRF)

Supabase Free
├── PostgreSQL
└── private Storage bucket (pearlix-media)

AI inference
└── separate deployment phase; not loaded into the Vercel Django function
```

Vercel Hobby is suitable here for personal/research/staging use, not as the future commercial-clinic hosting target.

## Deployment source

After the deployment-preparation work is accepted, `main` is the deployment source for both Vercel projects.

```text
Repository: tatiana-nazz/pearlix_v2
Backend root: backend
Frontend root: frontend
Production branch: main
```

## Supabase

Pearlix continues to use Django ORM, migrations, authentication, permissions, and business logic. Supabase is only the managed PostgreSQL and object-storage provider.

Use the Shared Pooler / Supavisor Session mode connection string (port 5432) for the backend:

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region-pooler-host>:5432/postgres?sslmode=require
```

The staging database has already received the current Pearlix migration set during controlled deployment verification. Do not run migrations automatically on every Vercel preview deployment. Future schema changes must be migrated intentionally against the intended database before promoting the matching application revision.

Use the private bucket:

```text
pearlix-media
public: false
file size limit: 10 MB
allowed MIME: image/png, image/jpeg
```

Supabase S3 server credentials are backend-only secrets and bypass Storage RLS. Never expose them in browser code, `VITE_*` variables, Git, screenshots, or documentation.

Protected media remains behind Pearlix authorization. The browser does not receive permanent Supabase object URLs.

## Vercel backend project

Create/import a Vercel project from the repository with:

```text
Project: pearlix-api-staging
Root Directory: backend
Production Branch: main
Framework: Django/Python auto-detected
Python: backend/.python-version (3.13)
```

Required environment variables:

```text
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=false
SECRET_KEY=<strong unique Django secret>
DATABASE_URL=<Supabase Session pooler URL with sslmode=require>
ALLOWED_HOSTS=.vercel.app
TIME_ZONE=Asia/Damascus

SUPABASE_S3_ENDPOINT_URL=<Supabase S3 endpoint>
SUPABASE_S3_ACCESS_KEY_ID=<server-side key id>
SUPABASE_S3_SECRET_ACCESS_KEY=<server-side secret>
SUPABASE_S3_BUCKET_NAME=pearlix-media
SUPABASE_S3_REGION=<Supabase storage region>

PEARLIX_ALLOW_MOCK_AI=false
```

After the frontend production hostname is known, add:

```text
CORS_ALLOWED_ORIGINS=https://<frontend-host>.vercel.app
CSRF_TRUSTED_ORIGINS=https://<frontend-host>.vercel.app
FRONTEND_URL=https://<frontend-host>.vercel.app
```

Health endpoint:

```text
/api/health/
```

Expected response:

```json
{"status":"ok"}
```

Do not load the DENTEX PyTorch/Ultralytics model bundle into the Vercel backend. The external AI service remains a separate phase.

## Vercel frontend project

Create/import a second Vercel project from the same repository:

```text
Project: pearlix-web-staging
Root Directory: frontend
Production Branch: main
Framework: Vite auto-detected
Build Command: npm run build
Output Directory: dist
```

`frontend/vercel.json` provides the SPA rewrite needed for React Router deep links.

Set:

```text
VITE_API_BASE_URL=https://<backend-host>.vercel.app/api
```

Only non-secret browser configuration belongs in `VITE_*` variables.

## Secrets policy

Never commit:

- `.env`
- Supabase database passwords
- Supabase S3 keys
- Django production `SECRET_KEY`
- AI service tokens
- model weights
- patient X-rays

Rotate any secret immediately if it is accidentally exposed.

## Rollback

If a Vercel deployment fails, keep or promote the last known-good deployment. Do not weaken Django production settings, expose the storage bucket publicly, enable mock AI, or fabricate AI findings as a workaround.

## Remaining work

1. Deploy the backend from `main` and verify `/api/health/`.
2. Deploy the frontend from `main` with `VITE_API_BASE_URL` pointing to the backend.
3. Add the frontend origin to backend CORS/CSRF/frontend settings and redeploy the backend.
4. Run hosted non-AI acceptance.
5. Implement and deploy the separate real-AI service in the later AI phase.
