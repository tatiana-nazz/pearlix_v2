# Phase 13K QA - Final Regression And Release Readiness

## Scope

Phase 13K completes the Phase 13 series. It validates the existing integrated frontend and backend contract, removes dead placeholder navigation, adds route/sidebar regression coverage, strengthens Admin role-change confirmation and reset-password dialog semantics, and adds documentation consistency validation. Backend runtime code and migrations are unchanged.

## Final Route And Role Matrix

- Admin: dashboard; users/create/detail; clinic settings; schedules and leave; read-only patient, appointment, visit, saved/external X-ray, billing, invoice/print, and audit views.
- Staff: dashboard; patient create/edit/archive; appointment and Needs Reschedule workflow; read-only schedules, leave, visits, and saved X-rays; billing handoff, invoice, payment, and print operations.
- Doctor: dashboard; own appointments and active visits; own notes and completed-visit handoffs; patient profile editing; saved and external X-rays; read-only own schedule/leave. Doctor has no invoice, payment, Admin, or audit navigation.
- Wrong-role routes use Access Denied. Unknown routes use Not Found. Must-change-password users remain restricted to password change and logout.

## Automated Regression Coverage

- Authentication/account safety: login and refresh behavior, required password change, logout cleanup, Admin temporary-password reset, self-deactivation and last-active-Admin protections.
- Patients: canonical schema, optimistic version/archive handling, archive guards, role-aware profile actions and billing links.
- Scheduling: appointment views, Needs Reschedule behavior, availability, schedule/leave versioning, Doctor schedule-impact confirmation, and role visibility.
- Visits: own start/notes/completion permission boundaries and save-before-complete behavior.
- X-rays and AI: upload validation, role permission utilities, authenticated Blob media, temporary object URL replacement/unmount revocation, overlays, external ownership, and `MOCK_ADAPTER` handling.
- Billing: handoff/invoice/payment permissions and financial lock/decimal formatting utilities. The frontend does not use delete operations or direct status PATCHes.
- Admin/audit: role-aware sidebar targets, user role-change confirmation, safe clinic settings visibility, and plain-text redacted audit metadata.
- Accessibility/responsiveness: named sidebar navigation, labeled controls, modal semantics, visible existing focus styling, and 1440/1280/1024/768 CSS breakpoints reviewed by automated source and component checks.
- Security/packaging: no public protected media URLs, no Blob or password persistence, no committed QA credentials, no secrets, no media, no virtualenv, and no generated artifacts included in the change set.

## Final Automated Results

```bash
cd backend
.venv\\Scripts\\python.exe manage.py check --settings=config.settings.local
.venv\\Scripts\\python.exe manage.py makemigrations --check --dry-run --settings=config.settings.local
.venv\\Scripts\\python.exe -m pytest -q

cd ../frontend
npm run typecheck
npm run test:run
npm run build

cd ..
backend\\.venv\\Scripts\\python.exe scripts/check_documentation_consistency.py
git diff --check
```

- Django check: passed.
- Migration drift check: no changes detected.
- Full backend regression: 405 passed.
- Frontend typecheck: passed.
- Frontend regression: 51 passed.
- Frontend production build: passed.
- Documentation consistency check: passed.
- `git diff --check`: passed.

## Browser QA/UAT

Browser QA/UAT remains pending. Use the seeded local Admin, Staff, Doctor, and must-change-password accounts to complete the live checklist in the Phase 13K request: role-route access, responsive layouts at 1440/1280/1024/768, scheduling conflicts, version conflicts, protected-media failures, AI unavailable behavior, billing locks/overpayment, password lifecycle, and Not Found/Access Denied states.

No live browser result is claimed in this record.

## Accepted Limitations And Release Recommendation

Post-MVP limitations remain real AI service integration, email forgot-password, online payments, invoice itemization, tax, discounts, insurance, automatic notifications, expanded DoctorProfile/StaffProfile CRUD, multi-clinic tenancy, and full mobile-first optimization.

There are no automated regression blockers. Recommendation: proceed with controlled deployment/UAT after environment configuration; live browser UAT is the remaining release gate.

## Phase 14F.4 X-ray viewer addendum

The current Active Visit X-ray surface selects saved images inline, uses authenticated Blob URLs for original and optional overlay, and never navigates away for review. Original and overlay share one transform layer. Show/Hide AI Overlay, Zoom In, Zoom Out, Reset, Fit to View, and Fullscreen/enlarged fallback are verified controls. The dedicated side panel renders backend-provided stored result fields only and retains explicit research-only, professional-interpretation, and non-diagnostic language.
