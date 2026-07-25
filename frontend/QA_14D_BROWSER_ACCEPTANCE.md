# Phase 14D Browser Acceptance

Executed on 2026-07-25 against the local Vite frontend and Django API after resetting the deterministic development-only demo story. Browser evidence is local-only and intentionally not committed.

## Executed matrix

| Dimension | Executed coverage | Result |
| --- | --- | --- |
| Roles | Admin, Staff, Doctor authenticated workspaces | Pass |
| Viewports | 1440x900, 1280x720, 1024x768, 768x1024 | Pass after BA-001 repair |
| Theme/language | English light and Arabic dark | Pass |
| Shell/dashboards | Role shell and Admin, Staff, Doctor dashboards | Pass |
| Workflows | Admin Team/Users; Staff appointments and patients; Doctor patient boundaries | Pass |
| Accessibility/RTL | Accessible shell labels, keyboard-safe tabs, Arabic RTL | Pass |
| Console/network | No console errors or failed application requests observed | Pass |

## Workflows exercised

- Admin sign-in, dashboard, Team, Users & Access, Arabic RTL, and light theme.
- Staff sign-in, day/week/month/list/needs-reschedule appointments, patient directory, General Information patient creation, detail, and Medical Summary.
- Doctor sign-in, dashboard, patient directory/detail, and absence of patient-creation, archive, and billing/handoff actions.
- Responsive verification at all required viewports, including 768px Arabic RTL and LTR shell behavior.

## Defect closure

| ID | Severity | Finding | Resolution | Retest |
| --- | --- | --- | --- | --- |
| BA-001 | High | Hidden mobile sidebar extended the document horizontally in 768px Arabic RTL. | Added `overflow-x: clip` to `.app-shell` and a token contract regression assertion. | Pass: document `scrollWidth` equals `clientWidth`. |
| BA-002 | Medium | Phase 14D shell navigation labels remained English after Arabic selection. | Centralized translated navigation, role-workspace, navigation, and sidebar-toggle copy. | Pass: Arabic sidebar labels render in RTL. |

No Blocker, Critical, or High defects remain. BA-001 was the only High defect found and is closed.

## Automated smoke suite

`npm run test:e2e` executes three Playwright browser smoke cases against seeded local demo accounts supplied through `PEARLIX_E2E_PASSWORD`. It covers Admin Team/Users, Staff scheduling/patients, and Doctor patient action boundaries without hardcoding credentials.

## Deferred Phase 14E findings

None from the executed Phase 14D acceptance scope.
