# Phase 14A QA — Integrated Demo Story

## Seed

```powershell
cd backend
python manage.py seed_demo_clinic_story --password "PearlixDemo123!" --reset-demo --include-must-change-user --settings=config.settings.local
```

Use the local-only accounts in `backend/project_docs/DEMO_STORY.md`. The optional must-change Doctor should be restricted to the change-password route until the password is changed.

## Browser checklist (pending execution)

- Admin dashboard shows active patients, appointments, active visit, invoices, handoffs, audit logs, schedules, leave, and clinic settings.
- Staff dashboard shows today’s queue, checked-in work, needs-reschedule items, billing handoffs, unpaid/partial invoices, and recent patients.
- Doctor dashboards show own schedule, appointments, active/completed visits, clinical notes, saved X-rays, external workspace, and own handoffs.
- Confirm the two leave-sourced and one shift-change-sourced `NEEDS_RESCHEDULE` records are visible and the split-shift gap has no appointment.
- Inspect the synthetic `demo14a-` images: mock AI result includes an overlay and supportive/non-diagnostic wording; the second saved X-ray has no AI result.
- Verify temporary, attached-to-patient, and discarded external X-ray cases; only allowed role actions are available.
- Verify pending, converted, and dismissed handoffs, plus unpaid, partially paid, paid, and cancelled invoices with correct balance and matching currency payments.
- Confirm audit metadata never renders passwords, tokens, clinical-note bodies, or file contents.

No browser result is claimed in this document.

## Automated results

- Focused Phase 14A seed tests: 2 passed.
- Full backend regression: 407 passed.
- Django check and migration-drift check: passed.
- Frontend source/package files were unchanged; frontend tests and build were not rerun.

## Phase 14F.4 Active Visit addendum

The current deterministic story keeps Doctor One's active visit populated with editable notes and two visit-owned protected X-rays. One has a stored structured mock result/overlay; one remains eligible for the existing `POST /api/xrays/{id}/run-ai/` endpoint. Active Visit retains exact four-tab semantics, owning-Doctor notes/upload/AI-run permissions, Staff/Admin read-only behavior, confirmed completion, and payment-free Doctor billing handoff.
