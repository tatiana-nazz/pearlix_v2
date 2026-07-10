# Permissions and RBAC — Detailed

Backend permissions are mandatory. Frontend guards are only convenience.

---

## 1. Roles

```text
ADMIN
STAFF
DOCTOR
```

Do not add more roles in MVP.

---

## 2. High-Level Matrix

| Feature / Action | Admin | Staff | Doctor |
|---|---|---|---|
| Login | Yes | Yes | Yes |
| Manage users | Yes | No | No |
| Clinic settings read | Yes | Limited | Limited |
| Clinic settings edit | Yes | No | No |
| Schedules read | Yes | Yes | Own/relevant |
| Schedules edit | Yes | No | No |
| Patients list/detail | Read-only | Yes | Yes |
| Create patient | No | Yes | No |
| Edit patient | No | Yes | Yes |
| Clinical notes view | Read-only | Read-only | Yes |
| Clinical notes edit | No | No | Yes |
| Completed notes edit | No | No | Yes, forever |
| Appointments list/detail | Read-only | Yes | Own only |
| Create appointment | No | Yes | No |
| Edit appointment | No | Yes | No |
| Check-in appointment | No | Yes | No |
| Cancel/no-show appointment | No | Yes | No |
| Start visit | No | No | Own checked-in appointment only |
| Complete visit | No | No | Own active visit only |
| Saved patient X-rays | Read-only | Read-only | View/upload/manage |
| Saved patient AI results | Read-only | Read-only | Run/view |
| Active Visit X-rays/AI | No | No | Upload/run/view |
| External X-ray/AI dashboard | Yes | No | Yes |
| Upload temporary external X-ray | Yes | No | Yes |
| Run AI on temporary external X-ray | Yes | No | Yes |
| View temporary external AI result | Yes | No | Yes |
| Discard temporary external X-ray | Yes | No | Yes |
| Attach external X-ray/AI to patient | No | No | Yes |
| Billing handoff read | Read-only | Yes | Own |
| Create billing handoff | No | No | Yes |
| Convert/dismiss billing handoff | No | Yes | No |
| Invoices read | Read-only | Yes | No management |
| Create/edit/cancel invoices | No | Yes | No |
| Record payments | No | Yes | No |
| Print invoice data | Read-only | Yes | No |
| Dashboard | Admin dashboard | Staff dashboard | Doctor dashboard |

---

## 3. Endpoint Permission Summary

### Auth / Me

All authenticated roles can access `/api/me/` and `/api/me/preferences/`.

### Users

Admin only.

### Clinic Settings

- GET: Admin full, Staff/Doctor limited safe settings.
- PATCH: Admin only.

### Patients

- GET/list/detail: Admin, Staff, Doctor.
- POST: Staff only.
- PATCH: Staff and Doctor only.

### Appointments

- GET/list/detail: Admin, Staff, Doctor own.
- POST/PATCH: Staff only.
- check-in/cancel/no-show: Staff only.
- availability preview: Staff and Admin read-only.

### Visits

- GET/list/detail: Admin read-only, Staff read-only, Doctor own/relevant.
- start visit: Doctor only.
- update clinical notes: Doctor only.
- complete visit: Doctor only.

### Saved X-rays / AI

- GET saved X-rays/files/results: Admin read-only, Staff read-only, Doctor full read.
- Upload saved X-ray: Doctor only.
- Run AI for saved X-ray: Doctor only.

### External X-rays / AI

- List/create/detail/file/run-ai/result/overlay/discard: Admin and Doctor.
- Attach-to-patient: Doctor only.
- Staff denied for all external X-ray/AI APIs.

### Billing Handoffs

- Create: Doctor only.
- List/read: Admin read-only, Staff, Doctor own.
- Convert/dismiss: Staff only.

### Invoices / Payments

- List/detail/print-data: Admin read-only, Staff.
- Create/update/cancel invoice: Staff only.
- Record payment: Staff only.
- Doctor denied for invoice/payment management.

---

## 4. Object-Level Permission Rules

### Doctor Object Scope

MVP recommendation:

- Doctor can access patients linked to their appointments/visits.
- Doctor can access own appointments.
- Doctor can start only appointment assigned to them.
- Doctor can edit own/relevant visit notes.
- Doctor can attach external X-ray to patient only if they can access that patient.

If demo requires broad doctor patient search, implement explicitly and document it.

### Staff Scope

Staff can operate across clinic because reception handles all patients/appointments/billing.

### Admin Scope

Admin can read operational data but cannot mutate operational records except user/settings/schedules/system configuration.

---

## 5. Permission Error Requirements

Use consistent error shape:

```json
{
  "code": "PERMISSION_DENIED",
  "message": "You do not have permission to perform this action.",
  "details": {}
}
```

For inaccessible object by ID, return either 403 or 404 consistently. Recommended:

- 404 for object the user should not know exists.
- 403 for known route/action but forbidden role.

---

## 6. Permission Tests Required

For every phase, Codex must add negative permission tests, not only happy paths.

Minimum examples:

- Admin cannot create patient.
- Admin cannot check in appointment.
- Staff cannot edit clinical notes.
- Staff cannot access external X-ray endpoints.
- Doctor cannot create invoice.
- Admin cannot attach external X-ray to patient.
- Doctor cannot start another doctor’s appointment.
