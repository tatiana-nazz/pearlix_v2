# Phase 14F Browser Audit - Canonical Reconciliation

## Audit lineage and scope

- Accepted Phase 14E base: `0a0a7fed41e9f9f2f34d26dfe3d45d4b20ef788a`
- Reconciled local audit: `e8f7a65e6c0509a42a269986463ad6a4cf119ac2`
- Reconciled remote audit: `3b65e93d2bff7d1c10eb9c1e69b50765feb49eca`
- Audit branch: `phase-14f-browser-visual-uat`
- Runtime: local Django at `http://127.0.0.1:8000` and Vite at `http://127.0.0.1:5173`, using existing local QA/demo accounts and seeded data.
- Reconciliation outcome: both independent audit passes and all screenshot evidence are retained. No UI correction, backend/frontend runtime change, migration, deployment, data reset, or CORS configuration change was implemented during reconciliation.

## Environment and prior verification

Both histories recorded successful Django check and frontend typecheck. The remote pass additionally recorded migration-drift, backend regression, frontend test, and frontend build verification. The build's existing large-chunk advisory and React Router future-flag warnings were not treated as browser application failures.

Remote CORS history is retained unchanged: CORS-14F-01 was resolved before this reconciliation by the existing tracked environment-example update. The configuration explicitly permits `http://localhost:5173` and `http://127.0.0.1:5173`, has no wildcard, does not enable `CORS_ALLOW_ALL_ORIGINS`, and keeps bearer-token authentication. Both origins passed the recorded login preflight. This reconciliation did not alter that configuration or its history.

## Browser matrix and scenario status

| ID | Role / viewport / locale | Scenarios and status | Evidence / audit pass |
| --- | --- | --- | --- |
| STF-01 | Staff, 1440 desktop, English, light | Login/logout; dashboard; collapsed/expanded sidebar; own schedule and leave - **PASS** | `staff-en-light-1440-dashboard.png`, `staff-en-light-1440-sidebar-collapsed.png`, `staff-en-light-1440-logout.png`; remote `staff-dashboard-1440x900-en-light.png` |
| STF-02 | Staff, 1440 desktop, English, light | Appointment Day/Week/Month/List/Needs-reschedule and create dialog - **PASS**; reschedule detail - **BLOCKED-DATA** | `staff-en-light-1440-appointments-day.png`, `staff-en-light-1440-appointment-create-modal.png` |
| STF-03 | Staff, 1440 desktop, English, light | Patients list/profile/edit, dirty discard, and focus return - **PASS**; visit and saved-X-ray detail - **BLOCKED-DATA** | `staff-en-light-1440-patients.png`, `staff-en-light-1440-patient-profile.png`, `staff-en-light-1440-patient-edit-modal.png` |
| STF-04 | Staff, 1440 desktop, English, light | Billing handoffs, invoices, and invoice creation surfaces - **PASS**; handoff/invoice/payment/print detail - **BLOCKED-DATA** | Remote pass; no suitable live detail record was available |
| ADM-01 | Admin, 1024 tablet, English, dark | Dashboard, Team, Users & Access, new-user surface, Clinic Settings - **PASS**; Team/User detail - **BLOCKED-DATA** | `admin-en-dark-1024-dashboard.png`, `admin-en-dark-1024-team.png`, `admin-en-dark-1024-users-access.png`; remote `admin-dashboard-1024x768-en-dark.png` |
| ADM-02 | Admin, 1024 tablet, English, dark | Schedules, Leave, appointment views, patients/detail, billing, X-rays, external X-rays, and audit list - **PASS**; leave, visit, X-ray, external-case, audit, billing and print detail - **BLOCKED-DATA** | Remote pass; suitable detail records were unavailable |
| DOC-01 | Doctor, 768 tablet, Arabic, light, RTL | Dashboard, shell/navigation, schedule/leave, appointment views, patients, and X-rays/AI - **FAIL: RTL-14F-01 and L10N-14F-02** | `doctor-ar-light-768-dashboard-rtl.png`, `doctor-ar-light-768-navigation-open.png`, `doctor-ar-light-768-patients.png`, `doctor-ar-light-768-appointments.png`, `doctor-ar-light-768-xrays.png`; remote `doctor-dashboard-768x1024-ar-light-rtl.png` |
| DOC-02 | Doctor, 768 tablet, Arabic, light, RTL | Active visit - **FAIL: VIS-14F-03**; checked-in-to-active and specific visit detail - **BLOCKED-DATA** | `doctor-ar-light-768-active-visit-error.png` |
| DOC-03 | Doctor, 768 tablet, Arabic, light, RTL | External X-rays and billing handoffs collections - **PASS**; saved/external X-ray and handoff detail - **BLOCKED-DATA** | Doctor billing-handoff empty state inspected live; remote pass recorded the collection routes |
| RBAC-01 | Doctor, Arabic/light/RTL | Attempted Admin workspace - **PASS**: `/admin/dashboard` redirected to `/access-denied` without leaked Admin/Staff navigation | Remote pass |

## Reconciled defect inventory

### CORS-14F-01 - required local frontend origin was previously blocked (resolved before reconciliation)

- Severity: **resolved high**
- Affected scope: Staff, Admin, Doctor login at the required local frontend origin.
- Historical reproduction: open `http://127.0.0.1:5173/login` and sign in against the former localhost-only allowlist.
- Expected: both explicitly configured local frontend origins are accepted.
- Historical actual: the required `127.0.0.1` origin was blocked.
- Resolution retained from remote history: the explicit two-origin environment-driven CORS configuration passed both preflights and role logins. No configuration changes were made by this reconciliation.
- Evidence: remote audit history and `backend/.env.example` change.

### RTL-14F-01 - Doctor Arabic tablet layout has page overflow and clips a patient action

- Severity: **high** (the highest justified severity across both passes; remote pass originally recorded this as medium)
- Affected role/theme/language/viewport: Doctor / Light / Arabic / RTL / 768px wide (reproduced in independent 768x900 and 768x1024 passes).
- Evidence: `doctor-ar-light-768-dashboard-rtl.png`, `doctor-ar-light-768-patients.png`, `doctor-ar-light-768-xrays.png`, `doctor-dashboard-768x1024-ar-light-rtl.png`.
- Reproduction:
  1. Sign in as the existing Doctor QA account.
  2. Select Arabic and Light theme.
  3. Set a 768px-wide tablet viewport and open `/doctor/dashboard`; the remote pass used 768x1024 and the local pass used 768x900.
  4. Observe a horizontal scrollbar at the bottom of the page.
  5. Open `/doctor/patients`; the horizontal scrollbar remains and the patient edit action is visibly truncated.
  6. Open `/doctor/xrays`; the horizontal scrollbar remains.
- Expected: RTL tablet pages fit the viewport without document-level horizontal scrolling; responsive tables preserve complete controls or use the approved deliberate table-scroll treatment.
- Actual: the Doctor Arabic shell/page chrome overflows horizontally and the patient action label is clipped.
- Bounded recommended correction: correct the RTL tablet shell/table width calculation and apply the approved responsive table behavior so controls remain complete without widening the document.

### L10N-14F-02 - selected Arabic leaves major Doctor shell labels in English

- Severity: **medium**
- Affected role/theme/language/viewport: Doctor / Light / Arabic / RTL / 768px.
- Evidence: `doctor-ar-light-768-navigation-open.png`, `doctor-ar-light-768-dashboard-rtl.png`.
- Reproduction:
  1. Sign in as the existing Doctor QA account.
  2. Select Arabic and open the navigation drawer at `/doctor/dashboard`.
  3. Observe English labels including `Dashboard`, `My appointments`, `Active visit`, `Patients`, `X-rays & AI`, `My schedule`, and `My leave`; `Doctor workspace` and the theme control remain English.
- Expected: Arabic selection applies to user-facing Doctor shell/navigation copy, while Latin names, email addresses, IDs, and other isolated data values may remain Latin.
- Actual: Arabic headings are mixed with principal English navigation/action labels.
- Bounded recommended correction: route remaining role-shell/navigation/theme static strings through the existing localization messages while retaining directional icon placement and bidi isolation.

### VIS-14F-03 - Doctor without an active visit receives an error instead of the approved empty state

- Severity: **medium**
- Affected role/theme/language/viewport: Doctor / Light / Arabic / RTL / 768px.
- Evidence: `doctor-ar-light-768-active-visit-error.png`.
- Reproduction:
  1. Sign in as the existing Doctor QA account, which has no active visit in the seeded data.
  2. Select Arabic and open `/doctor/visits/active`.
  3. Wait for the initial loading state to settle (about four seconds in the local pass).
  4. Observe the unavailable-visit error and Retry instead of an empty state with an appointments return action.
- Expected: a Doctor without an active visit sees the established empty state and can return to appointments (`frontend/QA_13G.md`).
- Actual: absence of an active visit renders as an error alert with Retry.
- Bounded recommended correction: distinguish the no-active-visit response from an actual request failure and render the established empty state with the valid appointments action.
- Reconciliation note: the remote pass recorded this route as PASS while its active/detail transition was BLOCKED-DATA; the later independent pass reproduced the error state. The reproducible failure is retained and the contradiction is explicitly preserved here.

## Blocked-data scenarios

Suitable live data was unavailable for: Staff appointment reschedule detail; Staff visit and saved-X-ray detail; Staff billing handoff/invoice/payment/print detail; Admin Team/User detail; Admin leave/visit detail; Admin X-ray/external-case/audit/billing/invoice/print detail; Doctor checked-in-to-active transition, visit detail, saved/external X-ray detail, and billing-handoff detail. These are **BLOCKED-DATA**, not passes and not defects.

## Browser console and network findings

- Local pass: no browser console errors; three React Router v7 `v7_startTransition` future-flag warnings.
- Remote pass: no browser console errors or CORS network failures; the same known React Router future-flag warning.
- Network ledger limitation: the local in-app browser did not expose a complete request ledger. No user-visible failed request was observed except the rendered state captured by VIS-14F-03.
- Clinic-local presentation: both passes reported the configured Damascus local-date/time presentation; no contrary rendering was reproduced.

## Modal and interaction findings

- Staff appointment create and patient edit dialogs were centered, labelled, focused Close, and returned focus to their invoking controls when closed.
- Dirty patient editing presented a discard confirmation.
- Escape dispatch was not reliably injectable by the local browser-control surface; no Escape product failure is claimed.
- Pending-action dismissal blocking, backdrop behavior, and destructive pending-request handling remain unverified rather than passed.

## Evidence and manual review

All evidence from both histories is retained under `frontend/design_v2/phase14f_evidence/`; no filenames collided, so no evidence renaming was required. The remote manual-review checklist is preserved verbatim at `frontend/design_v2/PHASE_14F_MANUAL_REVIEW_CHECKLIST.md`.

Manual review is required before any correction. Review the preserved checklist, confirm RTL-14F-01 at 768px in a human-operated browser, then re-run Arabic shell localization and no-active-visit acceptance after any approved correction.

No UI corrections were implemented during reconciliation. Backend runtime modified: no. Migrations: none.
