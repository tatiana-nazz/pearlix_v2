# Local login network fix record

## Symptom

The local login screen could load on `http://localhost:5174/login`, while submitting credentials produced the generic `Network request failed.` message.

## Root cause

Vite's default port fallback silently moved the frontend away from the documented port when 5173 was occupied. Django's deliberately restricted local CORS allowlist did not include that unplanned origin, so the browser blocked the cross-origin login response. Direct preflight verification returned `Access-Control-Allow-Origin` for the canonical port and none for the drifted port.

## Fix

The canonical local flow now uses `http://127.0.0.1:5173` and `http://127.0.0.1:8000/api` throughout. Vite binds to the canonical host and uses `strictPort: true`, so an occupied port fails clearly rather than drifting. The backend example environment aligns CORS, CSRF, and frontend URL values to the same origin without enabling wildcard CORS.

The login form now maps unavailable-service, invalid-credentials, disabled-account, and server-failure cases to safe English/Arabic messages and announces them accessibly. The backend returns `ACCOUNT_DISABLED` for disabled local accounts; invalid credentials remain distinct.

## Verification

Focused frontend tests, focused authentication tests, full frontend and backend regressions, production build, Playwright smoke coverage, CORS preflight, and a seeded Staff browser login were executed. No API base URL, production CORS wildcard, secret, or local artifact was added.
