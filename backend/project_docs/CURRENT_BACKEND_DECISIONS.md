# Current Backend Decisions

**Authority marker:** `CURRENT_CANONICAL_BACKEND_DECISIONS`
Read [`../../CODEX_START_HERE.md`](../../CODEX_START_HERE.md) first. This is the current backend/role summary; affected models, serializers, views, endpoints, permissions, and tests remain the runtime authority for a change. Authority cleanup is documentation governance only. The current UI continues from `e54a85842f1c683b27f12e0da93987ae128c861d`; `preview-pre-v2-ui` / `bdd5f6f` are rejected historical references, never restoration targets. Team and Users & Access remain distinct.

Project: Dental Clinic Management System Website
Backend: Django + Django REST Framework + PostgreSQL
API base path: `/api/`

This document summarizes current accepted backend decisions for human developers. Phase-12 handoff material is historical evidence only and cannot override the root authority chain.

## Password Lifecycle

- No public signup.
- Admin creates user accounts.
- Admin gives a temporary password.
- User must change password on first login.
- Admin can reset forgotten passwords.
- Email forgot-password is post-MVP.
- `must_change_password` and `password_changed_at` are implemented.
- Authenticated users can change their password.
- Admin can reset a user's password to a temporary password.
- Password validators are enforced for password changes and resets.
- Audit logs are written for password changes and Admin password resets.

## Admin Account Safety

- Admin cannot deactivate self.
- Admin cannot deactivate the last active `ADMIN`.
- Tests cover both protections.

## Team Profiles and Account Linkage (Phase 14C.0)

- Team is a professional directory; Users & Access remains login/role administration.
- `User.id` is the Team member identifier. A Doctor/Staff has one matching profile; an Admin has no active professional profile.
- New Doctor/Staff accounts must use transactional `POST /api/team-members/`; generic `/api/users/` creates Admin accounts only.
- Generic role PATCH is protected. `POST /api/users/{id}/transition-role/` uses a signed, expiring preview/confirm token and User version.
- Role transitions with direct shifts, leave, appointments, or visits are blocked with `ROLE_TRANSITION_BLOCKED_BY_HISTORY`; no operational history is deleted or rewritten.
- Profile versions protect professional edits and professional-status changes. Login deactivation/reactivation and professional active state remain separate.
- Users report a safe linked-profile state. Legacy unlinked professional accounts are `PROFILE_SETUP_REQUIRED`, visible in Users & Access but excluded from Team.
- `manage.py check_profile_integrity --strict` detects dual profiles, mismatches, and active Admin professional profiles without changing data.

## Rate Limiting

- No broad rate limiting for normal clinic workflows now.
- Later, targeted throttling may be added for login, password reset, upload, or AI endpoints if abuse risk requires it.

## Doctor Patient Access

- All active Doctors can read all active/non-archived patient profiles.
- All active Doctors can update allowed patient profile fields.
- All active Doctors can read the full clinical history for all active/non-archived patients.
- Full clinical profile/history includes patient profile, medical summary, visit history, past clinical notes, saved X-rays, and saved AI results.
- Doctor can only edit their own visit notes.
- Doctor cannot edit another Doctor's clinical notes.
- Doctor cannot start or complete another Doctor's appointment/visit.
- Doctor cannot archive or unarchive patients.
- Doctor cannot access invoices, payments, or global billing.
- Doctor can create billing handoff for their own completed visit with suggested amount, currency, and note.
- Staff handles invoice creation and payment recording from the handoff.
- Staff can archive/unarchive patients.
- Admin remains read-only for patient records.
- Doctor default patient list shows active/non-archived patients.
- Doctor workflow filters can narrow to "my patients", upcoming appointments with the requesting Doctor, or last visit with the requesting Doctor; these are workflow helpers, not access restrictions.

## Patient Archive

- Patients are not hard-deleted.
- Staff can archive and unarchive patients.
- Patient profile updates, archive, and unarchive use optimistic locking with a required `version`.
- Missing update/archive/unarchive version returns `VERSION_REQUIRED`; stale version returns `VERSION_CONFLICT` with submitted and current versions.
- Doctor cannot archive or unarchive.
- Admin is read-only.
- Archived patients are hidden from default lists.
- Patients with `UPCOMING`, `CHECKED_IN`, `ACTIVE`, or `NEEDS_RESCHEDULE` appointments should not be archived unless the workflow explicitly handles that state.

## Patient Schema and API Contract

- Phase 13E.1 finalizes patient identity as `first_name`, `last_name`, computed read-only `full_name`, and `gender` limited to `Male` or `Female`.
- Optional profile fields are `date_of_birth`, computed `age`, `phone_number`, `email`, `national_id_or_passport`, `address`, `emergency_contact`, `blood_group`, `medical_conditions_history`, `insurance_info`, and `general_notes`.
- `national_id_or_passport` is unique only when supplied; blank values are normalized to `null`, so multiple patients may omit it.
- `blood_group` choices are `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, and `O-`.
- `is_archived`, `version`, audit users, and timestamps are backend-controlled.
- Create requires `first_name`, `last_name`, and `gender`; create rejects `full_name`, `is_archived`, `version`, audit fields, and timestamps.
- Updates require `version`; legacy records with blank `last_name` must be corrected by supplying a last name before a profile update can succeed.
- Direct `PATCH is_archived` is rejected. Use `POST /api/patients/{id}/archive/` or `/unarchive/` with `{ "version": <currentVersion> }`.
- Canonical patient filters are `first_name`, `last_name`, `phone_number`, `email`, `national_id_or_passport`, and `search`; legacy `name` and `phone` aliases remain for compatibility.

## Clinic Settings Visibility

- Admin sees full clinic settings.
- Staff and Doctor see safe clinic settings only.
- Safe fields include clinic name, timezone, appointment durations, capacity, and currencies.
- Internal or technical fields such as `ai_mode` and `ai_service_url` are Admin-only.

## AI Mode

- MVP supports `MOCK_ADAPTER` only.
- If `ai_mode` is `DJANGO_INTERNAL` or `SEPARATE_SERVICE`, AI run should return `AI_SERVICE_NOT_CONFIGURED` until real AI exists.
- Do not silently run mock analysis when settings claim a real or separate AI mode.
- Real AI should replace the adapter later without changing API contracts.

## Invoice and Handoff Immutability

When `invoice.billing_handoff` exists:

- Patient, visit, appointment, and billing handoff cannot change.
- `total_amount` can change before payment.
- `notes` can change before payment.
- Currency cannot change after payment.

After any payment exists:

- `total_amount` is locked.
- Currency is locked.
- Patient, visit, appointment, and handoff are locked.
- Status remains backend-controlled.

## Doctor Leave and Reschedule

- Creating doctor leave or unavailable exception must be allowed.
- Existing appointments do not block leave creation.
- Future overlapping doctor appointments should become `NEEDS_RESCHEDULE`.
- Staff reschedules affected appointments.
- Add appointment status `NEEDS_RESCHEDULE`.
- Rescheduling validates working hours, unavailable exceptions, doctor conflict, and capacity.
- Leave is cancelled/voided, not hard-deleted.
- Cancelling doctor leave restores only appointments still `NEEDS_RESCHEDULE` from that leave when the original slot is still valid.
- Already-rescheduled appointments are not moved back.
- Cancelled leave no longer blocks scheduling.
- Staff leave is visibility-only and cancellation does not affect appointments.
- No automatic notifications are sent in the MVP.

## Shift and Availability Administration

- Phase 13F.1 uses `ClinicDefaultShift` templates and independent `WorkingShift` employee records. Weekday `0` is Monday.
- Admin alone creates, edits, activates, deactivates, applies, and copies shifts, and manages availability exceptions.
- Active shifts may be split or adjacent but cannot overlap. Shifts and leave are deactivated/cancelled, never hard-deleted.
- Clinic defaults never auto-propagate. `MISSING_ONLY` adds compatible default/source shifts; `REPLACE_ALL` deactivates active target shifts and creates independent replacements.
- Doctor schedule reductions, moves, replacements, or deactivations first return `SHIFT_CHANGE_REQUIRES_CONFIRMATION` when future appointments are invalidated. Confirmation marks only affected future `UPCOMING` and `CHECKED_IN` appointments as `NEEDS_RESCHEDULE` with a `SHIFT_CHANGE` source.
- Staff shifts never affect appointment availability. Appointment availability uses active Doctor `WorkingShift` records and keeps `GET /api/doctors/{id}/working-hours/` as a read-compatible Doctor schedule route.
- Default shifts, working shifts, and availability exception update/cancel actions use `version`; missing versions return `VERSION_REQUIRED`, stale versions return `VERSION_CONFLICT`.

## External X-ray Attach

- Active Doctors can attach their own temporary external X-ray cases to any active/non-archived patient.
- A prior appointment or visit relationship is not required for patient-profile attachment.
- Visit linking is stricter: the visit must belong to the selected patient and to the requesting Doctor.
- Staff external X-ray workspace access remains denied.
- Admin can manage readable temporary external cases but cannot attach them to patients; attach-to-patient is limited to the owning Doctor.

## Invoice Numbers

- Invoice numbers use a database-backed `InvoiceSequence` row with transaction locking.
- Count-based invoice number generation is not used.
- Current format remains `INV-YYYYMMDD-000001`.

## Forgot Password

- MVP uses Admin reset.
- Staff or Doctor asks Admin to reset a temporary password.
- Admin asks another Admin to reset it.
- If no other Admin exists, server operator uses a management command.
- Email forgot-password is post-MVP and requires SMTP/email provider, secure single-use expiring tokens, generic responses, and audit logs.

## Packaging Hygiene

- Exclude `.env`, `.venv`, `media`, `test_media`, `__pycache__`, and `.pytest_cache` before GitHub upload or handoff packaging.
- Do not commit real secrets.

## Completed Phase Order And Next Step

- Phase 13F.1 is complete. The accepted shift and availability rules are implemented through `ClinicDefaultShift`, `WorkingShift`, versioned leave operations, and explicit Doctor appointment-impact confirmation.
- Phase 13G is complete: it integrates the existing active-visit, clinical-note, completion, and read-only visit-history contract in the frontend without a backend behavior change.
- Phase 13H is complete: the frontend uses authenticated Blob/object-URL media presentation, preserves returned AI disclaimers, and implements the existing Admin/Doctor external-X-ray contract without backend runtime changes. Browser QA remains pending.
- Phase 13I is complete: billing UI uses the existing role and invoice-lock contract, preserves backend financial authority, and adds no backend runtime changes.
- Phase 13I verification recorded 405 backend tests and 49 frontend tests passing; migrations were unchanged and browser QA remains pending.
- Phase 13J is complete: Admin uses existing user APIs for account creation, updates, temporary-password reset, and eligible deactivation. Self-deactivation and last-active-Admin protection remain backend-enforced. Full clinic settings are Admin-only; Staff and Doctor receive safe settings only. Audit logs are Admin-only and read-only. There is no public signup, email forgot-password, user hard delete, or permission matrix.
- Phase 13K is complete: final automated regression, route/navigation cleanup, accessibility polish, and documentation consistency validation required no backend runtime or migration changes. The Phase 13 series is complete.
- Phase 14A is complete: a development-only, reset-safe integrated demo clinic story seeds coherent scheduling, visits, X-rays/AI, external cases, billing, audit, and dashboard data. Phase 14B design freeze, Phase 14C.0 Team/account-linkage foundation, Phase 14C shell, and Phase 14D.1 Team and Users & Access runtime routes are complete; deployment remains paused.
- Phase 14R closed the backend regression gate with 418 passing tests. Scheduling now evaluates capacity by interval overlap, serializes booking validation with the clinic settings lock, respects the validated clinic IANA timezone, suppresses past same-day availability, and applies available overrides while unavailable exceptions take precedence. No migration or external API contract change was required.
