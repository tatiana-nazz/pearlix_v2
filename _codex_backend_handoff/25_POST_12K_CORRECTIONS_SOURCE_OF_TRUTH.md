# HISTORICAL / SUPERSEDED — NOT CURRENT IMPLEMENTATION AUTHORITY

Replacement: [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md). Authority register: [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). Useful as Phase 12 historical evidence only.

# Post-12K Corrections Source of Truth

Project: Dental Clinic Management System Website
Backend: Django + Django REST Framework + PostgreSQL
API base path: `/api/`

This file records accepted decisions made after Phase 12K. Future backend phases must read this file. If older handoff files conflict with this file, this file wins.

---

## 1. Password Lifecycle

Accepted MVP decision implemented in backend:

- There is no public signup.
- Admin creates accounts.
- Admin gives the user a temporary password.
- User must change password on first login.
- Admin can reset forgotten passwords.
- Email forgot-password is post-MVP only.

Implemented requirements:

- `must_change_password` is stored on users.
- `password_changed_at` is stored on users.
- Authenticated users can change their password.
- Admin can reset a user's password to a temporary password.
- Password validators are enforced for password changes and resets.
- Audit logs are written for password change and password reset events.

---

## 2. Admin Account Safety

Accepted MVP decision implemented in backend:

- Admin cannot deactivate self.
- Admin cannot deactivate the last active `ADMIN`.
- Add tests for both rules.

---

## 3. Rate Limiting

Accepted MVP decision:

- Do not add broad rate limiting for normal clinic workflows now.
- Later, add only targeted throttling for public or abuse-prone endpoints if needed.

Potential future throttling targets:

- Login.
- Password reset.
- Upload endpoints.
- AI run endpoints.

---

## 4. Doctor Patient Access

Accepted MVP decision:

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

Doctor patient list workflow:

- Doctor default patient list shows active/non-archived patients.
- Doctor can filter "my patients" based on any appointment or visit with that Doctor.
- Doctor can filter patients with upcoming appointments for the requesting Doctor.
- Doctor can filter/sort by last visit with the requesting Doctor where practical.
- These filters are workflow helpers only, not access restrictions.

---

## 5. Patient Archive

Accepted MVP decision:

- No hard delete for patients.
- Staff can archive and unarchive patients.
- Doctor cannot archive or unarchive patients.
- Admin is read-only for patient records.
- Archived patients are hidden from the default patient list.
- Do not archive a patient with `UPCOMING`, `CHECKED_IN`, `ACTIVE`, or `NEEDS_RESCHEDULE` appointments unless that workflow is explicitly handled.

---

## 6. Clinic Settings Visibility

Accepted MVP decision:

- Admin sees full clinic settings.
- Staff and Doctor see safe clinic settings only.
- Safe fields include clinic name, timezone, appointment durations, capacity, and currencies.
- Internal or technical fields such as `ai_mode` and `ai_service_url` are Admin-only.

---

## 7. AI Mode

Accepted MVP decision:

- MVP supports `MOCK_ADAPTER` only.
- If `ai_mode` is `DJANGO_INTERNAL` or `SEPARATE_SERVICE`, AI run should return `AI_SERVICE_NOT_CONFIGURED` until real AI exists.
- Do not silently run mock analysis when settings claim a real or separate AI mode.
- Real AI later should replace the adapter without changing API contracts.

---

## 8. Invoice and Handoff Immutability

Accepted MVP decision when `invoice.billing_handoff` exists:

- Patient cannot change.
- Visit cannot change.
- Appointment cannot change.
- Billing handoff cannot change.
- `total_amount` can change before any payment.
- `notes` can change before payment.
- Currency cannot change after payment.

Accepted MVP decision after any payment exists:

- `total_amount` is locked.
- Currency is locked.
- Patient, visit, appointment, and handoff are locked.
- Status remains backend-controlled.

---

## 9. Doctor Leave and Reschedule

Accepted MVP decision:

- Creating doctor leave or unavailable exception must be allowed.
- Do not prevent leave because appointments exist.
- Future overlapping doctor appointments should be marked `NEEDS_RESCHEDULE`.
- Reception or Staff reschedules those appointments.
- Add appointment status `NEEDS_RESCHEDULE`.
- Rescheduling validates working hours, unavailable exceptions, doctor conflict, and capacity.
- Leave is cancelled/voided, not hard-deleted.
- Cancelling doctor leave restores only appointments still `NEEDS_RESCHEDULE` from that leave when the original slot remains valid.
- Already-rescheduled appointments are not moved back.
- Cancelled leave no longer blocks scheduling.
- Staff leave is stored for visibility only and does not affect appointments.
- No automatic notifications are sent in the MVP.

## 10. External X-ray Attach

Accepted MVP decision:

- Active Doctors can attach their own temporary external X-ray cases to any active/non-archived patient.
- A prior appointment or visit relationship is not required for patient-profile attachment.
- If a visit is linked, it must belong to the selected patient and the requesting Doctor.
- Doctors cannot attach another user's temporary external case.
- Staff external workspace access remains denied.
- Admin external workspace behavior is unchanged.

## 11. Invoice Number Sequence

Accepted MVP decision:

- Invoice numbers use a database-backed sequence/counter with transaction locking.
- Count-based invoice number generation is not used.
- Current invoice number format is `INV-YYYYMMDD-000001`.

---

## 12. Forgot Password

Accepted MVP decision:

- MVP uses Admin reset.
- Staff or Doctor forgot password: Admin resets temporary password.
- Admin forgot password: another Admin resets it.
- If no other Admin exists, server operator uses a management command.
- Email forgot-password is post-MVP.

Post-MVP email forgot-password requirements:

- Real SMTP or email provider.
- Secure single-use expiring tokens.
- Generic responses.
- Audit logging.

---

## 13. Packaging Hygiene

Accepted MVP decision:

- Before GitHub upload or handoff packaging, exclude `.env`, `.venv`, `media`, `test_media`, `__pycache__`, and `.pytest_cache`.
- No real secrets in committed files.
