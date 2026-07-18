# Phase 14F Browser Visual / UAT Audit

## Audit identity

- Tested commit: `0a0a7fed41e9f9f2f34d26dfe3d45d4b20ef788a`
- Audit branch: `phase-14f-browser-visual-uat`
- Date: 2026-07-18 (Asia/Damascus)
- Scope: real local Django + Vite runtime and in-app Chromium browser. No API mocking, fixture edits, runtime-code edits, migrations, deployment, or corrective changes were made.

## Environment and launch commands

Preflight completed successfully:

```powershell
cd D:\pearlix_v2\backend
D:\pearlix_v2\backend\.venv\Scripts\python.exe manage.py check

cd D:\pearlix_v2\frontend
npm.cmd run typecheck
```

Launch commands used:

```powershell
cd D:\pearlix_v2\backend
D:\pearlix_v2\backend\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload

cd D:\pearlix_v2\frontend
npm.cmd run dev -- --host 127.0.0.1
```

`manage.py check` reported no issues; `npm.cmd run typecheck` passed.

## Accounts and browser matrix

Only existing local QA accounts were used; passwords are intentionally omitted.

| Role/account | Viewport | Language | Theme | Result |
| --- | ---: | --- | --- | --- |
| Staff (`staff.qa@pearlix.local`) | 1440px desktop | English | Light | PASS except no defect reproduced |
| Admin (`admin.qa@pearlix.local`) | 1024px tablet | English | Dark | PASS except no defect reproduced |
| Doctor (`doctor.qa@pearlix.local`) | 768px tablet | Arabic | Light | FAIL: responsive overflow/clipping and incomplete Arabic shell copy; active-visit empty state fails |

## Routes and scenario results

| Scenario / routes inspected | Result | Evidence |
| --- | --- | --- |
| Login/logout: `/login`, Staff logout, Admin logout | PASS | `staff-en-light-1440-logout.png` |
| Staff shell/dashboard: `/staff/dashboard`; expanded/collapsed sidebar | PASS | `staff-en-light-1440-dashboard.png`, `staff-en-light-1440-sidebar-collapsed.png` |
| Staff appointments: `/staff/appointments/day`; create dialog, Escape/close behavior and focus return | PASS | `staff-en-light-1440-appointments-day.png`, `staff-en-light-1440-appointment-create-modal.png` |
| Staff patients: `/staff/patients`, `/staff/patients/106`; edit dialog, dirty-discard prompt and focus return | PASS | `staff-en-light-1440-patients.png`, `staff-en-light-1440-patient-profile.png`, `staff-en-light-1440-patient-edit-modal.png` |
| Admin dashboard: `/admin/dashboard` | PASS | `admin-en-dark-1024-dashboard.png` |
| Admin Team: `/admin/team` | PASS | `admin-en-dark-1024-team.png` |
| Admin Users & Access: `/admin/users` | PASS | `admin-en-dark-1024-users-access.png` |
| Admin appointments: `/admin/appointments/list` | PASS | inspected live |
| Admin Billing: `/admin/billing` | PASS | inspected live |
| Admin Clinic Settings: `/admin/clinic-settings` | PASS | inspected live |
| Admin Audit Log: `/admin/audit-logs` | PASS | inspected live |
| Doctor dashboard and RTL navigation: `/doctor/dashboard` | FAIL: F14F-001, F14F-002 | `doctor-ar-light-768-dashboard-rtl.png`, `doctor-ar-light-768-navigation-open.png` |
| Doctor appointments: `/doctor/appointments/list` | FAIL: F14F-001 applies to page chrome | `doctor-ar-light-768-appointments.png` |
| Doctor patients: `/doctor/patients` | FAIL: F14F-001 | `doctor-ar-light-768-patients.png` |
| Doctor active visit: `/doctor/visits/active` | FAIL: F14F-003 | `doctor-ar-light-768-active-visit-error.png` |
| Doctor X-rays and AI: `/doctor/xrays` | FAIL: F14F-001 applies to page chrome; mixed Arabic/English rows remain readable | `doctor-ar-light-768-xrays.png` |
| Doctor billing handoffs: `/doctor/billing/handoffs` | PASS (empty state) | inspected live |

The Staff and Admin tables had no document-level horizontal overflow at their required viewports. The Doctor Arabic view set `dir="rtl"` and `lang="ar"`; seeded Latin names, emails, numbers, currencies, identifiers, and dates remained readable. The Doctor 768px view nevertheless showed a visible horizontal scrollbar and a clipped action label on the patient table.

## Defect inventory

### F14F-001 — Tablet RTL layout exposes horizontal scrollbar and clips patient action text

- Severity: **high**
- Affected role/theme/language/viewport: Doctor / Light / Arabic / 768px
- Evidence: `doctor-ar-light-768-dashboard-rtl.png`, `doctor-ar-light-768-patients.png`, `doctor-ar-light-768-xrays.png`
- Reproduction:
  1. Sign in as the existing Doctor QA account.
  2. Select Arabic and Light theme.
  3. Set the viewport to 768px and open `/doctor/patients`.
  4. Observe the persistent horizontal scrollbar and the action text truncated to `تعد` in the leftmost table column.
  5. The same horizontal scrollbar is present on `/doctor/dashboard` and `/doctor/xrays`.
- Expected: the 768px RTL layout fits the viewport without document-level horizontal scrolling; tables either preserve complete controls or present an intentional responsive/table-scroll treatment.
- Actual: the visible horizontal scrollbar is present across Doctor Arabic tablet pages, and the patient edit action is visibly clipped.
- Bounded recommended correction: correct the RTL tablet shell/table width calculation and apply the approved responsive table behavior so controls retain full labels without widening the document.

### F14F-002 — Arabic selection leaves major Doctor shell/navigation copy in English

- Severity: **medium**
- Affected role/theme/language/viewport: Doctor / Light / Arabic / 768px
- Evidence: `doctor-ar-light-768-navigation-open.png`, `doctor-ar-light-768-dashboard-rtl.png`
- Reproduction:
  1. Sign in as the existing Doctor QA account.
  2. Select Arabic.
  3. Open the navigation drawer at `/doctor/dashboard`.
  4. Observe English labels including `Dashboard`, `My appointments`, `Active visit`, `Patients`, `X-rays & AI`, `My schedule`, and `My leave`; `Doctor workspace` and the theme control are also English.
- Expected: selected Arabic applies to the user-facing Doctor shell and navigation, while properly isolated names/identifiers can remain Latin.
- Actual: section headings are Arabic but the principal navigation/action labels remain English, creating a mixed, incomplete localized shell.
- Bounded recommended correction: route all remaining role-shell/navigation/theme static strings through the existing localization messages; retain `dir`-appropriate icon placement and bidi isolation for data values.

### F14F-003 — Doctor with no active visit receives error state rather than required empty state

- Severity: **medium**
- Affected role/theme/language/viewport: Doctor / Light / Arabic / 768px
- Evidence: `doctor-ar-light-768-active-visit-error.png`
- Reproduction:
  1. Sign in as the existing Doctor QA account, which has no active visit in the seeded data.
  2. Select Arabic and open `/doctor/visits/active`.
  3. Wait for the initial loading state to settle (approximately four seconds in this run).
  4. Observe `معلومات الزيارة غير متاحة` with Retry instead of an empty-state route back to appointments.
- Expected: a Doctor without an active visit sees the approved empty state and can return to appointments (see `frontend/QA_13G.md`).
- Actual: the absence of an active visit renders as an error alert with Retry.
- Bounded recommended correction: distinguish the no-active-visit response from an actual request failure and render the established empty state with the valid appointments action.

## Browser findings

- Console errors: none observed.
- Console warnings: three development-only React Router v7 future-flag warnings (`v7_startTransition`); no runtime application error was emitted.
- Failed network requests: none observed in the browser UI/console during the audited paths. The in-app browser surface did not expose a network-request ledger; no failure surfaced to the user other than F14F-003's rendered state.
- Clinic-local presentation: visible local-date text and date/time formatting used the configured Damascus local clinic date; no contrary rendering was reproduced.
- Modal behavior: create/edit dialogs were centered, focused their Close control, closed through the Close control, and returned focus to the invoking button. Dirty patient edit invoked a discard-confirmation dialog. Escape dispatch could not be reliably injected by the browser-control surface, so no Escape-specific product failure is recorded.
- Pending-action dismissal blocking, modal backdrop behavior, and filter/pagination preservation were not independently stress-tested with a mutating pending request; no defect is claimed for them.

## Manual review checkpoint

Manual review is required before any correction. Confirm F14F-001 at 768px in a human-operated browser after the proposed responsive change, then re-run the Arabic shell localization and no-active-visit acceptance scenarios.

No fixes were implemented in this audit. Backend runtime modified: no. Migrations: none.
