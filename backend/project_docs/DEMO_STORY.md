# Phase 14A Integrated Demo Clinic Story

The Phase 14A demo is a deterministic, development-only dataset for exercising every implemented Pearlix workspace. It creates synthetic records only; its PNG assets are clearly non-clinical, contain no patient data, and must never be presented as diagnostic images.

## Run

```powershell
cd backend
python manage.py seed_demo_clinic_story --password "PearlixDemo123!" --reset-demo --include-must-change-user
```

`--password` accepts a local QA password and defaults to `PearlixDemo123!`. Do not commit or reuse it outside local development. The command refuses to run unless `DEBUG=true`. `--reference-date YYYY-MM-DD` makes the relative story dates deterministic for automated tests.

Without `--reset-demo`, an existing Phase 14A story is left untouched. With it, only accounts whose email ends with `@pearlix-demo.local` are removed, together with patients whose identity begins `DEMO14A-`, their transitively owned workflow records, audit rows tagged by the `phase-14a-integrated-demo-story` marker, and `demo14a-` media. It never deletes unrelated users, patients, workflow records, audit rows, settings, or media.

Phase 14A demo accounts use `@pearlix-demo.local`. Older development QA accounts use `@pearlix.local`; `--reset-demo` does not remove those older QA accounts.

## QA accounts

- `admin@pearlix-demo.local` — Admin
- `staff.one@pearlix-demo.local`, `staff.two@pearlix-demo.local` — Staff
- `doctor.one@pearlix-demo.local` through `doctor.four@pearlix-demo.local` — Doctors
- `doctor.mustchange@pearlix-demo.local` — optional Doctor; must change password

All use the supplied password. The clinic is configured for Damascus, `Asia/Damascus`, English/Arabic, SYP/USD, 30-minute default appointments, capacity 3, and `MOCK_ADAPTER` AI.

## Anchor story

The 24 synthetic patients include today’s confirmed and checked-in appointments, one active visit, completed clinical history with all five note fields, saved X-rays with and without mock AI, temporary/attached/discarded external X-rays, leave- and shift-change reschedules, cancelled/no-show/future appointments, archived history, and pending/converted/dismissed handoffs with unpaid/partial/paid/cancelled invoices. Doctors have schedules; Doctor Four has daily split shifts.

The seeded Admin, Staff, and Doctor dashboards are non-empty and their related route screens are populated. Browser QA is still pending; use `frontend/QA_14A.md` for the live checklist.

## Automated verification

Focused command coverage is in `tests/accounts/test_seed_demo_clinic_story_command.py`. It verifies first seed, idempotency, reset preservation, deterministic reference dates, account/profile creation, scheduling/reschedule relationships, visits, imaging/external states, billing reconciliation, audit sanitization, role dashboards, and demo media naming.

Phase 14A verification recorded 2 focused seed tests and 407 backend tests passing. Frontend source and packages are unchanged, so frontend tests/build were not rerun. Browser QA remains pending.
