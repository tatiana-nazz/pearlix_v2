# Phase 14A Integrated Demo Clinic Story

The Phase 14A demo is a deterministic, development-only dataset for exercising every implemented Pearlix workspace. It creates synthetic records only; its PNG assets are clearly non-clinical, contain no patient data, and must never be presented as diagnostic images.

## Run

```powershell
cd backend
python manage.py seed_demo_clinic_story --password "<LOCAL_QA_PASSWORD>" --reset-demo --reference-date 2026-08-08
```

`--password` accepts a local QA password and defaults to a development-only value. Do not commit or reuse it outside local development. The command refuses to run unless `DEBUG=true`. `--reference-date YYYY-MM-DD` makes the relative story dates deterministic; without it the command derives the date in the configured clinic timezone. `--include-must-change-user` remains accepted for compatibility, but the must-change QA account is now always included.

Without `--reset-demo`, an existing Phase 14A story is left untouched. With it, only accounts whose email ends with `@pearlix-demo.local` are removed, together with patients whose identity begins `DEMO14A-`, their transitively owned workflow records, audit rows tagged by the `phase-14a-integrated-demo-story` marker, and `demo14a-` media. It never deletes unrelated users, patients, workflow records, audit rows, settings, or media.

Phase 14A demo accounts use `@pearlix-demo.local`. Older development QA accounts use `@pearlix.local`; `--reset-demo` does not remove those older QA accounts.

## QA accounts

- `admin@pearlix-demo.local` — Admin
- `staff.one@pearlix-demo.local`, `staff.two@pearlix-demo.local` — Staff
- `doctor.one@pearlix-demo.local` through `doctor.four@pearlix-demo.local` — Doctors
- `doctor.mustchange@pearlix-demo.local` — active Doctor; must change password
- `staff.inactive@pearlix-demo.local` — inactive Staff account with a linked inactive professional profile; login is intentionally blocked

All use the supplied password. The clinic is configured for Damascus, `Asia/Damascus`, English/Arabic, SYP/USD, 30-minute default appointments, capacity 3, and `MOCK_ADAPTER` AI.

Phase 14C.0 gives the Doctors distinct stored specialties, phones, and biographies, and Staff distinct positions and phones. Their login and professional statuses are independently represented through valid profile linkage.

## Anchor story

The 24 synthetic patients include today's confirmed and checked-in appointments, Lina Mansour's Doctor One ACTIVE Visit and ACTIVE Appointment with no Handoff or Invoice, completed clinical history with all five note fields, a returning patient with multiple visits, saved X-rays with and without mock AI, temporary/attached/discarded external X-rays, cancelled/no-show/future appointments, and archived history. The Stage 7 financial story contains six Handoff/Bills: two OPEN, two PARTIALLY_PAID, one PAID, and one CANCELLED; six payment-receipt Invoices include both today's and historical SYP/USD collections, with multiple receipts beneath partial and fully paid Bills. The canonical demo has no normal Staff-approval pending handoff and no Payment rows. Doctors have schedules, Doctor Four and Staff Two demonstrate split shifts, and Staff leave is visible in the consolidated profile.

The reschedule story uses real domain transitions: three future appointments are created before Doctor leave, the leave service marks them, one is then rescheduled to a valid doctor/time and logged with old/new slots, and two remain in the queue. A later Doctor shift reduction marks one additional appointment through the confirmed shift-impact service. A second Doctor leave and parallel same-time appointments across different Doctors make Admin and Staff views meaningfully populated.

Generated demo images are deterministic 320×180 synthetic grayscale illustrations rather than one-pixel placeholders. They are explicitly non-clinical and remain unsuitable for diagnosis.

The seeded Admin, Staff, and Doctor dashboards are non-empty and their related route screens are populated. Stage 7 focused browser coverage verifies the Handoff Bill → Invoice receipt ledger; use `frontend/QA_14A.md` for the broader historical live checklist.

## Automated verification

Phase 14F.3 makes the clinical demo state explicit: Doctor One has named Morning (08:00–12:00) and Evening (14:00–18:00) shifts Monday–Friday with weekends Off; Doctor Two and Staff One have different valid split-shift examples. Exactly one Doctor One visit is started through the normal service transition, while a separate Doctor Two appointment remains checked in and eligible for Start Visit. Eligible appointments fit active shifts; explicit leave/shift-impact records remain intentionally marked Needs Reschedule.

Phase 14F.4 keeps that active visit populated with two visit-owned synthetic X-rays: an active-visit panoramic image with stored structured mock result and protected overlay, plus an active-visit bitewing image without a result so the existing authorized MOCK_ADAPTER run can be exercised. This remains DEBUG-only seed tooling and changes no production model, API, permission, protected-media, or AI behavior.

The mock-AI record uses a distinct transparent 320×180 overlay over a same-size synthetic original and retains structured stored findings. These bytes remain non-clinical demo media; no inference is performed.

Focused command coverage is in `tests/accounts/test_seed_demo_clinic_story_command.py`. It verifies first seed, idempotency, reset preservation, deterministic reference dates, account/profile creation, scheduling/reschedule relationships, visits, imaging/external states, billing reconciliation, audit sanitization, role dashboards, and demo media naming.

The current Phase 14F.1 verification expands the same two focused seed tests with inactive/must-change profile linkage, clinic-local dates, multiple leave types, domain-derived reschedule provenance, returning-patient history, 320×180 media dimensions, financial reconciliation, and sanitized audit evidence. Current full-suite totals are recorded in `PROJECT_STATUS.md`.

Phase 14C.0 subsequently updated the seeded Team linkage and recorded 40 focused Team/account-linkage tests, 414 full backend tests, and 52 frontend contract tests. It adds no runtime Team UI; Phase 14C is next and deployment remains paused.
