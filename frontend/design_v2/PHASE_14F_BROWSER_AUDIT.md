# Phase 14F Browser Audit

## Scope and capability

- Base branch/commit: `phase-14e-supporting-operations` / `0a0a7fed41e9f9f2f34d26dfe3d45d4b20ef788a`
- Audit branch: `phase-14f-browser-visual-uat`
- Intended URLs: frontend `http://127.0.0.1:5173`; backend `http://127.0.0.1:8000`
- Browser capability: Codex in-app browser with DOM, console, responsive viewport, and screenshot support.
- Continuation runtime result (2026-07-17): PostgreSQL `127.0.0.1:5433` was reachable; Docker reported the database healthy; `manage.py migrate --check` and `manage.py check` passed; backend `/api/` and frontend `/login` returned HTTP 200.
- Browser result: the specified `127.0.0.1:5173` frontend origin is not in backend `CORS_ALLOWED_ORIGINS` (which contains only `http://localhost:5173`). Login preflight succeeds but the browser blocks the cross-origin authentication response, so the required-origin role matrix cannot start. A localhost-only fallback confirmed the seeded Staff dashboard renders, but it is not a substitute for the required origin.
- Evidence: `phase14f_evidence/staff-dashboard-1440x900-en-light.png` is a real localhost fallback screenshot. No screenshot is claimed as evidence for a blocked required-origin role route.
- No fixes implemented. Backend runtime modified: no. Production UI fixes made: no.

## Exact matrix and result

| ID | Role / configuration | Routes and route result | Evidence / notes |
| --- | --- | --- | --- |
| STF-01 | Staff, 1440x900, English, light | `/staff/dashboard`, `/staff/profile/schedule`, `/staff/profile/leave` — **DEFECT (CORS-14F-01)** | The required origin blocks login; localhost fallback dashboard visually rendered. |
| STF-02 | Staff, 1440x900, English, light | `/staff/appointments/day`, `/week`, `/month`, `/list`, `/needs-reschedule`, `/:appointmentId/reschedule` — **DEFECT (CORS-14F-01)** | Includes detail/create/edit/reschedule/status-modal checks. |
| STF-03 | Staff, 1440x900, English, light | `/staff/patients`, `/new`, `/:patientId`; `/staff/visits/:visitId`; `/staff/xrays`, `/:xrayId` — **DEFECT (CORS-14F-01)** | Includes read-only visit/X-ray/AI checks. |
| STF-04 | Staff, 1440x900, English, light | `/staff/billing/handoffs`, `/:handoffId`; `/invoices`, `/new`, `/:invoiceId`, `/:invoiceId/payments`, `/:invoiceId/print` — **DEFECT (CORS-14F-01)** | Includes invoice, payment, and print handoffs. |
| ADM-01 | Admin, 1024x768, English, dark | `/admin/dashboard`; `/team`, `/:memberId`; `/users`, `/new`, `/:userId`; `/clinic-settings` — **DEFECT (CORS-14F-01)** | No required-origin authenticated Admin workspace rendered. |
| ADM-02 | Admin, 1024x768, English, dark | `/admin/doctors`; `/admin/leave`, `/:exceptionId`; appointment day/week/month/list/needs-reschedule; patients/detail; visits/detail — **DEFECT (CORS-14F-01)** | Includes schedule/leave and read-only operational routes. |
| ADM-03 | Admin, 1024x768, English, dark | `/admin/xrays`, `/:xrayId`; `/external-xrays`, `/:caseId`; `/audit-logs`, `/:auditLogId` — **DEFECT (CORS-14F-01)** | Includes external X-ray/AI and audit list/detail. |
| ADM-04 | Admin, 1024x768, English, dark | `/admin/billing/handoffs`, `/:handoffId`; `/invoices`, `/:invoiceId`, `/:invoiceId/print` — **DEFECT (CORS-14F-01)** | Includes Admin read-only billing paths. |
| DOC-01 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/dashboard`; `/profile/schedule`; `/profile/leave`; appointment day/week/list/needs-reschedule — **DEFECT (CORS-14F-01)** | No required-origin Arabic/RTL workspace rendered. |
| DOC-02 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/patients`, `/:patientId`, `/:patientId/clinical-history`; `/visits/active`, `/:visitId` — **DEFECT (CORS-14F-01)** | Includes checked-in-to-active visit, active-visit tabs, notes, and history. |
| DOC-03 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/xrays`, `/:xrayId`; `/external-xrays`, `/:caseId`; `/billing/handoffs`, `/:handoffId` — **DEFECT (CORS-14F-01)** | Includes saved/external X-ray/AI and billing handoff. |

## Findings

| Defect ID | Role / route / configuration | Reproduction | Expected | Actual | Severity | Evidence / console/network |
| --- | --- | --- | --- | --- | --- | --- |
| CORS-14F-01 | All roles; login; all required viewports | Start services as specified, open `http://127.0.0.1:5173/login`, and submit a seeded role account. | The backend accepts the configured development frontend origin and the workspace loads. | The browser sends `OPTIONS /api/auth/login/`, then blocks login because `backend/.env` permits only `http://localhost:5173`, not the required `http://127.0.0.1:5173`. | P1 / High | Backend log records the preflight but no browser POST. Direct API health was 200. Localhost fallback authenticated and rendered Staff dashboard. |

## Audit checklist disposition

Visual inspection, keyboard/pointer routes, URL/filter persistence, focus traps/return, dirty/pending/validation behavior, theme/language persistence, back/forward, API method/authorization review, translations, clinic-local dates, raw IDs, and full console/network review remain blocked until `CORS-14F-01` is corrected. Do not infer PASS from existing automated tests or the localhost fallback.

## Non-browser verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:run`: 60 test files and 213 tests passed (a separate filtered reporting invocation returned a non-zero shell status despite the Vitest pass summary; React Router future-flag and `act(...)` warnings were emitted to test stderr).
- `npm.cmd run build`: passed; Vite reported one >500 kB chunk advisory.
- Backend `python -m pytest`: 414 passed.
- `manage.py makemigrations --check --dry-run --verbosity 2`: passed (`No changes detected`).
- `manage.py check`: passed (`System check identified no issues (0 silenced)`). `manage.py migrate --check`: passed after PostgreSQL recovery; no migration or data mutation was attempted.
