# Phase 14F Browser Audit

## Scope and capability

- Base branch/commit: `phase-14e-supporting-operations` / `0a0a7fed41e9f9f2f34d26dfe3d45d4b20ef788a`
- Audit branch: `phase-14f-browser-visual-uat`
- Intended URLs: frontend `http://127.0.0.1:5173`; backend `http://127.0.0.1:8000`
- Browser capability: Codex in-app browser with DOM, console, responsive viewport, and screenshot support.
- Runtime result: Vite started and `/login` rendered. Django passed its system check but could not finish startup or answer authentication because the configured PostgreSQL endpoint `127.0.0.1:5433` was not listening. `manage.py migrate --check` consequently timed out.
- Evidence: no screenshots were retained. The only rendered route was the login page; a role-screen image would not be reliable evidence.
- No fixes implemented. Backend runtime modified: no. Production UI fixes made: no.

## Exact matrix and result

| ID | Role / configuration | Routes and route result | Evidence / notes |
| --- | --- | --- | --- |
| STF-01 | Staff, 1440x900, English, light | `/staff/dashboard`, `/staff/profile/schedule`, `/staff/profile/leave` — **BLOCKED-DATA** | Authentication remained pending because the API/database was unreachable. |
| STF-02 | Staff, 1440x900, English, light | `/staff/appointments/day`, `/week`, `/month`, `/list`, `/needs-reschedule`, `/:appointmentId/reschedule` — **BLOCKED-DATA** | Includes detail/create/edit/reschedule/status-modal checks. |
| STF-03 | Staff, 1440x900, English, light | `/staff/patients`, `/new`, `/:patientId`; `/staff/visits/:visitId`; `/staff/xrays`, `/:xrayId` — **BLOCKED-DATA** | Includes read-only visit/X-ray/AI checks. |
| STF-04 | Staff, 1440x900, English, light | `/staff/billing/handoffs`, `/:handoffId`; `/invoices`, `/new`, `/:invoiceId`, `/:invoiceId/payments`, `/:invoiceId/print` — **BLOCKED-DATA** | Includes invoice, payment, and print handoffs. |
| ADM-01 | Admin, 1024x768, English, dark | `/admin/dashboard`; `/team`, `/:memberId`; `/users`, `/new`, `/:userId`; `/clinic-settings` — **BLOCKED-DATA** | No authenticated Admin workspace rendered. |
| ADM-02 | Admin, 1024x768, English, dark | `/admin/doctors`; `/admin/leave`, `/:exceptionId`; appointment day/week/month/list/needs-reschedule; patients/detail; visits/detail — **BLOCKED-DATA** | Includes schedule/leave and read-only operational routes. |
| ADM-03 | Admin, 1024x768, English, dark | `/admin/xrays`, `/:xrayId`; `/external-xrays`, `/:caseId`; `/audit-logs`, `/:auditLogId` — **BLOCKED-DATA** | Includes external X-ray/AI and audit list/detail. |
| ADM-04 | Admin, 1024x768, English, dark | `/admin/billing/handoffs`, `/:handoffId`; `/invoices`, `/:invoiceId`, `/:invoiceId/print` — **BLOCKED-DATA** | Includes Admin read-only billing paths. |
| DOC-01 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/dashboard`; `/profile/schedule`; `/profile/leave`; appointment day/week/list/needs-reschedule — **BLOCKED-DATA** | No Arabic/RTL workspace could be loaded. |
| DOC-02 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/patients`, `/:patientId`, `/:patientId/clinical-history`; `/visits/active`, `/:visitId` — **BLOCKED-DATA** | Includes checked-in-to-active visit, active-visit tabs, notes, and history. |
| DOC-03 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/xrays`, `/:xrayId`; `/external-xrays`, `/:caseId`; `/billing/handoffs`, `/:handoffId` — **BLOCKED-DATA** | Includes saved/external X-ray/AI and billing handoff. |

## Findings

| Defect ID | Role / route / configuration | Reproduction | Expected | Actual | Severity | Evidence / console/network |
| --- | --- | --- | --- | --- | --- | --- |
| ENV-14F-01 | All roles; login; Staff viewport 1440x900, English/light | Start the documented local services, then sign in with the deterministic Staff account. | API responds, session is created, and the role workspace loads. | The login remains `Signing in…`; Django check/migration check wait for the configured database. TCP connection to `127.0.0.1:5433` failed. | Blocker (environment) | Vite console had only React Router v7 future-flag warnings; no application console error was captured before the pending request. Backend output never reached a listening state. |

## Audit checklist disposition

Visual inspection, keyboard/pointer routes, URL/filter persistence, focus traps/return, dirty/pending/validation behavior, theme/language persistence, back/forward, API method/authorization review, translations, clinic-local dates, raw IDs, and full console/network review are **MANUAL-REQUIRED** after `ENV-14F-01` is resolved. Do not infer PASS from existing automated tests.

## Non-browser verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:run`: 60 test files and 213 tests passed (a separate filtered reporting invocation returned a non-zero shell status despite the Vitest pass summary; React Router future-flag and `act(...)` warnings were emitted to test stderr).
- `npm.cmd run build`: passed; Vite reported one >500 kB chunk advisory.
- Backend `python -m pytest`: 414 passed.
- `manage.py makemigrations --check --dry-run --verbosity 2`: passed (`No changes detected`).
- `manage.py check`: passed (`System check identified no issues (0 silenced)`). `manage.py migrate --check` was blocked by the unavailable configured database; no migration or data mutation was attempted.
