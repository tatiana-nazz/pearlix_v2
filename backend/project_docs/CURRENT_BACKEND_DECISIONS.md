# Current Backend Decisions

Project: Dental Clinic Management System Website
Backend: Django + Django REST Framework + PostgreSQL
API base path: `/api/`

This document summarizes the current accepted backend decisions for human developers. The detailed correction source of truth is `_codex_backend_handoff/25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH.md`.

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
- Doctor cannot archive or unarchive.
- Admin is read-only.
- Archived patients are hidden from default lists.
- Patients with `UPCOMING`, `CHECKED_IN`, `ACTIVE`, or `NEEDS_RESCHEDULE` appointments should not be archived unless the workflow explicitly handles that state.

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

## External X-ray Attach

- Active Doctors can attach their own temporary external X-ray cases to any active/non-archived patient.
- A prior appointment or visit relationship is not required for patient-profile attachment.
- Visit linking is stricter: the visit must belong to the selected patient and to the requesting Doctor.
- Staff external X-ray workspace access remains denied.
- Admin external workspace behavior is unchanged.

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
