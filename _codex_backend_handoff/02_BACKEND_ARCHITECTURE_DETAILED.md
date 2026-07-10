# Backend Architecture — Detailed

## 1. Architecture Style

Use a modular Django monolith with Django REST Framework.

Architecture:

```text
React Frontend
    ↓ /api/
Django REST Framework API
    ↓
Service/selector/business-rule layer
    ↓
Django ORM
    ↓
PostgreSQL
    ↓
Protected media storage for X-rays/overlays
    ↓
Optional AI adapter/service
```

This is not a microservice project. Keep it simple but structured.

---

## 2. Recommended Backend Tree

```text
backend/
├── manage.py
├── config/
│   ├── __init__.py
│   ├── urls.py
│   ├── asgi.py
│   ├── wsgi.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py
│       ├── local.py
│       ├── test.py
│       └── production.py
├── apps/
│   ├── common/
│   ├── accounts/
│   ├── clinic/
│   ├── patients/
│   ├── scheduling/
│   ├── visits/
│   ├── xrays/
│   ├── ai_results/
│   ├── billing/
│   ├── dashboard/
│   └── audit/
├── tests/
│   ├── conftest.py
│   ├── factories.py
│   ├── test_smoke.py
│   ├── accounts/
│   ├── patients/
│   ├── scheduling/
│   ├── visits/
│   ├── xrays/
│   ├── billing/
│   ├── security/
│   └── workflows/
├── requirements.txt
├── pytest.ini
├── .env.example
└── README.md
```

If the repo already has a different but clean structure, preserve it unless it conflicts with these docs.

---

## 3. App Responsibilities

### `apps.common`

Shared:

- base models
- timestamp mixins
- created_by/updated_by helpers
- standardized error response helpers
- enums/constants
- file validators
- pagination
- common permissions/helpers

### `apps.accounts`

- custom user model
- role enum: ADMIN, STAFF, DOCTOR
- doctor/staff profiles if needed
- authentication endpoints
- `/api/me/`
- `/api/me/preferences/`
- admin user management

### `apps.clinic`

- one-row ClinicSettings
- capacity/duration/currency/language/timezone/AI mode
- `/api/clinic/settings/`

### `apps.patients`

- Patient model
- patient search/list/detail/create/update
- patient profile summary endpoints

### `apps.scheduling`

- appointments
- working hours
- availability exceptions
- appointment capacity service
- appointment conflict service
- check-in/cancel/no-show transitions
- availability preview endpoint

### `apps.visits`

- Visit model
- start/complete visit workflow
- clinical notes update
- active visit endpoint
- one active visit per doctor

### `apps.xrays`

- saved Patient/Visit X-ray records
- ExternalXrayCase temporary records
- protected file endpoints
- upload validators
- attach-to-patient service for external cases

### `apps.ai_results`

- AIResult model
- AI adapter interface
- mock adapter for MVP/demo
- run AI endpoints
- result normalization
- overlay handling

### `apps.billing`

- BillingHandoff
- Invoice
- Payment
- invoice status calculation
- print-data endpoint

### `apps.dashboard`

- staff/admin/doctor summary endpoints

### `apps.audit`

- ActivityLog model
- service to log important actions

---

## 4. Business Logic Placement

Do not put complex workflow logic directly inside views.

Preferred placement:

```text
permissions.py       role/object checks
selectors.py         read/query helpers
services.py          mutations/business workflows
serializers.py       validation and representation
views.py             HTTP action wiring
models.py            persistence, simple invariants
```

Examples:

- appointment capacity → `scheduling/services.py`
- start visit → `visits/services.py`
- clinical note update → `visits/services.py`
- protected file permission → `xrays/permissions.py`
- attach external X-ray → `xrays/services.py`
- invoice status calculation → `billing/services.py`

---

## 5. Transaction Boundaries

Use database transactions for:

- appointment create/update with capacity/conflict checks
- start visit
- complete visit
- attach external X-ray to patient
- convert billing handoff to invoice
- record payment
- cancel invoice

Appointment booking is especially sensitive to race conditions. Re-check capacity and doctor conflicts inside the transaction.

---

## 6. API Style

API base path is `/api/` only.

No `/api/v1/`.

Use JSON for normal requests/responses and multipart for upload.

Use snake_case fields.

Use DRF viewsets where helpful, but custom actions are acceptable for workflow transitions.

---

## 7. Error Style

All business/permission/validation errors should follow:

```json
{
  "code": "CAPACITY_FULL",
  "message": "Clinic capacity is full for this start time.",
  "details": {
    "capacity": 3,
    "current_count": 3
  }
}
```

Do not return inconsistent raw exception strings to frontend.

---

## 8. Protected Media Strategy

Do not expose predictable public URLs for X-rays or AI overlays.

Preferred endpoints:

```text
GET /api/xrays/{id}/file/
GET /api/xrays/{id}/ai-overlay/
GET /api/external-xrays/{id}/file/
GET /api/external-xrays/{id}/ai-overlay/
```

Backend must check role and object access before returning file/blob.

---

## 9. AI Adapter Strategy

Implement an adapter boundary:

```text
AiAdapter.run_xray_analysis(xray_file) -> normalized result
```

Start with a deterministic mock adapter if real model integration is not available.

Mock adapter is allowed because inference is still triggered through backend API, not manual import.

The adapter should return the expected JSON structure and optional overlay placeholder path/status.
