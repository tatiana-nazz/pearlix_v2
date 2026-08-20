# Phase 14C.0 Team Profile Architecture

## Boundary and identifiers

`User.id` is the stable Team member identifier. A User remains the login, role, password, preference, and login-active authority. `DoctorProfile` and `StaffProfile` are the professional records; their `is_active` is independent from `User.is_active`.

`GET`/`POST /api/team-members/`, `GET`/`PATCH /api/team-members/{id}/`, and `POST /api/team-members/{id}/set-professional-status/` are Admin-only. List results are paged and support `q`, `role`, `professional_status`, `availability`, and `page`. They exclude Admins and legacy unlinked professional accounts. Detail returns only stored professional fields, linked account summary, active shifts, current/future leave, and bounded same-day Doctor workload.

## Integrity enforcement

The current two-table profile layout cannot express cross-table exclusivity in a database constraint. The implementation therefore uses atomic, row-locked service operations plus model validation and `manage.py check_profile_integrity --strict --settings=config.settings.local`.

- Team onboarding creates User and exactly one matching profile in one transaction.
- Generic `/api/users/` creates Admin accounts only; Doctor/Staff onboarding is rejected with `PROFILE_REQUIRED` and must use Team.
- Generic role PATCH is rejected; `transition-role` is the sole role-change path.
- Users list/detail expose `NONE`, `DOCTOR`, `STAFF`, `PROFILE_SETUP_REQUIRED`, or diagnostic `INCONSISTENT`; a valid linked profile also exposes `team_member_id`.
- Profile updates/status changes use profile versions. User versions bind transition previews, confirmations, and reactivation state.

## Role transition matrix

| Source → target | Supported when | Result |
| --- | --- | --- |
| Admin → Doctor/Staff | another active Admin remains; valid confirmation | create/re-activate matching profile atomically |
| Doctor/Staff → Admin | no direct scheduling/clinical history; valid confirmation | retain but professionally deactivate matching profile |
| Doctor ↔ Staff | no direct operational history and no opposite profile exists | create matching target profile; no profile replacement/deletion |
| Any role → same role | no | preview reports no role change |
| Any operational role with shifts, leave, appointments, or visits → another role | no | `ROLE_TRANSITION_BLOCKED_BY_HISTORY` with counts |

The confirmation token is Django-signed, expires after ten minutes, and is bound to User ID, source/target role, user version, and linkage state. Self role changes and a last-active-Admin transition are blocked. No schedule, appointment, visit, or profile history is deleted, detached, or rewritten.

## Account actions and audit

Reactivation is Admin-only and rejects active or inconsistent professional accounts. It changes login activity only; it does not reactivate a professional profile. Audit events are `team_member_created`, `team_member_updated`, `professional_status_changed`, `user_role_transitioned`, and `user_reactivated`; metadata excludes passwords, confirmation tokens, and secrets.

Runtime Team/User interface work, Lucide, shell/token work, and visual redesign are intentionally not part of this phase.

## Closure record

Phase 14C.0 is complete. Focused Team/account-linkage tests recorded 40 passed; full backend regression recorded 414 passed; frontend contract regression recorded 52 passed. Migration `accounts.0005_doctorprofile_version_staffprofile_version_and_more` is applied. Deployment and browser QA remain paused/pending; Phase 14C is next.
