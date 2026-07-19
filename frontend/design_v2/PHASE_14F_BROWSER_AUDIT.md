# Phase 14F Browser Audit — Final Acceptance Attempt

## Result

- Tested commit: `e4d7d04540163482a8ad2cf747ba7073b6dec3bc`
- Branch: `phase-14f-browser-visual-uat`
- Environment: Django `http://127.0.0.1:8000`; Vite `http://127.0.0.1:5173` (Staff/Admin) and `http://localhost:5173` (Doctor isolation); local database only.
- QA command: `python manage.py seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`
- Dataset: deterministic synthetic Phase 14A story, enhanced for this pass with Arabic and partial-contact patients, active/upcoming/ended/cancelled leave, an available override, an inactive setup-required Doctor, linked imaging/AI, visits, billing, and audit records.
- Stable command aliases: `PATIENT_PROFILE`, `PATIENT_ARCHIVED`, `APPOINTMENT_CHECKED_IN`, `APPOINTMENT_RESCHEDULABLE`, `APPOINTMENT_EDITABLE`, `VISIT_ACTIVE`, `VISIT_COMPLETED`, `XRAY_AI`, `EXTERNAL_XRAY`, `BILLING_HANDOFF_PENDING`, `INVOICE_UNPAID`, `INVOICE_PARTIAL`, `INVOICE_PAID`, `LEAVE_UPCOMING`, `LEAVE_ACTIVE`, `LEAVE_ENDED`, `LEAVE_CANCELLED`, `AVAILABLE_OVERRIDE`, `DOCTOR_NO_ACTIVE_VISIT`, `DOCTOR_STARTABLE_VISIT`, and `DOCTOR_ACTIVE_VISIT`. Local IDs are printed only by the command and are not committed.
- Matrix executed: Staff / 1440×900 / English / Light; Admin / 1024×900 / English / Dark; Doctor / 768×1024 / Arabic / Light / RTL.
- Final gate: **FAIL**. No scenario is `BLOCKED-DATA`; browser findings below are production defects and were not fixed under this acceptance-only task.

## Browser results

| Area | Result | Evidence / notes |
| --- | --- | --- |
| Staff dashboard and linked QA data | FAIL | Four KPI data records load, but the 1440 shell has document overflow and the fourth card is clipped. |
| Staff Team | FAIL | Required directory request returns HTTP 403, rendering the local error state. |
| Staff appointments, patient detail, billing/invoice/print | PASS (sampled) | Real linked appointment, patient, unpaid/partial invoice, payment controls, and print route load. |
| Admin dashboard | FAIL | At 1024×900 it collapses to a narrow single-column strip with excessive unused canvas; document width exceeds viewport. |
| Admin Team | FAIL | Real setup-required record triggers an uncaught `DirectoryCard` `has_active_schedule` TypeError and exposes the router development error screen. |
| Admin schedules, leave, Clinic Settings, Audit | PASS (sampled) | Seeded schedules, leave lifecycle records, settings, and audit collection load. |
| Doctor Arabic shell | FAIL | Arabic shell labels and `lang="ar"`/`dir="rtl"` are present, but the document is 848/931px wide in a 684/753px client viewport. |
| Doctor no-active-visit | FAIL | Known no-active-visit response renders localized error/Retry, not the required localized empty state. |
| Doctor active visit and X-ray/AI | PASS for linked-data load; FAIL visual gate | Active visit, protected saved X-ray, mock AI record, and external record resolve; the RTL document overflow remains. |

## Defect inventory

### 14F-FINAL-01 — Required matrix layouts overflow horizontally

- Severity: **high**
- Scope: Staff 1440 English/light, Admin 1024 English/dark, Doctor 768 Arabic/light/RTL.
- Expected: no document-level horizontal overflow and the approved KPI/grid geometry at each matrix viewport.
- Actual: Staff document width is 1435px for a 1425px client width and clips the fourth KPI; Admin is 1034px for 1024px; Doctor is 848/931px for 684/753px and has a visible horizontal scrollbar.
- Evidence: `final_acceptance/staff-dashboard-1440x900-en-light.png`, `final_acceptance/admin-dashboard-1024x900-en-dark.png`, `final_acceptance/doctor-dashboard-viewport-768x1024-ar-light-rtl-14F-FINAL-01.png`.
- Acceptance impact: fails visual, responsive, RTL, and no-overflow gates.

### 14F-FINAL-02 — Staff Team directory is denied

- Severity: **high**
- Role/route: Staff, `/staff/team`, 1440×900, English/light.
- Expected: read-only Staff-safe Team directory.
- Actual: HTTP 403 is rendered as `Unable to complete this request.`
- Evidence: `final_acceptance/staff-team-cards-1440x900-en-light.png` (captured before the Light preference correction; result is still the same request failure).
- Acceptance impact: required Staff Team scenario and clean-network gate fail.

### 14F-FINAL-03 — Admin Team crashes on the coherent setup-required record

- Severity: **high**
- Role/route: Admin, `/admin/team`, 1024×900, English/dark.
- Expected: Cards/List directory including the inactive setup-required professional.
- Actual: uncaught `Cannot read properties of undefined (reading 'has_active_schedule')` in `DirectoryCard`, followed by the React Router error screen and console errors.
- Evidence: `final_acceptance/admin-team-runtime-error-1024x900-en-dark-14F-FINAL-03.png`.
- Acceptance impact: required Admin Team/setup workflow and clean-console gate fail.

### 14F-FINAL-04 — Arabic feature values still contain unlocalized status copy

- Severity: **medium**
- Role/route: Doctor dashboard and active visit, 768×1024, Arabic/light/RTL.
- Expected: localized visible feature/status copy except intentionally isolated Latin data values.
- Actual: labels such as `Status: Upcoming`, `Status: Completed`, and `Active visit` remain English.
- Evidence: `final_acceptance/doctor-dashboard-768x1024-ar-light-rtl-14F-FINAL-01.png`, `final_acceptance/doctor-active-visit-data-768x1024-ar-light-rtl.png`.
- Acceptance impact: Arabic visual acceptance fails.

### 14F-FINAL-05 — No-active-visit response remains an error state

- Severity: **medium**
- Role/route: Doctor, `/doctor/visits/active`, 768×1024, Arabic/light/RTL.
- Expected: localized empty state with the valid appointments return action.
- Actual: localized `Visit information is unavailable` error with Retry.
- Evidence: `final_acceptance/doctor-active-visit-error-768x1024-ar-light-rtl-14F-FINAL-05.png`.
- Acceptance impact: Doctor active-visit empty-state scenario fails.

## Prior findings and requested corrections

- `RTL-14F-01`: **FAIL** — reproduced as `14F-FINAL-01` with current evidence.
- `L10N-14F-02`: **PARTIAL** — Doctor shell/navigation is Arabic; remaining English feature/status values are `14F-FINAL-04`.
- `VIS-14F-03`: **FAIL** — reproduced as `14F-FINAL-05`.
- Tasks B–H: **not accepted**; the required post-correction browser pass found the defects above. No runtime correction was made here.

## Console and network summary

- CORS login succeeded at both required local origins.
- Browser console includes the repeated uncaught Admin Team `DirectoryCard` TypeError and React Router error-boundary messages.
- Observed failed request: Staff Team directory HTTP 403. No external AI dependency was used; mock/internal AI data loaded.

## Evidence and gate

- Evidence index: `phase14f_evidence/final_acceptance/EVIDENCE_INDEX.md` (29 screenshots).
- Required scenario groups sampled: 7 pass, 5 fail, 0 `BLOCKED-DATA`; remaining acceptance interactions were not closed after the high-severity production failures above.
- Unresolved counts: blocker 0, high 3, medium 2, low 0.
- Production runtime modified: no. Schema migrations: none.
- Next bounded correction task: fix responsive shell/grid width calculations; restore Staff Team read-only access; make Admin Team safe for setup-required records; localize remaining Doctor status copy; map only the documented no-active-visit error to the empty state; then rerun the full Phase 14F matrix.
