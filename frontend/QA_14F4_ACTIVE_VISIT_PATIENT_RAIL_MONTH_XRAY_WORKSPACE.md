# Phase 14F.4 Active Visit, Patient Rail, Month, and X-ray Workspace QA

**Date:** 2026-07-26

**Reference date:** `2026-07-26` (`Asia/Damascus`)

**Dataset marker:** `phase-14a-integrated-demo-story` (left populated)

## Automated gates

- TypeScript project check and production build passed.
- Complete frontend regression passed: 155 tests in 50 files.
- Focused deterministic-seed regression passed: 5 tests.
- Complete backend regression passed: 425 tests.
- Complete serial Chromium regression passed: 17 scenarios, including 3 Phase 14F.4 Staff, Admin, and Doctor scenarios.
- Documentation consistency, checker syntax, Django system, strict profile integrity, migration drift, unstaged diff, and staged diff checks passed.

## Real API and browser acceptance

- Staff Month items rendered semantic status classes and accessible time/patient/status labels, opened detail as whole items, retained the desktop sticky Patient Profile rail and tablet stack, and exposed neither note editing nor X-ray upload/AI-run mutations.
- Admin retained Month semantics, a static Patient Profile rail, read-only visit notes, authorized protected original viewing, and no upload or AI-run mutation.
- Doctor One opened Lina Mansour's Active Visit from the Dashboard, saved notes through the real API, changed all four tabs, reviewed two protected visit X-rays inline, uploaded disposable synthetic PNG media, ran `POST /api/xrays/{id}/run-ai/`, and received the stored mock-adapter result.
- The stored-result X-ray exposed a dedicated AI panel, same-canvas Show/Hide AI Overlay geometry, working zoom/reset/fit/fullscreen controls, a visible research-only warning, and no navigation away from Active Visit.
- Billing / Invoice Handoff remained payment-free for Doctor and global Billing navigation remained absent.
- Protected original/overlay images had non-zero natural dimensions; required requests succeeded with no CORS failure, broken protected image, unexpected console error, invalid nesting warning, or unhandled rejection.

## Responsive evidence

Month, Patient Profile, Active Visit summary/tabs, notes, patient context, inline viewer, thumbnail strip, AI side panel, toolbar, upload modal, billing handoff, and completion flow were exercised at 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1024×768, and 768×1024. Every viewport satisfied `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

Passing visual evidence is stored outside Git. Generated database, media, build output, screenshots, traces, browser profiles, and test results are not committed.
