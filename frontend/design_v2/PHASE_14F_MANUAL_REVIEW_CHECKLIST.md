# Phase 14F Manual Review Checklist — Final Acceptance Attempt

Tested commit: `e4d7d04540163482a8ad2cf747ba7073b6dec3bc`.

## Coherent QA data

- [x] Seeded local-only deterministic story with Admin, active Staff/Doctors, setup-required Doctor, schedules, leave lifecycle, patients, appointment states, visits, imaging/AI, billing, settings, and audit records.
- [x] Rechecked all formerly data-blocked detail categories with linked local records where their routes loaded.
- [x] Confirmed no external AI dependency is required.

## Browser matrix

- [x] Staff — 1440×900, English, Light: executed; **FAIL** (`14F-FINAL-01`, `14F-FINAL-02`).
- [x] Admin — 1024×900, English, Dark: executed; **FAIL** (`14F-FINAL-01`, `14F-FINAL-03`).
- [x] Doctor — 768×1024, Arabic, Light, RTL: executed; **FAIL** (`14F-FINAL-01`, `14F-FINAL-04`, `14F-FINAL-05`).

## Re-verification

- [x] `RTL-14F-01` reproduced with visible horizontal scrollbar.
- [x] `L10N-14F-02` shell labels corrected; feature-status localization still incomplete.
- [x] `VIS-14F-03` reproduced; error state remains instead of empty state.
- [x] Real browser console/network captured; Staff Team 403 and Admin Team uncaught render error recorded.

## Closure

- [x] Final evidence saved under `phase14f_evidence/final_acceptance/`.
- [x] Canonical audit updated with defects, regression sources, acceptance impact, and exact correction task.
- [ ] Phase 14F complete — blocked by three high and two medium product defects.
