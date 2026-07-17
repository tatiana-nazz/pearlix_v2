# Phase 14F Browser Audit

## Scope and verified runtime

- Base branch/commit: `phase-14e-supporting-operations` / `0a0a7fed41e9f9f2f34d26dfe3d45d4b20ef788a`
- Audit branch: `phase-14f-browser-visual-uat`
- Audited frontend: `http://127.0.0.1:5173`; backend: `http://127.0.0.1:8000`
- Browser capability: Codex in-app browser with DOM, console, responsive viewport, and screenshot support.
- CORS-14F-01 history: resolved on 2026-07-17. The ignored local `backend/.env` and tracked `backend/.env.example` now allow both explicit local origins. The configuration remains environment-driven, has no wildcard, does not enable `CORS_ALLOW_ALL_ORIGINS`, and retains bearer-token authentication (no CSRF change required).
- Preflight: `OPTIONS /api/auth/login/` returned 200 and the matching `Access-Control-Allow-Origin` header for both `http://127.0.0.1:5173` and `http://localhost:5173`.
- Authentication: the required `127.0.0.1` origin authenticated Staff, Admin, and Doctor accounts; each loaded its workspace. No browser console errors or CORS network failures were observed. The only console message was the known React Router v7 future-flag warning.
- No UI fixes were implemented.

## Exact matrix and result

| ID | Role / configuration | Routes and route result | Evidence / notes |
| --- | --- | --- | --- |
| STF-01 | Staff, 1440x900, English, light | `/staff/dashboard`, `/staff/profile/schedule`, `/staff/profile/leave` — **PASS** | Required-origin authentication and all listed workspace routes rendered without console errors. |
| STF-02 | Staff, 1440x900, English, light | `/staff/appointments/day`, `/week`, `/month`, `/list`, `/needs-reschedule` — **PASS**; `/:appointmentId/reschedule` — **BLOCKED-DATA** | Status filter preserved `?status=NEEDS_RESCHEDULE&page=1`. Add Appointment opened a labelled dialog, moved focus to Close, and returned focus to the trigger when closed. No live reschedulable record was available for the detail route. |
| STF-03 | Staff, 1440x900, English, light | `/staff/patients`, `/new`, `/:patientId` — **PASS**; `/staff/visits/:visitId`, `/staff/xrays/:xrayId` — **BLOCKED-DATA**; `/staff/xrays` — **PASS** | Seeded patient `120` rendered. No visible seeded visit or saved X-ray detail record was available. |
| STF-04 | Staff, 1440x900, English, light | `/staff/billing/handoffs`, `/invoices`, `/new` — **PASS**; handoff/invoice detail, payment, and print routes — **BLOCKED-DATA** | Lists and invoice creation surface rendered; no suitable live handoff/invoice detail record was available. |
| ADM-01 | Admin, 1024x768, English, dark | `/admin/dashboard`, `/team`, `/users`, `/users/new`, `/clinic-settings` — **PASS**; team/user detail — **BLOCKED-DATA** | Dark mode remained active across the audited Admin routes. No suitable detail record was selected from the seeded lists. |
| ADM-02 | Admin, 1024x768, English, dark | `/admin/doctors`, `/admin/leave`, appointment day/week/month/list/needs-reschedule, patients and seeded patient detail — **PASS**; leave exception and visit detail — **BLOCKED-DATA** | Read-only operational surfaces rendered without console errors. |
| ADM-03 | Admin, 1024x768, English, dark | `/admin/xrays`, `/external-xrays`, `/audit-logs` — **PASS**; X-ray, external-case, and audit-log detail — **BLOCKED-DATA** | No visible suitable detail record was available for the listed detail routes. |
| ADM-04 | Admin, 1024x768, English, dark | `/admin/billing/handoffs`, `/invoices` — **PASS**; handoff/invoice/print detail — **BLOCKED-DATA** | Read-only billing list surfaces rendered. |
| DOC-01 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/dashboard`, `/profile/schedule`, `/profile/leave`, appointment day/week/list/needs-reschedule — **DEFECT (RTL-14F-01)** | Arabic content, mixed-direction names/dates, light mode, and authorization boundaries rendered. Dashboard has reproducible horizontal page overflow at the required width. |
| DOC-02 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/patients`, seeded patient detail, clinical history, `/visits/active` — **PASS**; checked-in-to-active and visit detail — **BLOCKED-DATA** | Doctor was denied `/admin/dashboard` and redirected to `/access-denied` without Staff/Admin navigation. No eligible checked-in/active visit detail was available. |
| DOC-03 | Doctor, 768x1024, Arabic, light, RTL | `/doctor/xrays`, `/external-xrays`, `/billing/handoffs` — **PASS**; saved/external X-ray and handoff detail — **BLOCKED-DATA** | Collection surfaces rendered; no suitable live detail record was available. |

## Findings

| Defect ID | Role / route / configuration | Reproduction | Expected | Actual | Severity | Evidence / console/network |
| --- | --- | --- | --- | --- | --- | --- |
| CORS-14F-01 (resolved) | All roles; login; required frontend origin | Previously: open `http://127.0.0.1:5173/login` and sign in. | Both configured local frontend origins are accepted. | The former localhost-only allowlist blocked the required origin. The explicit two-origin configuration now passes both preflights and all role logins. | Resolved P1 / High | `fix: allow local frontend origins`; no CORS browser errors remain. |
| RTL-14F-01 | Doctor dashboard; 768x1024; Arabic, light, RTL | Sign in as Doctor, set Arabic and light mode, and open `/doctor/dashboard` at 768x1024. | The dashboard fits the viewport without horizontal page scrolling. | A horizontal scrollbar is present at the bottom of the page, allowing sideways overflow. | P2 / Medium | `phase14f_evidence/doctor-dashboard-768x1024-ar-light-rtl.png` |

## Evidence

- `phase14f_evidence/admin-dashboard-1024x768-en-dark.png`: required-origin Admin dashboard at the required dark-mode viewport.
- `phase14f_evidence/doctor-dashboard-768x1024-ar-light-rtl.png`: required-origin Doctor dashboard at the required Arabic/light/RTL viewport; captures RTL-14F-01.
- `phase14f_evidence/staff-dashboard-1440x900-en-light.png`: earlier localhost fallback evidence retained for history; required-origin Staff routes were rechecked in-browser after CORS correction.

## Non-browser verification

- `manage.py check`: passed (`System check identified no issues (0 silenced)`).
- `manage.py makemigrations --check --dry-run --verbosity 2`: passed (`No changes detected`).
- `python -m pytest -q`: 414 passed in 15.28s.
- `npm.cmd run typecheck`, `npm.cmd run test:run`, and `npm.cmd run build`: passed. The build reported the existing >500 kB chunk advisory; the test run emitted existing React Router future-flag and `act(...)` warnings.
