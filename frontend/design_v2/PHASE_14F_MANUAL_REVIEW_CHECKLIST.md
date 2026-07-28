# Phase 14F Manual Review Checklist — Current-Head Acceptance

Runtime-and-evidence commit: `4d8f00cdeed0001c1ee8de5fc47d9ec3917f4877`.

## Coherent QA data

- [x] Seeded the deterministic local story with `seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`.
- [x] Used linked patient, appointment, visit, imaging/AI, billing, schedule, leave, settings, audit, and setup-required-professional records.
- [x] Confirmed that no external AI dependency is required.

## Browser matrix

- [x] Staff — 1440×900, English, Light: Dashboard, Team, Appointments Day/Week/Month, Patients, Patient Profile, Billing, invoice detail/payment, and invoice print.
- [x] Admin — 1024×900, English, Dark: Dashboard, Team including setup-required record, Users & Access, Schedules, Leave, Clinic Settings, and Audit.
- [x] Doctor — 768×1024, Arabic, Light, RTL: Dashboard, drawer, active-visit data, no-active-visit empty state, Appointments, Patients, X-rays/AI, and X-ray detail.
- [x] Every required capture has no document-level horizontal overflow or clipped primary content.
- [x] Theme, language, RTL direction, role restrictions, read-only boundaries, and supported actions matched the applicable route contract.

## Re-verification

- [x] 14F-FINAL-01 through 14F-FINAL-05 do not reproduce at the runtime-and-evidence commit.
- [x] Staff Team returned the safe directory rather than 403.
- [x] Admin Team rendered the setup-required professional without a React Router error.
- [x] The documented `NO_ACTIVE_VISIT` response rendered the Arabic empty state rather than Retry.
- [x] The protected X-ray detail loaded after correcting API-rooted Blob-link normalization.
- [x] Browser console and network gates passed; the expected no-active-visit 404 was mapped to the empty state.

## Closure

- [x] New unedited browser captures are stored in `phase14f_evidence/current_head_acceptance/`.
- [x] Canonical status, audit, manual checklist, and evidence index reflect the current acceptance result.
- [x] Phase 14F complete.
