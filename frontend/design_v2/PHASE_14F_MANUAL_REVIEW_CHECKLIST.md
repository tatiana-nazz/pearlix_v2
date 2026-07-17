# Phase 14F Manual Review Checklist

## Before starting

- [ ] Confirm the configured PostgreSQL service is already running and reachable at the database URL in `backend/.env`; do not recreate or reset the database.
- [ ] From `D:\pearlix_v2\backend`, use `D:\pearlix_v2\backend\.venv\Scripts\python.exe manage.py check` and `manage.py migrate --check`.
- [ ] Start backend: `D:\pearlix_v2\backend\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000`.
- [ ] From `D:\pearlix_v2\frontend`, start frontend: `npm.cmd run dev -- --host 127.0.0.1`.
- [ ] Open `http://127.0.0.1:5173/login`; confirm browser console is clear of application errors and API requests reach `http://127.0.0.1:8000/api/`.
- [ ] Sign in with the local deterministic Admin, Staff, and Doctor accounts documented in `backend/project_docs/DEMO_STORY.md`. Do not record passwords in this checklist or commit them.

## Per-screen recording

For every screen below, record one result and notes:

- [ ] Looks good
- [ ] Needs correction
- [ ] Unsure

Notes: ________________________________________________________________

Check visual hierarchy, density, spacing, alignment, clipped/overflowing content, responsive behavior, table states, contrast, icons/badges, mixed Arabic/English names, emails, IDs, currency, and clinic-local dates. Check active navigation, mouse/keyboard rows, filters/clear/pagination/URL retention, focus visibility, modal Escape/backdrop/labelled close/focus return, dirty/pending/validation preservation, preference persistence, back/forward, console/network errors, request methods, 401/403 behavior, missing translations, raw backend text, and unlabeled controls.

## Staff — 1440x900, English, light

- [ ] Dashboard; own Schedule; Leave.
- [ ] Appointments: Day, Week, Month, List, Needs reschedule; row detail; create/edit/reschedule/status interactions.
- [ ] Patients list/detail/edit; Visits read-only; saved X-rays/AI read-only.
- [ ] Billing handoffs, invoices, payments, and print route.

## Admin — 1024x768, English, dark

- [ ] Dashboard; Team list/detail; Users list/new/detail; Clinic Settings; Audit list/detail.
- [ ] Doctor schedules and Leave; appointments/patients/visits/billing read-only surfaces.
- [ ] Saved X-rays/AI and external X-rays/AI.

## Doctor — 768x1024, Arabic, light, RTL

- [ ] Dashboard; own Schedule; Leave; available appointment views.
- [ ] Patients/detail/clinical history; checked-in appointment to active visit; active-visit tabs and clinical notes.
- [ ] Saved X-rays/AI; external X-rays/AI; billing handoff.
- [ ] Confirm Staff/Admin actions are absent and unauthorized routes are denied without leaking controls or raw errors.

## Evidence and review closure

- [ ] Save only reliable, unedited screenshots under `frontend/design_v2/phase14f_evidence/` with role, route, viewport, language, theme, and defect ID in the filename.
- [ ] Add each approved change below; do not implement corrections during this review.

### User-approved visual correction list

1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

Warning: do not close Phase 14F before the second user review confirms the implemented correction list and the same matrix is rechecked.
