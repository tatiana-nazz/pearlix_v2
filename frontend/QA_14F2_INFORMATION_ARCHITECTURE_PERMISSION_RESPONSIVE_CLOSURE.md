# Phase 14F.2 Information Architecture, Permission, and Responsive Closure QA

**Date:** 2026-07-26

**Reference date:** `2026-07-26` (`Asia/Damascus`)

**Dataset marker:** `phase-14a-integrated-demo-story` (left populated)

## Automated gates

- Frontend TypeScript production build: passed.
- Frontend unit/component regression: 143 tests in 48 files passed, including schedule-matrix, Team card/Staff route, sidebar IA, profile, patient, appointment tabs, status, and Users & Access coverage.
- Focused backend Team/patient regression: 34 tests passed.
- Full backend regression: 422 tests passed. Django checks, migration drift, and documentation consistency passed.
- Chromium acceptance: 7 non-destructive Phase 14F/14F.2 scenarios passed. The 3 new scenarios cover Staff IA, profile semantics, safe Team list/detail, unified Billing, aligned appointment toolbar/state preservation, Admin identity directories, direct route denial, and 1023px/767px document-overflow checks.

## Direct browser verification

- Staff sidebar rendered exactly Dashboard, Appointments, Patients, Team, X-rays & AI, Billing, and My Profile.
- Staff Profile contained no Current workload copy or markup; Working hours used a semantic table with Shift plus Monday–Sunday, and Leave used Date / Time, Reason, Type, Status.
- Staff Team returned the populated professional card grid without Add, account-security, Users & Access, or mutation controls; Staff detail was read-only.
- Billing root redirected to Handoffs and exposed one Billing heading with Handoffs/Invoices tabs.
- Appointment date navigation and both switcher groups measured the same top coordinate and exactly 44px height. The queue retained all six links and returned to the remembered Month view.
- Patient identity rows rendered initials, contact, Gender, Last visit, and Next appointment. Document overflow remained zero; narrower table content used contained scrolling.
- Admin and Doctor direct access to the Staff Team route was denied by the frontend role guard; API tests independently verify Staff GET-only and Doctor/unauthenticated denial.

## Generated evidence

Playwright screenshots/traces and in-app-browser tabs are generated evidence outside the repository. `frontend/test-results` is removed before commit.
