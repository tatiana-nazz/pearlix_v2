# Stage 10 final-audit evidence index

Source: `post-14f-medical-blue-admin-supporting` / `b26aeda985fd8da15c80b719288535e6ee6bb239`. Audited runtime and correction: `3809cd0cc8cdeae9c3d921c3db58cb67bc6686f0` (`fix: close medical-blue visual audit`). Browser: terminal Playwright with Microsoft Edge in isolated contexts. Deterministic demo data was reseeded before capture and restored after capture.

Render gate for every PASS capture: HTTP 200 navigation; final URL shown below; `readyState=complete`; populated `#root`; visible body; loaded application JS/CSS; no page errors; `documentWidth <= clientWidth` and `bodyWidth <= clientWidth`. The browser records `ERR_ABORTED` requests only when the post-login dashboard route is deliberately replaced immediately by the target route; these are not final-route failures. The automatic browser favicon probe can be a 404 and is not an application asset failure. No application console/page error, JS/CSS failure, or document-level overflow was observed. Local scroll containers: none in captured views; table surfaces retain their documented bounded local-scroll behavior when data width requires it.

| File | Role / route family / stage | Viewport, language, theme | Final route / result | Permission and deterministic state |
| --- | --- | --- | --- | --- |
| `admin/admin-dashboard-final-1440x900-en-light.png` | Admin / dashboard / 2 | 1440×900, EN LTR, light | `/admin/dashboard` — PASS | Admin dashboard; seeded |
| `admin/admin-team-final-1440x900-en-light.png` | Admin / Team / 5 | 1440×900, EN LTR, light | `/admin/team` — PASS | Admin authority; seeded |
| `admin/admin-settings-final-1440x900-en-light.png` | Admin / settings / 9 | 1440×900, EN LTR, light | `/admin/clinic-settings` — PASS | Admin write surface, not mutated |
| `admin/admin-audit-final-1440x900-en-light.png` | Admin / audit / 9 | 1440×900, EN LTR, light | `/admin/audit-logs` — PASS | Admin read-only; seeded |
| `admin/admin-xray-final-1440x900-en-light.png` | Admin / X-ray-AI / 8 | 1440×900, EN LTR, light | `/admin/xrays/:xrayId` — PASS | supervisory protected-media view |
| `dark/admin-final-1024x900-en-dark.png` | Admin / dashboard / 2 | 1024×900, EN LTR, dark | `/admin/dashboard` — PASS | seeded |
| `rtl/admin-final-768x1024-ar-light-rtl.png` | Admin / dashboard / 2 | 768×1024, AR RTL, light | `/admin/dashboard` — PASS | seeded |
| `staff/staff-dashboard-final-1440x900-en-light.png` | Staff / dashboard / 2 | 1440×900, EN LTR, light | `/staff/dashboard` — PASS | seeded |
| `staff/staff-appointments-final-1440x900-en-light.png` | Staff / appointments / 3 | 1440×900, EN LTR, light | `/staff/appointments/day` — PASS | Staff workflow, not mutated |
| `staff/staff-patient-final-1440x900-en-light.png` | Staff / patient detail / 4 | 1440×900, EN LTR, light | `/staff/patients/:patientId` — PASS | seeded object |
| `staff/staff-billing-final-1440x900-en-light.png` | Staff / billing / 6 | 1440×900, EN LTR, light | `/staff/billing` — PASS | no payment mutation |
| `dark/staff-final-1024x900-en-dark.png` | Staff / dashboard / 2 | 1024×900, EN LTR, dark | `/staff/dashboard` — PASS | seeded |
| `rtl/staff-final-768x1024-ar-light-rtl.png` | Staff / dashboard / 2 | 768×1024, AR RTL, light | `/staff/dashboard` — PASS | seeded |
| `doctor/doctor-dashboard-final-1440x900-en-light.png` | Doctor / dashboard / 2 | 1440×900, EN LTR, light | `/doctor/dashboard` — PASS | seeded |
| `doctor/doctor-active-visit-final-1440x900-en-light.png` | Doctor / active visit / 7 | 1440×900, EN LTR, light | `/doctor/visits/:visitId` — PASS | own seeded visit; no mutation |
| `doctor/doctor-xray-ai-final-1440x900-en-light.png` | Doctor / X-ray-AI / 8 | 1440×900, EN LTR, light | `/doctor/xrays/:xrayId` — PASS | protected seeded media |
| `dark/doctor-final-1024x900-en-dark.png` | Doctor / visit / 7 | 1024×900, EN LTR, dark | `/doctor/visits/:visitId` — PASS | no mutation |
| `rtl/doctor-final-768x1024-ar-light-rtl.png` | Doctor / visit / 7 | 768×1024, AR RTL, light | `/doctor/visits/:visitId` — PASS | no mutation |
| `shared-states/access-denied-final-768x1024-en-light.png` | Staff / denied Admin route / 9 | 768×1024, EN LTR, light | `/access-denied` — PASS | direct wrong-role route denied |
| `shared-states/not-found-final-768x1024-en-light.png` | Admin / not found / 9 | 768×1024, EN LTR, light | unknown route — PASS | safe public supporting state |
| `shared-states/representative-empty-final-768x1024-en-light.png` | Doctor / no active visit / 7 | 768×1024, EN LTR, light | `/doctor/visits/active` — PASS | deterministic no-active-visit account |
| `responsive/dashboard-final-1920x1080-en-light.png` | Admin / dashboard / 2 | 1920×1080, EN LTR, light | `/admin/dashboard` — PASS | overflow PASS |
| `responsive/table-final-1280x720-en-light.png` | Admin / audit table / 9 | 1280×720, EN LTR, light | `/admin/audit-logs` — PASS | overflow PASS |
| `responsive/form-final-1024x768-en-light.png` | Admin / settings form / 9 | 1024×768, EN LTR, light | `/admin/clinic-settings` — PASS | overflow PASS; not mutated |
| `responsive/detail-final-1366x768-en-light.png` | Staff / patient detail / 4 | 1366×768, EN LTR, light | `/staff/patients/:patientId` — PASS | overflow PASS |
| `responsive/xray-final-1536x864-en-light.png` | Doctor / X-ray-AI / 8 | 1536×864, EN LTR, light | `/doctor/xrays/:xrayId` — PASS | overflow PASS; protected media |
| `corrections/doctor-xray-canvas-before-1440x900-en-light.png` | Doctor / X-ray canvas / 8 | 1440×900, EN LTR, light | `/doctor/xrays/:xrayId` — PASS | valid pre-correction source state |
| `corrections/doctor-xray-canvas-after-1440x900-en-light.png` | Doctor / X-ray canvas / 8 | 1440×900, EN LTR, light | `/doctor/xrays/:xrayId` — PASS | corrected flat token surface |

The safely reproducible error-state route is not manufactured: unavailable/error states remain verified by production component tests. No credentials, cookies, browser storage, raw protected-media URLs, or private deterministic identifiers are recorded here.
