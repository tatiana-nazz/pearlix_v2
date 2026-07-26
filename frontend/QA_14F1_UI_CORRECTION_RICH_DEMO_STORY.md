# Phase 14F.1 UI Correction and Rich Demo Story QA

**Date:** 2026-07-26

**Reference date:** `2026-07-26` (`Asia/Damascus`)

**Dataset marker:** `phase-14a-integrated-demo-story`

## Automated gates

- Frontend TypeScript and production build: passed.
- Frontend unit/component regression: 140 tests in 47 files passed.
- Backend seed command: focused relationship/media tests passed.
- Full backend regression: 420 tests passed. Django system checks, migration drift, and documentation consistency passed in the final clean run.
- Chromium acceptance: five role/workflow/responsive scenarios passed, including real API appointment creation, rescheduling, and visit start; all corrected Staff appointment views; the sibling reschedule queue; versioned patient editing; profile consolidation; Admin settings cards; Doctor Month; protected X-ray pixels; RTL; dark mode; and 1023px/767px overflow checks.

## Direct browser verification

- Staff dashboard had no Refresh control, exposed both primary creation actions, rendered four distinct KPI tone classes, and had one `My Profile` sidebar entry.
- Staff sidebar had no `My Schedule`, `My Leave`, or reschedule-queue item.
- Appointment navigation successfully transitioned Week → Month → browser Back → Reschedule Queue; the queue showed leave and shift-change provenance.
- Staff patient Edit opened a focus-managed modal with loaded values and saved a versioned change visible on the profile.
- Admin Clinic Settings exposed four typed cards and one Save settings action.
- The in-app browser and the Chromium suite reported no application console errors, failed requests, or HTTP errors during the accepted paths.

## Evidence location

Generated screenshots are stored outside Git under:

`C:\Users\i\.codex\visualizations\2026\07\26\019f9bcf-f389-7413-84b4-06599ee8e6fb\phase14f1_browser_evidence`

They include before captures plus corrected dashboard, week, month, reschedule queue, profile, patient edit/save, clinic settings, Doctor, protected X-ray, tablet, mobile, RTL, and dark-mode views.
