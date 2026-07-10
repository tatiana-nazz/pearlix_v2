# Phase 12L — Optional Backend Deployment Prep Prompt

Use this only after the backend core and QA pass are done.

## Objective

Prepare backend for deployment without adding new features.

## Scope

Implement/verify:

- production settings structure
- environment variable usage
- `.env.example`
- allowed hosts
- CORS allowed origins
- static/media configuration
- database URL support
- collectstatic support if needed
- Dockerfile or deployment notes if requested
- README backend run instructions
- health check endpoint

## Security Requirements

- DEBUG=false in production.
- SECRET_KEY from env.
- DATABASE_URL from env.
- CORS not wildcard in production.
- X-ray media not served publicly unless protected/signed.

## Tests/Checks

```bash
python manage.py check --deploy
python manage.py check
pytest -q
```

Report any deployment warnings explicitly.
