# Phase 14D QA — Priority Workflows

## Closure status

Phase 14D acceptance-test closure remains in progress: the expanded suites pass, but the full mandated scenario matrices are not yet complete. Phase 14E has not started. Browser QA remains the Phase 14F visual/UAT gate. Backend runtime changed: no. Migrations: none.

- Dashboards, Team, Users & Access, appointments, and patient workflows use the Phase 14D v2 surfaces.
- Feature copy is typed EN/AR, with localized role, status, and availability labels; the Team and Users & Access pages do not present raw display enums.
- Team and patient values with mixed-direction content use bidi isolation. Shared overlays provide dirty-discard confirmation, pending close locks, Escape handling, focus containment, and focus return.
- New Patient protects dirty internal navigation, browser back navigation, and before-unload; a successful create clears the block before profile navigation.
- Patient mutation, local-validation, and conflict errors are independent. Supported API field errors are associated with their fields through `aria-invalid` and `aria-describedby`.

## Automated verification

- Frontend: `npm.cmd run typecheck` passed; `npm.cmd run test:run` passed (40 files, 119 tests); `npm.cmd run build` passed.
- Backend: `manage.py check` reported `System check identified no issues (0 silenced).` Migration drift check reported `No changes detected`.
- Full backend suite: `python -m pytest` passed (414 tests).
- Focused backend suites: Team/account and Users/role transition 35 passed; appointments 39 passed; patients and IDOR/security 25 passed (99 focused tests total).
- Repository checks: `git diff --check` passed and no TypeScript/test suppressions are present in `frontend/src`.
- The documentation consistency checker is not a substitute for typecheck, tests, build, or backend verification.

## Browser QA

Not completed. Phase 14F browser/UAT evidence remains the release gate: Staff 1440 EN/light; Admin 1024 EN/dark; Doctor 768 AR/light; dashboards, Team, Users & Access, appointments, patients, focus return, dirty close, route blocking, filter preservation, RTL/bidi, dark surfaces, overflow, and clinic-local date.

## Next phase

Phase 14E — Schedules and Leave, Visits, X-rays and AI, Billing, Clinic Settings, and Audit.
