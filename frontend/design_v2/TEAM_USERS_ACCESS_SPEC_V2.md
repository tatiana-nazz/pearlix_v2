# Team and Users & Access v2

## Architecture correction

`Team` is the operational clinic directory; `Users & Access` is authentication/authorization. They are separate Admin navigation destinations. Current `/admin/users` is only an account list and current `/admin/doctors` is schedule administration; treating either as Team is a **Critical current defect**.

### Team

Admin destination: `/admin/team` and detail `/admin/team/:memberId` are contractually ready for Phase 14D runtime implementation; the API is ready but these routes are not yet exposed by the runtime router. Tabs: All, Doctors, Staff; search by supported name/email and role filter. Rich row/card includes initials avatar, name, professional role, and only API-backed specialty (Doctor) or position (Staff), professional contact, current operational profile state, leave/unavailable indicator, and today workload/appointments where supported. Whole item opens detail, no routine View.

Detail has profile summary, General Info, Working Hours/Shifts, Leave Exceptions, Today’s Appointments/workload, and linked website account. Activity/Notes appears only if a specific backed endpoint exists; it is not currently specified. Authorized `Edit profile` is a top action after 14C.0. Schedule/leave are navigation links. Role/deactivation controls belong in linked Users & Access, never dominate professional profile.

### Users & Access

`/admin/users` remains account management. List: initials/full name, login email, role, login status (`is_active`), must-change-password, `created_at`/`updated_at`/`password_changed_at`, and explicit linked professional-profile state. Whole row opens account detail. Detail separates Account identity, Security, Role, and Linked Team profile. Actions: role change with confirmation, reset temporary password, deactivate, supported reactivation after API support, and open linked Team profile. No hard delete and no permission matrix. New User creates only account access and temporary password.

## Historical pre-14C.0 backend audit and gap

`User` is current login/role authority: `email`, `full_name`, `role`, `is_active`, preferences, `must_change_password`, `password_changed_at`, timestamps. `/api/users/` returns these fields but no `doctor_profile`/`staff_profile` linkage; it supports GET/POST/PATCH, reset password, and deactivate—no reactivation action. `DoctorProfile` model stores one-to-one `user`, `specialty`, `phone`, `bio`, `is_active`; `StaffProfile` stores one-to-one `user`, `phone`, `position`, `is_active`. Model `clean()` only validates its own role; there is no cross-profile exclusion or profile CRUD endpoint. `/api/doctors/` read-only returns Doctor profile summary (`specialty`, `phone`, `bio`, `is_active`), but no Staff equivalent and no professional detail/list endpoint. Working shifts and availability endpoints provide operational schedule/leave, not Team-profile CRUD.

This pre-14C.0 audit justified the now-completed API foundation. Inspiration fields: specialty, position, phone, and Doctor biography; gender, qualifications, license, profile photo, Staff biography, and activity notes remain unsupported.

## Historical Phase 14C.0 dependency specification

1. Add Admin-only paged Team list/detail APIs and serializers exposing only stored profile fields, linkage state, supported working/leave/workload summaries, and no invented fields.
2. Add transactional create/update/link profile commands; enforce database/application constraint that a User has at most one of DoctorProfile/StaffProfile and profile role matches User; Admin has neither; reject orphan/duplicate profile states.
3. Add explicit confirmed role-transition API: report current profile/history consequences; preserve history; create/retain no invalid profile; transition Doctor↔Staff requires deliberate profile resolution, never silent deletion. Existing profile historical records remain attributable.
4. Add supported reactivation if accepted, otherwise UI must not promise it. User deactivation preserves all clinical, scheduling, billing, and audit history; login status remains distinct from professional `is_active`/availability/leave.
5. Add serializers, permission tests, migration/data-integrity tests, transition/deactivation regression tests, and frontend contract tests before Team Edit Profile is enabled.

No runtime work occurs in 14B.

## Historical Phase 14C.0 Frozen Target

## Implemented Phase 14C.0 resolution

The Team API foundation is implemented and ready; final `/admin/team` and Users & Access runtime screens remain Phase 14D. User ID is the Team member ID. `User`, `DoctorProfile`, and `StaffProfile` each carry an optimistic version where required. Generic `/api/users/` is intentionally restricted to Admin account creation; Doctor/Staff requests return `PROFILE_REQUIRED` and must use transactional Team onboarding. Generic role PATCH returns a protected-role error and callers use the signed `transition-role` preview/confirm workflow. The actual safe transition matrix is documented in `backend/project_docs/PHASE_14C0_TEAM_PROFILE_ARCHITECTURE.md`: direct operational history blocks role changes rather than deleting, detaching, or retyping records. Reactivation is implemented for inactive, profile-consistent accounts and never changes professional status.

| Endpoint | Permission | Contract |
| --- | --- | --- |
| `GET /api/team-members/` | Admin | paged `count,next,previous,results`; filters `q`, `role`, `professional_status`, `availability`, `page`; no Admin accounts. |
| `POST /api/team-members/` | Admin | one transaction creates User + exactly one matching profile, temporary password state, audit event. |
| `GET /api/team-members/{id}/` | Admin | supported profile plus account/schedule/leave/workload summaries. |
| `PATCH /api/team-members/{id}/` | Admin | professional fields only; required optimistic `version`. |
| `POST /api/team-members/{id}/set-professional-status/` | Admin | `{is_active,version,reason?}`; professional status distinct from login. |
| `POST /api/users/{id}/transition-role/` | Admin | explicit preview/confirmation; generic role PATCH rejects Doctor/Staff changes. |
| `POST /api/users/{id}/reactivate/` | Admin | implemented; current endpoint requires no request payload and returns the user summary. It rejects already-active or profile-inconsistent accounts. |

List summary is `{id,role,full_name,professional_status,specialty?,position?,phone?,account:{id,email,is_active,must_change_password,created_at,updated_at},availability:{on_leave,next_exception},today_workload:{appointment_count,active_visit_count},version}`. Doctor detail permits `specialty`, `phone`, `bio`, `is_active`; Staff permits `position`, `phone`, `is_active`; both include linked account, shifts, leave, bounded workload, timestamps/version. Gender, qualification, license, photo, activity note, and Staff biography are explicitly unsupported.

Create payload is `{account:{full_name,email,temporary_password},role:"DOCTOR",doctor_profile:{specialty,phone,bio}}`, or Staff with `staff_profile:{position,phone}`. Reject both/missing profile, Admin role, unknown fields, duplicate email/profile. Update payload is `{version,specialty?,phone?,bio?}` or `{version,position?,phone?}`. Stale updates return `VERSION_CONFLICT` plus latest-safe summary.

Transition preview is `{target_role,mode:"PREVIEW"}` and returns profile/history consequence plus required profile shape; confirmation is `{target_role,mode:"CONFIRM",confirmation_token,profile?,version}`. Errors: `PROFILE_REQUIRED`, `PROFILE_ROLE_MISMATCH`, `PROFILE_ALREADY_LINKED`, `ROLE_TRANSITION_CONFIRMATION_REQUIRED`, `VERSION_CONFLICT`, `LAST_ACTIVE_ADMIN`, `SELF_DEACTIVATION_FORBIDDEN`, `TEAM_MEMBER_NOT_FOUND`. Audit events: `team_member_created`, `team_member_updated`, `professional_status_changed`, `user_role_transitioned`, `user_reactivated`, excluding password/secrets.

Normal Add Team Member is transactional: website User, exactly one DoctorProfile/StaffProfile, temporary-password state, and initial professional profile all commit or roll back. An active Doctor/Staff account cannot remain without a profile. Legacy unlinked Doctor/Staff accounts appear in Users & Access as **Profile setup required**, never completed Team members. Admin accounts remain account-only. Admin→Doctor/Staff requires profile creation. Doctor/Staff→Admin preserves historical profile data but deactivates operational profile after confirmation. Doctor↔Staff never silently mutates a profile type; explicit resolution/new matching profile preserves history. Account deactivation preserves history; login, professional, shift availability, and leave statuses remain separate.
