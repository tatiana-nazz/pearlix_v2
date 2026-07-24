# Phase 14D.1 Team and Users & Access Implementation Record

This bounded Phase 14D.1 slice implements separate Admin Team and Users & Access runtime routes. It does not complete Phase 14D dashboards, appointments, or patients.

## Runtime contract

- Team routes use `/api/team-members/` for paginated directory, transactional Doctor/Staff onboarding, professional profile edits, and versioned professional status.
- Users & Access uses `/api/users/` for Admin accounts only. Direct role and activation patches are not sent.
- Password reset, deactivate/reactivate, and role transition preview/confirmation use their dedicated backend actions.
- Backend runtime changed: no. Migrations added: no.

## Routes

- Team: `/admin/team`, `/admin/team/new`, `/admin/team/:teamMemberId`.
- Users & Access: `/admin/users`, `/admin/users/new`, `/admin/users/:userId`.

## Verification

- Frontend regression: 84 passed in 34 files (baseline recorded count: 75; 9 tests added in 4 new test files; no tests deleted).
- Focused account and Team backend tests: 67 passed.
- Clean `origin/main` backend regression: 28 failed, 386 passed.
- Feature branch backend regression: 28 failed, 386 passed with the same failing node IDs and causes. The Phase 14D.1 diff contains no backend runtime, migration, test, dependency, settings, or pytest configuration change; it introduced no backend regression.
- Browser QA remains pending; see `frontend/QA_14D1_TEAM_USERS_ACCESS.md`.

The repository-wide backend stabilization backlog remains open for scheduling, availability, patient helper, audit, security, and workflow failures. Backend runtime changed: no. Migrations added: no.
