# Phase 14E.2A Deterministic Active Visit Browser Acceptance Record

## Acceptance gap and cause

Phase 14E.2 used `doctor.one`, while the deterministic Phase 14A seed deliberately assigns its pre-existing active visit to `doctor.three`. `doctor.one` instead owns the seed's same-day upcoming appointment. The prior browser result was therefore valid empty-state behavior, not an Active Visit query defect.

## Disposable QA scenario

The documented DEBUG-only `seed_demo_clinic_story --reset-demo --reference-date 2026-07-26` reset a disposable local story at the clinic-local date. Staff checked in the same-day `doctor.one` appointment for Amina Khalil through the real detail confirmation. The owning Doctor then started and completed the resulting visit through existing API-backed UI actions. No production behavior, permissions, routes, or database artifacts were changed or committed.

## Browser acceptance

- Staff: collection row opened the appointment detail; the supported Upcoming -> Checked-in confirmation succeeded; Staff had no Start Visit or clinical-note mutation controls.
- Doctor: Start visit appeared only in the opened checked-in appointment detail. The confirmed real action opened Active Visit with patient, Doctor, appointment, status, and localized time data, without raw IDs, ISO values, null, or undefined values.
- Tabs: Notes rendered all five fields; the real note save persisted after reload through the Staff/Admin read-only views. Patient Profile was read-first and had no archive/history-editor/payment controls. X-rays presented the contract-backed empty state and eligible upload only. Billing remained handoff-only and payment-free.
- Completion: confirmation was opened, cancelled once without changing state, reopened, and completed successfully. Active Visit then showed the truthful no-active state and Staff/Admin showed the resulting completed visit read-only.
- Protection: Staff and Admin had no Save Notes, Start Visit, Complete Visit, or Doctor-only handoff controls. Doctor navigation had no global Billing/payment control.
- Responsive/theme: data-bearing active visit passed 1440x900, 1280x720, 1024x768, and 768x1024 with four tabs and no document horizontal overflow. English light, dark mode, and Arabic RTL were exercised without a responsive implementation change.
- Browser diagnostics: no application console errors; normal workflow requests succeeded without CORS failures.

## Defect fixed

The browser workflow exposed that the existing `startAppointmentVisit` hook/API wrapper was never connected to the opened Doctor appointment detail. Phase 14E.2A adds the Doctor-only Start visit detail action, confirmation, mutation, query invalidation, and navigation to Active Visit. Collection rows remain action-free.

## Automated coverage and cleanup

Focused appointment-detail coverage verifies Doctor-only Start visit visibility and callback behavior. Final validation passed: TypeScript typecheck, 125 Vitest tests in 43 files, production build, 3 Playwright tests, Django check, migration-drift check, 420 backend tests, and documentation consistency. The local demo story was reset again after acceptance, restoring deterministic disposable seed state; no screenshots, traces, media, uploads, databases, credentials, or browser profiles are tracked.
