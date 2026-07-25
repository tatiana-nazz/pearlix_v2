# Project Source of Truth — Detailed

# HISTORICAL / SUPERSEDED — NOT CURRENT IMPLEMENTATION AUTHORITY

Replacement: [`../CODEX_START_HERE.md`](../CODEX_START_HERE.md). Authority register: [`../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). Useful as Phase 12 historical evidence only.

## 1. Project Identity

Project name: Dental Clinic Management System Website  
Placeholder clinic name: Pearl Dental Clinic  
Business domain: one dental clinic in Syria  
Users: Admin, Staff/Receptionist, Doctor  
Patient portal: not included  
Backend: Django + Django REST Framework  
Database: PostgreSQL  
Frontend: React + Vite + TypeScript  
API base path: `/api/`  
Languages: English and Arabic  
Direction: English LTR and Arabic RTL  
Devices: desktop/tablet first

---

## 2. Main Product Goal

Build a professional clinic management backend that supports:

- user management
- clinic settings
- doctor/staff schedules
- patient records
- appointment booking
- check-in workflow
- doctor visit workflow
- clinical notes
- patient profile X-rays and AI results
- external X-ray/AI workspace
- billing handoff from doctor to staff
- invoice/payment workflow
- dashboard summaries
- audit logs
- protected media access

---

## 3. Main Demo Workflow

1. Admin logs in.
2. Admin creates users: staff, doctors, admin.
3. Admin configures clinic capacity, appointment durations, timezone, schedules, availability exceptions, and AI mode.
4. Staff logs in.
5. Staff creates patient.
6. Staff searches patient by phone/name.
7. Staff books appointment for patient with doctor.
8. Backend validates capacity, doctor conflict, working hours, and exceptions.
9. Staff checks in patient.
10. Doctor logs in.
11. Doctor sees checked-in appointment.
12. Doctor starts visit.
13. Doctor writes/updates notes.
14. Doctor uploads X-ray inside Active Visit or Patient Profile.
15. Doctor runs/views AI result.
16. Doctor completes visit.
17. Doctor sends billing handoff/request.
18. Staff receives billing handoff.
19. Staff converts billing handoff to invoice.
20. Staff records payment.
21. Staff prints invoice.
22. Admin monitors dashboards and records read-only.

---

## 4. Locked Business Decisions

- One clinic only.
- Multiple doctors can work at the same time.
- Admin sets clinic capacity.
- Clinic capacity means maximum number of appointments allowed at the same exact start datetime.
- Default appointment duration is 30 minutes.
- Allowed appointment durations are 15, 30, 45, 60 minutes.
- Appointment capacity counts statuses: `UPCOMING`, `CHECKED_IN`, `ACTIVE`.
- Appointment capacity ignores: `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Admin cannot override capacity conflicts.
- Admin cannot perform reception/clinical/billing operations.
- Staff owns reception and billing operations.
- Doctor owns clinical workflow.
- No patient login portal.
- Billing supports SYP and USD.
- Invoice currency and payment currency must match.
- Mixed-currency payment is postponed.
- Billing MVP is simple total + optional notes, not itemized accounting.
- Printable invoices are required.

---

## 5. Roles

### Admin

Admin is supervisory/system-management, not operational.

Admin can:

- manage users
- configure clinic settings
- configure scheduling policy
- manage schedules/working hours/availability exceptions
- view patients read-only
- view appointments read-only
- view visits/read clinical notes read-only
- view billing read-only
- access external X-ray/AI dashboard
- upload temporary external X-rays
- run/view AI on temporary external X-rays
- discard temporary external X-rays

Admin cannot:

- create/edit patients
- create/edit/check-in appointments
- start/complete visits
- edit clinical notes
- create invoices
- record payments
- attach/save external X-ray/AI results to patient profiles

### Staff

Staff owns reception and billing operations.

Staff can:

- create/edit patients
- view patients
- create/edit appointments
- check in appointments
- cancel/no-show appointments
- view clinical notes read-only
- view saved patient X-rays/AI read-only inside patient profile
- view billing handoffs
- convert billing handoffs to invoices
- create/edit/cancel invoices
- record payments
- print invoices
- view schedules read-only

Staff cannot:

- edit clinical notes
- upload X-rays
- run AI
- access external X-ray/AI dashboard
- start visits
- create users
- change clinic settings

### Doctor

Doctor owns clinical workflow.

Doctor can:

- view/edit patients
- view own appointments
- start own checked-in visits
- edit clinical notes
- edit completed notes forever
- complete own visits
- upload X-rays inside Active Visit and Patient Profile
- run/view AI
- access external X-ray/AI dashboard
- upload temporary external X-rays
- discard own/accessible external X-rays
- attach external X-ray/AI result to a patient profile
- send billing handoff/request to staff

Doctor cannot:

- create appointments
- check in appointments
- create invoices
- record payments
- manage users/settings/schedules

---

## 6. Clinical Notes

Clinical notes are simple text fields:

- symptoms
- diagnosis
- treatment
- follow_up_notes

Rules:

- Staff read-only.
- Admin read-only.
- Doctor editable.
- Doctor can edit completed visit notes forever.
- Show created_at, updated_at, updated_by.
- Full edit history is postponed; activity log is enough for MVP.

---

## 7. X-ray and AI Areas

There are three X-ray/AI contexts:

### A. Active Visit X-rays & AI Tab

- Doctor-only clinical workspace during active visit.
- Doctor uploads X-ray linked to visit and patient.
- Doctor runs AI.
- AI results are shown with same-image overlay.

### B. Patient Profile X-rays & AI Tab

Saved patient X-rays and AI results.

- Admin: read-only.
- Staff: read-only.
- Doctor: view/upload/run AI/manage.

Saved X-rays can come from:

- Active Visit upload.
- Patient Profile upload by doctor.
- External X-ray/AI attached by doctor.

### C. External X-ray/AI Dashboard Tab

Temporary upload and analysis area outside Active Visit and Patient Profile.

- Admin can access, upload temporary X-rays, run/view AI, discard.
- Doctor can access, upload temporary X-rays, run/view AI, discard, attach to patient.
- Staff has no access.
- Only Doctor can attach/save external X-ray/AI to patient profile.
- Admin cannot attach/save external X-ray/AI to patient profile.

---

## 8. File Rules

Original X-ray formats:

- png
- jpg
- jpeg

AI overlay:

- png only

AI structured result:

- json

X-rays and AI overlays must not be public predictable URLs. Serve through protected backend endpoints.

---

## 9. AI Rules

AI must run through Django or a separate service. Manual import is not allowed.

Expected AI output shape:

```json
{
  "resultSummary": "Research-only AI analysis completed.",
  "overallConfidence": 0.74,
  "findings": [
    {
      "fdiToothId": "36",
      "diseaseLabel": "Caries",
      "confidenceScore": 0.82
    }
  ],
  "overlayFilePath": "...",
  "modelVersion": "..."
}
```

AI must never automatically:

- edit diagnosis
- edit treatment
- complete visit
- create invoice
- create payment
- change appointment or visit status

Required disclaimer:

English: `Research-only AI assistance. Not a clinical diagnosis.`  
Arabic: `مساعدة ذكاء اصطناعي لأغراض بحثية فقط. ليست تشخيصاً طبياً.`
