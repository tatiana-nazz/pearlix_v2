# Phase 14F Full Visual Source Migration QA

## Automated acceptance

Run against the deterministic Phase 14A local story:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py seed_demo_clinic_story --password "PearlixDemo123!" --reset-demo --include-must-change-user

cd ..\frontend
$env:PEARLIX_E2E_PASSWORD = "PearlixDemo123!"
$env:PHASE14F_EVIDENCE_DIR = "<outside-git-evidence-directory>"
npm run test:e2e
```

The committed Phase 14F Playwright acceptance verifies:

- 264px desktop sidebar, 68px topbar, 20px card radius, and the reference canvas token;
- Admin dashboard, Team directory/detail, and separate Users & Access;
- Staff dashboard, week appointments, own profile, patient profile, and invoice/payment detail;
- Doctor dashboard, week appointments, Active Visit, protected X-ray pixels, and stored AI result;
- 1023px and 767px transformations, no document-level horizontal overflow, Arabic/RTL, and dark mode;
- zero console errors, failed requests, and HTTP responses at or above 400.

## Recorded result

- Frontend: 136/136 tests passed in 47 files.
- Browser: 7/7 Chromium tests passed, including 4/4 Phase 14F visual tests.
- Backend: 420/420 tests passed.
- Typecheck/build/system check/migration drift/documentation consistency/checker syntax: passed.
- Evidence location: `C:\Users\i\.codex\visualizations\2026\07\26\019f9bcf-f389-7413-84b4-06599ee8e6fb\phase14f_browser_evidence`.

## Cleanup

The reset command removes only documented `@pearlix-demo.local`, `DEMO14A-`, tagged demo audit, and `demo14a-` media records before recreating the deterministic story. Screenshots and traces stay outside Git. Stop local frontend/backend development servers after acceptance; do not commit `.env`, credentials, `dist`, `test-results`, or media.
