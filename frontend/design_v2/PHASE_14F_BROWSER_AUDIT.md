# Phase 14F Browser Audit — Current-Head Acceptance

## Result

- Runtime-and-evidence commit: `4d8f00cdeed0001c1ee8de5fc47d9ec3917f4877`
- Branch: `phase-14f-browser-visual-uat`
- Local environment: Django `http://127.0.0.1:8000`; Vite `http://127.0.0.1:5173`
- QA data command: `python manage.py seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`
- Evidence: `phase14f_evidence/current_head_acceptance/`
- Final gate: **PASS**

The previous final-acceptance audit was tested at `e4d7d04540163482a8ad2cf747ba7073b6dec3bc` and is historical only. It does not describe the runtime-and-evidence commit above.

## Required browser matrix

| Role | Viewport / preference | Routes verified | Result |
| --- | --- | --- | --- |
| Staff | 1440×900, English, Light | Dashboard; Team; Appointments Day/Week/Month; Patients; Patient Profile; Billing; Invoice detail/payment; Invoice print | PASS |
| Admin | 1024×900, English, Dark | Dashboard; Team with setup-required professional; Users & Access; Schedules; Leave; Clinic Settings; Audit | PASS |
| Doctor | 768×1024, Arabic, Light, RTL | Dashboard; navigation drawer; no-active-visit empty state; active-visit data state; Appointments; Patients; X-rays/AI; X-ray detail | PASS |

Every captured page had `scrollWidth === clientWidth`. The Staff and Admin captured widths were 1425 and 1009 CSS pixels respectively after vertical-scrollbar reservation; the Doctor captures were 768 or 753 CSS pixels for the same reason. No document-level horizontal overflow or clipped primary content was observed.

## Historical finding re-verification

| Finding | Current result | Evidence |
| --- | --- | --- |
| 14F-FINAL-01 — overflow/KPI geometry | PASS — no reproduction at all required viewports | Staff, Admin, and Doctor dashboard captures in `current_head_acceptance/` |
| 14F-FINAL-02 — Staff Team 403 | PASS — read-only directory loads under Staff | `staff-team-1440x900-en-light.png` |
| 14F-FINAL-03 — setup-required Team crash | PASS — inactive/setup-required card renders without console error | `admin-team-setup-required-1024x900-en-dark.png` |
| 14F-FINAL-04 — Arabic feature/status copy | PASS — shell and feature/status labels are Arabic; isolated Latin demo values remain data | Doctor captures |
| 14F-FINAL-05 — no-active-visit error | PASS — documented `NO_ACTIVE_VISIT` response renders the Arabic empty state with the day-appointments action | `doctor-active-visit-empty-768x1024-ar-light-rtl.png` |

An additional current-head browser defect was found during the X-ray-detail route: API-rooted protected-media links were combined with the configured API base and requested as `/api/api/...`. The frontend now normalizes a matching API-root prefix before issuing the authenticated Blob request. The protected image loaded after the correction; see `doctor-xray-ai-detail-768x1024-ar-light-rtl.png`.

## Console, network, and automated gates

- Browser console: no uncaught errors.
- Network: no unexpected failed request. The Doctor no-active-visit `404 NO_ACTIVE_VISIT` is the documented empty-state response and was handled without an error UI.
- Frontend: 68 test files / 236 tests passed; TypeScript typecheck and production build passed.
- Backend: focused X-ray/AI/protected-media suite 50 passed; full suite 423 passed; Django check passed; migration drift reported no changes.
- Documentation consistency and `git diff --check` passed after closure-document updates.

## Closure

Phase 14F is complete. No high or medium Phase 14F production defect remains. Backend runtime changed: no. Migrations: none.
