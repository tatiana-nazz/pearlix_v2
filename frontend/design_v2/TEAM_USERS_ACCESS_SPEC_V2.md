# Team and Users & Access v2

## Architecture correction

`Team` is the operational clinic directory; `Users & Access` is authentication/authorization. They are separate Admin navigation destinations. Current `/admin/users` is only an account list and current `/admin/doctors` is schedule administration; treating either as Team is a **Critical current defect**.

### Team

Admin destination: `/admin/team` and detail `/admin/team/:memberId` (new routes are Phase 14C.0+ and must not be displayed before API readiness). Tabs: All, Doctors, Staff; search by supported name/email and role filter. Rich row/card includes initials avatar, name, professional role, and only API-backed specialty (Doctor) or position (Staff), professional contact, current operational profile state, leave/unavailable indicator, and today workload/appointments where supported. Whole item opens detail, no routine View.

Detail has profile summary, General Info, Working Hours/Shifts, Leave Exceptions, Today’s Appointments/workload, and linked website account. Activity/Notes appears only if a specific backed endpoint exists; it is not currently specified. Authorized `Edit profile` is a top action after 14C.0. Schedule/leave are navigation links. Role/deactivation controls belong in linked Users & Access, never dominate professional profile.

### Users & Access

`/admin/users` remains account management. List: initials/full name, login email, role, login status (`is_active`), must-change-password, `created_at`/`updated_at`/`password_changed_at`, and explicit linked professional-profile state. Whole row opens account detail. Detail separates Account identity, Security, Role, and Linked Team profile. Actions: role change with confirmation, reset temporary password, deactivate, supported reactivation after API support, and open linked Team profile. No hard delete and no permission matrix. New User creates only account access and temporary password.

## Verified backend capability and gap

`User` is current login/role authority: `email`, `full_name`, `role`, `is_active`, preferences, `must_change_password`, `password_changed_at`, timestamps. `/api/users/` returns these fields but no `doctor_profile`/`staff_profile` linkage; it supports GET/POST/PATCH, reset password, and deactivate—no reactivation action. `DoctorProfile` model stores one-to-one `user`, `specialty`, `phone`, `bio`, `is_active`; `StaffProfile` stores one-to-one `user`, `phone`, `position`, `is_active`. Model `clean()` only validates its own role; there is no cross-profile exclusion or profile CRUD endpoint. `/api/doctors/` read-only returns Doctor profile summary (`specialty`, `phone`, `bio`, `is_active`), but no Staff equivalent and no professional detail/list endpoint. Working shifts and availability endpoints provide operational schedule/leave, not Team-profile CRUD.

Therefore **Phase 14C.0 is mandatory**. Inspiration fields: specialty (stored/returned to doctors only), position (stored but not returned via API), phone (stored; doctor only returned), biography (doctor stored/returned), gender/qualifications/license/profile photo/activity notes (unsupported: do not show). Current generic user API does not safely prove Team linkage.

## Phase 14C.0 dependency specification

1. Add Admin-only paged Team list/detail APIs and serializers exposing only stored profile fields, linkage state, supported working/leave/workload summaries, and no invented fields.
2. Add transactional create/update/link profile commands; enforce database/application constraint that a User has at most one of DoctorProfile/StaffProfile and profile role matches User; Admin has neither; reject orphan/duplicate profile states.
3. Add explicit confirmed role-transition API: report current profile/history consequences; preserve history; create/retain no invalid profile; transition Doctor↔Staff requires deliberate profile resolution, never silent deletion. Existing profile historical records remain attributable.
4. Add supported reactivation if accepted, otherwise UI must not promise it. User deactivation preserves all clinical, scheduling, billing, and audit history; login status remains distinct from professional `is_active`/availability/leave.
5. Add serializers, permission tests, migration/data-integrity tests, transition/deactivation regression tests, and frontend contract tests before Team Edit Profile is enabled.

No runtime work occurs in 14B.
