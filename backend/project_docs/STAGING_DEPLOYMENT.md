# Pearlix Staging Deployment Runbook

**Scope:** deployment infrastructure only. This runbook does not change Pearlix product behavior, RBAC, billing semantics, or the locked DENTEX model contract.

**Environment classification:** research/demo staging. Pearlix and its AI assistance are not clinically validated diagnostic systems. Do not use real patient data in this free staging environment.

## Target architecture

```text
Netlify (React/Vite)
        |
        | HTTPS / JSON + protected media requests
        v
Render (Django/DRF)
   |             |
   | PostgreSQL  | private S3 API
   v             v
Supabase DB   Supabase Storage
```

The real DENTEX model is intentionally **not loaded into the Render Free web process**. External AI deployment is a separate later phase. The locked model hashes, thresholds, class order, preprocessing, and FDI map remain governed by `AI_MODEL_DEPLOYMENT.md`.

## Deployment order

1. Create the Supabase project.
2. Create a **private** Supabase Storage bucket.
3. Generate Supabase S3 server-side access credentials.
4. Copy the Supabase **Session pooler** PostgreSQL connection string.
5. Create the Render backend service and configure all backend secrets.
6. Verify Render `/api/health/`.
7. Create the Netlify frontend site and set `VITE_API_BASE_URL`.
8. Update Render CORS/CSRF/frontend origins to the final Netlify URL.
9. Run hosted acceptance without real AI.
10. Deploy/connect the external AI service in the later AI deployment phase.

---

## 1. Supabase

### PostgreSQL

Pearlix continues to use Django ORM, migrations, authentication, permissions, and business logic. Supabase is only the managed PostgreSQL host.

Render is an IPv4-only platform. For the free Supabase project, use the **Shared Pooler / Supavisor Session mode** connection string (port `5432`) from the Supabase **Connect** panel, not the IPv6-only direct database hostname.

Set that complete value as Render's:

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region-pooler-host>:5432/postgres?sslmode=require
```

If the copied URL already contains SSL options, keep the provider-supplied value rather than duplicating them.

Do not use Supabase client libraries in the browser for Pearlix domain data. Django remains the sole application/data-access boundary.

### Private Storage bucket

Create one bucket for Pearlix media, for example:

```text
pearlix-media
```

The bucket must remain **private**.

In Supabase Storage S3 configuration:

1. Enable/use the S3-compatible interface.
2. Generate an **Access Key ID** and **Secret Access Key**.
3. Copy the direct S3 endpoint shown by Supabase. Prefer the direct storage hostname:
   `https://<project-ref>.storage.supabase.co/storage/v1/s3`
4. Copy the project storage region.

These S3 credentials are privileged server-side credentials and bypass Storage RLS. Never put them in Netlify, `VITE_*` variables, browser code, Git, screenshots, or documentation.

Render receives:

```text
SUPABASE_S3_ENDPOINT_URL=<copied S3 endpoint>
SUPABASE_S3_ACCESS_KEY_ID=<server-side access key id>
SUPABASE_S3_SECRET_ACCESS_KEY=<server-side secret access key>
SUPABASE_S3_BUCKET_NAME=pearlix-media
SUPABASE_S3_REGION=<copied storage region>
```

Pearlix uses Django `FileField` with `django-storages`/boto3. Supabase requires S3 Signature V4 and path-style addressing; production settings enforce those options.

### Protected media behavior

The browser does **not** receive permanent Supabase object URLs.

The existing protected endpoints remain authoritative, for example:

```text
/api/xrays/<id>/file/
/api/xrays/<id>/ai-overlay/
/api/external-xrays/<id>/file/
```

Django authorizes the request first, then opens the `FileField` through the configured storage backend and streams it to the authenticated client. Local development still uses `MEDIA_ROOT`; production uses the private Supabase bucket.

---

## 2. Render backend

Create a **Web Service** from `tatiana-nazz/pearlix_v2`.

For staging, deploy the approved deployment branch until it is merged:

```text
deploy/staging-prep
```

### Service settings

```text
Language: Python
Root Directory: backend
Build Command: ./build.sh
Start Command: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120
Health Check Path: /api/health/
```

The build script:

1. installs `backend/requirements.txt`
2. collects Django static files
3. applies Django migrations

It never seeds demo data and never loads AI weights.

### Required environment variables

```text
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<generate a strong unique production secret>

DATABASE_URL=<Supabase Session pooler URL with SSL>

ALLOWED_HOSTS=<render-hostname>
CORS_ALLOWED_ORIGINS=<netlify-origin>
CSRF_TRUSTED_ORIGINS=<netlify-origin>
FRONTEND_URL=<netlify-origin>
TIME_ZONE=Asia/Damascus

SUPABASE_S3_ENDPOINT_URL=<Supabase S3 endpoint>
SUPABASE_S3_ACCESS_KEY_ID=<server-side key id>
SUPABASE_S3_SECRET_ACCESS_KEY=<server-side secret>
SUPABASE_S3_BUCKET_NAME=pearlix-media
SUPABASE_S3_REGION=<Supabase storage region>

PEARLIX_ALLOW_MOCK_AI=false
```

Keep the existing AI variables unset unless the separate AI phase explicitly requires them.

Do not place thresholds, hashes, class order, or model preprocessing in environment variables.

### Production security

Production settings already require:

- `DEBUG=False`
- explicit `SECRET_KEY`
- explicit `DATABASE_URL`
- no wildcard CORS
- secure session and CSRF cookies
- HTTPS proxy awareness
- HSTS/SSL redirect

Production additionally fails closed if any private Supabase S3 setting is missing, preventing accidental use of Render's ephemeral local filesystem for patient media.

---

## 3. Netlify frontend

Connect the same GitHub repository.

The repository-level `netlify.toml` defines:

```text
Base directory: frontend
Build command: npm run build
Publish directory: frontend/dist (resolved from base as dist)
```

It also includes the SPA rewrite:

```text
/*  /index.html  200
```

so React Router URLs work on refresh/direct navigation.

### Required Netlify environment variable

After Render has a final public hostname:

```text
VITE_API_BASE_URL=https://<render-service>.onrender.com/api
```

Only non-secret browser configuration belongs in `VITE_*`.

Never place:

- Supabase S3 access key
- Supabase S3 secret
- database URL/password
- Django secret key
- AI service token

in Netlify/Vite environment variables.

---

## Rollback

Deployment configuration should be promoted only after local regression and hosted staging acceptance.

If a new Render deployment fails, keep/redeploy the last known-good application revision. Database migrations in this staging-prep phase do not change the Pearlix domain schema.

If remote media configuration is incorrect, disable the new deployment rather than falling back to Render-local media. Do not change the bucket to public as a workaround.

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
