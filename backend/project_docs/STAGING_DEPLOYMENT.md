# Pearlix Staging Deployment Runbook

**Scope:** deployment infrastructure only. This runbook does not change Pearlix product behavior, RBAC, billing semantics, or the locked DENTEX model contract.

**Environment classification:** research/demo staging. Pearlix and its AI assistance are not clinically validated diagnostic systems. Do not use real patient data in this free staging environment.

## Target architecture

```text
Netlify (React/Vite)
        |
        | HTTPS / JSON + protected media requests
        v
Vercel Hobby (Django/DRF, Python Functions)
   |                    |
   | PostgreSQL         | private S3 API
   v                    v
Supabase DB        Supabase Storage
```

The real DENTEX detector/classifier bundle is intentionally **not loaded into the Vercel Django function**. External AI deployment is a separate later phase. The locked model hashes, thresholds, class order, preprocessing, and FDI map remain governed by `AI_MODEL_DEPLOYMENT.md`.

Vercel Hobby is suitable here only for the current personal/research/staging use. It is not the future commercial-clinic hosting target.

## Deployment order

1. Create/configure the Supabase project.
2. Create a **private** Supabase Storage bucket.
3. Generate Supabase S3 server-side access credentials.
4. Copy the Supabase **Session pooler** PostgreSQL connection string.
5. Apply the current Django migrations once through a controlled trusted runtime.
6. Import the backend into Vercel from `deploy/staging-prep` with Root Directory `backend`.
7. Configure Vercel backend environment variables and verify `/api/health/`.
8. Create the Netlify frontend site and set `VITE_API_BASE_URL`.
9. Add the final Netlify origin to backend CORS/CSRF/frontend settings.
10. Run hosted acceptance without real AI.
11. Deploy/connect the external AI service in the later AI deployment phase.

---

## 1. Supabase

### PostgreSQL

Pearlix continues to use Django ORM, migrations, authentication, permissions, and business logic. Supabase is only the managed PostgreSQL host.

Use the **Shared Pooler / Supavisor Session mode** connection string (port `5432`) for hosted application traffic when IPv4 compatibility is needed:

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region-pooler-host>:5432/postgres?sslmode=require
```

Never put this connection string in frontend/browser configuration.

### Migrations

The staging database has already received the current Pearlix migration set during controlled deployment verification. Do **not** run migrations automatically on every Vercel Preview deployment, because Preview and Production deployments would otherwise mutate the same Supabase database.

For later schema changes, run migrations intentionally against the intended database before promoting the matching application revision. Do not seed demo data automatically during deployment.

### Private Storage bucket

Use the private bucket:

```text
pearlix-media
```

Current staging policy:

```text
public: false
file size limit: 10 MB
allowed MIME: image/png, image/jpeg
```

Supabase S3 server credentials are privileged server-side credentials and bypass Storage RLS. Never put them in Netlify, `VITE_*` variables, browser code, Git, screenshots, or documentation.

Backend variables:

```text
SUPABASE_S3_ENDPOINT_URL=<Supabase direct S3 endpoint>
SUPABASE_S3_ACCESS_KEY_ID=<server-side access key id>
SUPABASE_S3_SECRET_ACCESS_KEY=<server-side secret access key>
SUPABASE_S3_BUCKET_NAME=pearlix-media
SUPABASE_S3_REGION=<Supabase storage region>
```

### Protected media behavior

The browser does **not** receive permanent Supabase object URLs.

Existing protected endpoints remain authoritative, including:

```text
/api/xrays/<id>/file/
/api/xrays/<id>/ai-overlay/
/api/external-xrays/<id>/file/
```

Django authorizes the request first, then opens the `FileField` through the configured storage backend and streams the content to the authenticated client.

---

## 2. Vercel backend

Vercel now supports Django directly through its Python runtime. Pearlix uses that native Django detection; no `/api` wrapper or routing rewrite is required.

### Git import

```text
Repository: tatiana-nazz/pearlix_v2
Branch: deploy/staging-prep
Root Directory: backend
Framework: Django/Python auto-detected
```

`backend/.python-version` pins Python 3.13 for Vercel.

Do not set a custom frontend Output Directory for this backend project.

### Required Vercel environment variables

Set these for the backend deployment environment:

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

After the Netlify production hostname is known, add:

```text
CORS_ALLOWED_ORIGINS=https://<netlify-host>
CSRF_TRUSTED_ORIGINS=https://<netlify-host>
FRONTEND_URL=https://<netlify-host>
```

Keep the existing AI service/model-path variables unset for this phase.

### Health check

The safe public health endpoint is:

```text
/api/health/
```

Expected body:

```json
{"status":"ok"}
```

It exposes no secrets, storage paths, model paths, or patient information.

### Runtime notes

- Vercel Hobby is a serverless/functions environment, not a persistent Django process.
- The ordinary Pearlix API is suitable for this staging use.
- Do not load the DENTEX PyTorch/Ultralytics models in this backend function.
- Supabase Storage remains the durable location for X-rays/overlays.
- Vercel's ephemeral filesystem must not become the source of truth for media or database state.

---

## 3. Netlify frontend

Connect the same GitHub repository.

The repository-level `netlify.toml` defines:

```text
Base directory: frontend
Build command: npm run build
Publish directory: dist (relative to the frontend base)
```

It also provides the SPA rewrite so React Router URLs work on direct navigation and refresh.

### Required Netlify environment variable

After Vercel has a final backend URL:

```text
VITE_API_BASE_URL=https://<vercel-backend-host>/api
```

Only non-secret browser configuration belongs in `VITE_*`.

Never place the database URL/password, Supabase S3 server keys, Django secret key, or future AI service token in Netlify/Vite environment variables.

---

## Rollback

Promote deployment configuration only after hosted staging acceptance.

If a Vercel deployment fails, keep the last known-good deployment and do not compensate by weakening Django production settings or exposing media publicly.

If remote media configuration is incorrect, fix the backend configuration. Do not change the Supabase bucket to public as a workaround.

If external AI is unavailable, preserve historical AI results and leave real AI disabled. Never fall back to fabricated/mock findings.

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

## Remaining deployment work

This runbook prepares the web application, database, and private media boundary. It deliberately does not make `SEPARATE_SERVICE` AI operational. That integration requires its own implementation, verification, and deployment phase after the hosted non-AI application passes acceptance.
