# Domain Model and Database — Detailed

This file defines the required models and relationships. Codex should not invent extra models unless needed for implementation and documented in final report.

---

## 1. Shared Model Mixins

Most models should include:

```text
id
created_at
updated_at
```

User-owned mutable records should also include:

```text
created_by nullable FK User
updated_by nullable FK User
```

Use timezone-aware datetimes.

---

## 2. User

Use a custom user model from the beginning.

Fields:

```text
id
email unique
full_name
role: ADMIN / STAFF / DOCTOR
is_active
is_staff for Django admin use if needed
is_superuser for Django admin use if needed
theme_preference: LIGHT / DARK / SYSTEM
language_preference: EN / AR
created_at
updated_at
```

Rules:

- email is login identifier
- role is backend authority
- inactive users cannot log in

---

## 3. DoctorProfile

Fields:

```text
id
user one-to-one User
specialty optional
phone optional
bio optional
is_active
created_at
updated_at
```

Rules:

- only users with role DOCTOR should have DoctorProfile

---

## 4. StaffProfile

Fields:

```text
id
user one-to-one User
phone optional
position optional
is_active
created_at
updated_at
```

Rules:

- only users with role STAFF should have StaffProfile

---

## 5. ClinicSettings

One-row model.

Fields:

```text
id
clinic_name default "Pearl Dental Clinic"
address default "Damascus, Syria"
phone optional
email optional
timezone default "Asia/Damascus"
capacity_per_slot positive integer default 3
default_appointment_duration_minutes default 30
allowed_durations_minutes list/json default [15,30,45,60]
default_currency: SYP / USD default SYP
supported_currencies list/json default ["SYP", "USD"]
default_language: EN / AR default EN
ai_mode: DJANGO_INTERNAL / SEPARATE_SERVICE / MOCK_ADAPTER
ai_service_url optional
created_at
updated_at
```

Validation:

- capacity_per_slot >= 1
- default_appointment_duration_minutes in allowed_durations_minutes
- allowed durations are limited to 15, 30, 45, 60 for MVP
- supported currencies SYP/USD only

---

## 6. Patient

Fields:

```text
id
full_name
phone
gender: MALE / FEMALE / OTHER / UNKNOWN
birth_date nullable
address optional
medical_summary optional
general_notes optional
is_archived default false
created_by FK User nullable
updated_by FK User nullable
created_at
updated_at
```

Derived response fields:

```text
age
last_visit_at
next_appointment_at
```

Indexes:

```text
phone
full_name
is_archived
```

Rules:

- Staff can create.
- Staff and Doctor can update.
- Admin read-only.
- Search prioritizes phone then name.

---

## 7. WorkingHour

Fields:

```text
id
doctor FK DoctorProfile nullable
staff FK StaffProfile nullable
weekday: MONDAY...SUNDAY
start_time
end_time
is_active default true
created_at
updated_at
```

Validation:

- exactly one of doctor/staff is set
- start_time < end_time

MVP priority: doctor working hours.

---

## 8. AvailabilityException

Fields:

```text
id
doctor FK DoctorProfile nullable
staff FK StaffProfile nullable
start_datetime
end_datetime
type: UNAVAILABLE / AVAILABLE_OVERRIDE
reason optional
created_at
updated_at
```

Validation:

- start_datetime < end_datetime
- exactly one of doctor/staff is set

MVP priority: UNAVAILABLE.

---

## 9. Appointment

Fields:

```text
id
patient FK Patient
doctor FK DoctorProfile
start_datetime
end_datetime
duration_minutes
reason optional
notes optional
status: UPCOMING / CHECKED_IN / ACTIVE / COMPLETED / CANCELLED / NO_SHOW
checked_in_at nullable
cancelled_at nullable
no_show_at nullable
created_by FK User nullable
updated_by FK User nullable
created_at
updated_at
```

Indexes:

```text
doctor + start_datetime
start_datetime + status
patient + start_datetime
status
```

Business rules:

- staff only create/edit/cancel/check-in/no-show
- admin read-only
- doctor own appointments read-only except Start Visit action
- capacity counted by exact start_datetime
- doctor overlapping appointments are rejected
- appointment must fit working hours
- appointment must not overlap unavailable exception

---

## 10. Visit

Fields:

```text
id
appointment one-to-one Appointment
patient FK Patient
doctor FK DoctorProfile
status: ACTIVE / COMPLETED
started_at
completed_at nullable
symptoms text optional
diagnosis text optional
treatment text optional
follow_up_notes text optional
created_by FK User nullable
updated_by FK User nullable
created_at
updated_at
```

Rules:

- starts only from CHECKED_IN appointment
- only assigned doctor starts
- one ACTIVE visit per doctor
- completion sets appointment COMPLETED
- doctor can edit completed notes forever
- staff/admin read-only

---

## 11. Saved XrayAttachment

Represents X-rays saved to patient profile and optionally visit.

Fields:

```text
id
patient FK Patient
visit FK Visit nullable
uploaded_by FK User
title optional
original_file
file_name metadata
file_type metadata png/jpg/jpeg
file_size integer
source: ACTIVE_VISIT / PATIENT_PROFILE / EXTERNAL_WORKSPACE
created_at
updated_at
```

Rules:

- Doctor can upload/manage.
- Staff/Admin read-only.
- File access protected by backend endpoint.

---

## 12. ExternalXrayCase

Temporary X-ray uploaded through external dashboard tab.

Fields:

```text
id
uploaded_by FK User
title optional
original_file
file_name metadata
file_type metadata png/jpg/jpeg
file_size integer
status: TEMPORARY / ATTACHED_TO_PATIENT / DISCARDED
attached_patient FK Patient nullable
attached_xray_attachment FK XrayAttachment nullable
created_at
updated_at
```

Rules:

- Admin and Doctor can create temporary cases.
- Staff cannot access.
- Admin can run AI/view/discard but cannot attach.
- Doctor can run AI/view/discard/attach.
- Attached cases create or link to XrayAttachment.

---

## 13. AIResult

AI result can belong to either saved XrayAttachment or ExternalXrayCase.

Fields:

```text
id
xray_attachment FK XrayAttachment nullable
external_xray_case FK ExternalXrayCase nullable
status: PENDING / PROCESSING / COMPLETED / FAILED
result_summary
overall_confidence decimal nullable
findings_json json list
overlay_file nullable png
model_version optional
error_message optional
created_at
updated_at
```

Validation:

- exactly one of xray_attachment or external_xray_case is set
- overlay_file must be png if present
- findings_json items follow normalized structure

Normalized finding:

```json
{
  "fdi_tooth_id": "36",
  "disease_label": "Caries",
  "disease_label_ar": "تسوس",
  "confidence_score": 0.82,
  "confidence_percent": 82
}
```

---

## 14. BillingHandoff

Fields:

```text
id
visit FK Visit
patient FK Patient
doctor FK DoctorProfile
created_by FK User
note optional
suggested_amount decimal nullable
suggested_currency SYP/USD nullable
status: PENDING / CONVERTED_TO_INVOICE / DISMISSED
converted_invoice FK Invoice nullable
dismissed_reason optional
created_at
updated_at
```

Rules:

- doctor creates for own/relevant visit
- staff converts/dismisses
- admin read-only
- cannot convert twice

---

## 15. Invoice

Fields:

```text
id
invoice_number unique
patient FK Patient
visit FK Visit nullable
appointment FK Appointment nullable
billing_handoff FK BillingHandoff nullable
created_by FK User
total_amount decimal
currency: SYP / USD
notes optional
status: UNPAID / PARTIALLY_PAID / PAID / CANCELLED
cancelled_at nullable
cancelled_reason optional
created_at
updated_at
```

Rules:

- staff only creates/edits/cancels
- admin read-only
- doctor no access to invoice management
- no itemized invoice rows in MVP
- backend calculates paid/remaining/status
- do not allow currency change after payments exist

---

## 16. Payment

Fields:

```text
id
invoice FK Invoice
amount decimal
currency: SYP / USD
payment_date datetime
notes optional
created_by FK User
created_at
updated_at
```

Rules:

- staff only records payment
- amount > 0
- payment currency equals invoice currency
- no overpayment in MVP
- cannot pay cancelled invoice

---

## 17. ActivityLog

Fields:

```text
id
actor FK User nullable
role snapshot optional
action string
entity_type string
entity_id string/int
metadata_json json optional
ip_address optional
user_agent optional
created_at
```

Important logged actions:

- user_created
- user_deactivated
- settings_updated
- patient_created
- patient_updated
- appointment_created
- appointment_checked_in
- appointment_cancelled
- appointment_no_show
- visit_started
- clinical_notes_updated
- visit_completed
- xray_uploaded
- external_xray_uploaded
- external_xray_discarded
- external_xray_attached_to_patient
- ai_run_started
- ai_run_completed
- ai_run_failed
- billing_handoff_created
- billing_handoff_converted
- billing_handoff_dismissed
- invoice_created
- invoice_updated
- invoice_cancelled
- payment_recorded
- permission_denied
