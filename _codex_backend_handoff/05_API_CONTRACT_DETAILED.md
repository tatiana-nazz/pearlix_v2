# API Contract — Detailed

API base path is `/api/`.

Do not use `/api/v1/`.

Use `snake_case` fields in API.

---

## 1. API Conventions

### Content Types

JSON:

```http
Content-Type: application/json
Accept: application/json
```

Upload:

```http
Content-Type: multipart/form-data
```

### Pagination Shape

```json
{
  "count": 100,
  "next": "/api/patients/?page=2",
  "previous": null,
  "results": []
}
```

### Standard Error Shape

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Some fields are invalid.",
  "details": {
    "field": ["Reason"]
  }
}
```

---

## 2. Auth / Me

```http
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/
GET  /api/me/
PATCH /api/me/preferences/
```

Login response includes user role and preferences.

Preferences:

```json
{
  "theme_preference": "DARK",
  "language_preference": "AR"
}
```

Valid values:

```text
theme_preference: LIGHT / DARK / SYSTEM
language_preference: EN / AR
```

---

## 3. Users

```http
GET    /api/users/
POST   /api/users/
GET    /api/users/{id}/
PATCH  /api/users/{id}/
POST   /api/users/{id}/deactivate/
```

Admin only.

---

## 4. Clinic Settings

```http
GET   /api/clinic/settings/
PATCH /api/clinic/settings/
```

PATCH admin only.

Response includes:

```json
{
  "clinic_name": "Pearl Dental Clinic",
  "timezone": "Asia/Damascus",
  "capacity_per_slot": 3,
  "default_appointment_duration_minutes": 30,
  "allowed_durations_minutes": [15, 30, 45, 60],
  "default_currency": "SYP",
  "supported_currencies": ["SYP", "USD"],
  "default_language": "EN",
  "ai_mode": "MOCK_ADAPTER"
}
```

---

## 5. Patients

```http
GET    /api/patients/
POST   /api/patients/
GET    /api/patients/{id}/
PATCH  /api/patients/{id}/
GET    /api/patients/{id}/appointments/
GET    /api/patients/{id}/visits/
GET    /api/patients/{id}/xrays/
GET    /api/patients/{id}/ai-results/
GET    /api/patients/{id}/invoices/
```

Permissions:

- Admin read-only.
- Staff create/edit/read.
- Doctor read/edit.

Search:

```http
GET /api/patients/?search=0933
GET /api/patients/?phone=0933
GET /api/patients/?name=ahmad
```

Phone-first behavior should be implemented in search logic where possible.

---

## 6. Appointments

```http
GET    /api/appointments/
POST   /api/appointments/
GET    /api/appointments/{id}/
PATCH  /api/appointments/{id}/
POST   /api/appointments/{id}/check-in/
POST   /api/appointments/{id}/cancel/
POST   /api/appointments/{id}/no-show/
GET    /api/appointments/availability/
```

Permissions:

- Admin read-only.
- Staff create/edit/status transitions.
- Doctor own read-only.

Create request:

```json
{
  "patient_id": 12,
  "doctor_id": 5,
  "start_datetime": "2026-07-08T10:00:00+03:00",
  "duration_minutes": 30,
  "reason": "Tooth pain",
  "notes": "Pain in lower left molar."
}
```

Availability response:

```json
{
  "doctor_available": true,
  "doctor_conflict": false,
  "inside_working_hours": true,
  "clinic_capacity": {
    "capacity": 3,
    "current_count": 2,
    "available_slots": 1,
    "is_full": false
  },
  "can_book": true,
  "messages": ["This appointment can be booked."]
}
```

Final POST/PATCH must re-check all availability rules.

---

## 7. Schedules / Availability

```http
GET /api/doctors/
GET /api/doctors/{id}/working-hours/
PUT /api/doctors/{id}/working-hours/
GET /api/availability-exceptions/
POST /api/availability-exceptions/
GET /api/availability-exceptions/{id}/
PATCH /api/availability-exceptions/{id}/
DELETE /api/availability-exceptions/{id}/
```

Permissions:

- working-hours GET: Admin, Staff, Doctor own/relevant.
- working-hours PUT: Admin only.
- exceptions write: Admin only.

---

## 8. Visits / Clinical Notes

```http
GET   /api/visits/
GET   /api/visits/{id}/
GET   /api/visits/active/
POST  /api/appointments/{id}/start-visit/
PATCH /api/visits/{id}/clinical-notes/
POST  /api/visits/{id}/complete/
POST  /api/visits/{id}/billing-handoff/
```

Permissions:

- Admin read-only.
- Staff read-only.
- Doctor starts/completes/edits notes for own/relevant visits.

Clinical notes update:

```json
{
  "symptoms": "Pain in lower left molar for three days.",
  "diagnosis": "Suspected caries on tooth 36.",
  "treatment": "Clinical examination and X-ray review.",
  "follow_up_notes": "Recommend restoration plan after X-ray confirmation."
}
```

---

## 9. Saved Patient/Visit X-rays

```http
GET  /api/xrays/
GET  /api/xrays/{id}/
GET  /api/xrays/{id}/file/
GET  /api/xrays/{id}/ai-overlay/
POST /api/visits/{visit_id}/xrays/
POST /api/patients/{patient_id}/xrays/
POST /api/xrays/{id}/run-ai/
GET  /api/xrays/{id}/ai-result/
```

Permissions:

- Admin read-only.
- Staff read-only inside patient profile.
- Doctor upload/run/view.

Upload: multipart form with `file`, optional `title`.

Allowed original formats: png, jpg, jpeg.

---

## 10. External X-ray / AI Workspace

```http
GET  /api/external-xrays/
POST /api/external-xrays/
GET  /api/external-xrays/{id}/
GET  /api/external-xrays/{id}/file/
POST /api/external-xrays/{id}/run-ai/
GET  /api/external-xrays/{id}/ai-result/
GET  /api/external-xrays/{id}/ai-overlay/
POST /api/external-xrays/{id}/attach-to-patient/
POST /api/external-xrays/{id}/discard/
```

Permissions:

- Admin and Doctor can list/create/view/file/run-ai/result/overlay/discard.
- Doctor only can attach-to-patient.
- Staff denied for every external X-ray endpoint.

Attach request:

```json
{
  "patient_id": 12,
  "visit_id": null,
  "title": "Panoramic X-ray"
}
```

Attach behavior:

- creates saved XrayAttachment
- links/copies existing AIResult if available
- marks ExternalXrayCase as ATTACHED_TO_PATIENT

---

## 11. AI Result Response

Normalized response:

```json
{
  "id": 90,
  "status": "COMPLETED",
  "result_summary": "Research-only AI analysis completed.",
  "overall_confidence": 0.74,
  "overall_confidence_percent": 74,
  "findings": [
    {
      "fdi_tooth_id": "36",
      "disease_label": "Caries",
      "disease_label_ar": "تسوس",
      "confidence_score": 0.82,
      "confidence_percent": 82
    }
  ],
  "overlay_available": true,
  "model_version": "v1.0",
  "disclaimer": "Research-only AI assistance. Not a clinical diagnosis."
}
```

---

## 12. Billing Handoffs

```http
GET  /api/billing-handoffs/
GET  /api/billing-handoffs/{id}/
POST /api/visits/{visit_id}/billing-handoff/
POST /api/billing-handoffs/{id}/dismiss/
POST /api/billing-handoffs/{id}/convert-to-invoice/
```

Permissions:

- Create: Doctor only.
- List/detail: Admin read-only, Staff, Doctor own.
- Dismiss/convert: Staff only.

---

## 13. Invoices / Payments

```http
GET   /api/invoices/
POST  /api/invoices/
GET   /api/invoices/{id}/
PATCH /api/invoices/{id}/
POST  /api/invoices/{id}/cancel/
POST  /api/invoices/{id}/payments/
GET   /api/invoices/{id}/print-data/
```

Permissions:

- Admin read-only.
- Staff create/edit/cancel/pay/print.
- Doctor no invoice/payment management.

Payment validation:

- amount > 0
- currency matches invoice currency
- cannot overpay
- cannot pay cancelled invoice

---

## 14. Dashboard APIs

```http
GET /api/dashboard/admin/
GET /api/dashboard/staff/
GET /api/dashboard/doctor/
```

Role-specific only.

---

## 15. Error Codes

Required errors include:

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
USER_INACTIVE
PERMISSION_DENIED
VALIDATION_ERROR
NOT_FOUND
DOCTOR_ALREADY_BOOKED
DOCTOR_UNAVAILABLE
OUTSIDE_WORKING_HOURS
CAPACITY_FULL
INVALID_STATUS_TRANSITION
ACTIVE_VISIT_EXISTS
UNSUPPORTED_FILE_TYPE
FILE_TOO_LARGE
AI_ALREADY_PROCESSING
AI_RESULT_UNAVAILABLE
AI_PROCESSING_FAILED
PAYMENT_CURRENCY_MISMATCH
INVOICE_CANCELLED
OVERPAYMENT_NOT_ALLOWED
BILLING_HANDOFF_ALREADY_CONVERTED
EXTERNAL_XRAY_ALREADY_ATTACHED
```
