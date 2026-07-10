# Workflow / E2E Backend Tests

These are integration-style API workflow tests. They should be implemented gradually. By Phase 12J, all must pass or any deferred workflow must be explicitly reported.

---

## WF-001 Full Clinic Workflow

Goal: prove the full demo workflow works end to end.

Actors:

- admin_user
- staff_user
- doctor_user

Setup:

- Clinic settings capacity_per_slot=3.
- Doctor working hours include today 09:00-15:00.

Steps:

1. Admin creates doctor/staff if not fixture-based.
2. Admin configures clinic settings.
3. Staff creates patient.
4. Staff creates appointment for patient + doctor at 10:00 duration 30.
5. Staff checks in appointment.
6. Doctor starts visit.
7. Doctor updates clinical notes.
8. Doctor uploads X-ray to visit.
9. Doctor runs AI on X-ray using mock adapter.
10. Doctor gets AI result and sees disclaimer.
11. Doctor completes visit.
12. Doctor creates billing handoff.
13. Staff lists pending handoffs.
14. Staff converts handoff to invoice.
15. Staff records partial payment.
16. Staff gets invoice print data.
17. Admin reads patient/appointment/visit/invoice read-only.

Expected:

- All allowed steps return 2xx.
- Appointment ends COMPLETED.
- Visit ends COMPLETED.
- Clinical notes persisted.
- X-ray saved.
- AI result saved.
- Billing handoff converted.
- Invoice partially paid.
- Print data includes clinic/patient/doctor/amount.

---

## WF-002 Appointment Capacity Workflow

Goal: prove clinic capacity is exact start time and statuses matter.

Setup:

- capacity_per_slot=2.
- two doctors with working hours 09:00-15:00.
- patients p1,p2,p3.

Steps:

1. Staff books p1 with doctor A at 10:00 UPCOMING.
2. Staff books p2 with doctor B at 10:00 UPCOMING.
3. Staff tries p3 with doctor B or another doctor at 10:00.
4. Expect CAPACITY_FULL.
5. Staff cancels p1.
6. Staff books p3 at 10:00 again.
7. Expect success.

Expected:

- Capacity counts exact start_datetime only.
- Cancelled does not count.

Additional assertions:

- Booking at 10:30 should not be blocked by 10:00 capacity if doctor conflict rules allow.

---

## WF-003 Doctor Conflict Workflow

Goal: prove doctor cannot be double-booked even if capacity allows.

Setup:

- capacity_per_slot=5.
- doctor A working 09:00-15:00.

Steps:

1. Staff books patient p1 doctor A 10:00-10:30.
2. Staff tries patient p2 doctor A 10:15-10:45.
3. Expect DOCTOR_ALREADY_BOOKED.
4. Staff books p2 doctor A 10:30-11:00.
5. Expect success.

---

## WF-004 Clinical Permission Workflow

Goal: prove only Doctor edits notes.

Steps:

1. Staff creates patient and appointment.
2. Staff checks in.
3. Doctor starts visit.
4. Staff tries update clinical notes.
5. Expect 403.
6. Admin tries update clinical notes.
7. Expect 403.
8. Doctor updates notes.
9. Expect 200.
10. Doctor completes visit.
11. Doctor updates completed notes.
12. Expect 200.

---

## WF-005 External X-ray Admin Temporary Workflow

Goal: prove Admin can use external workspace but cannot attach.

Steps:

1. Admin uploads temporary external X-ray.
2. Admin runs AI.
3. Admin gets result.
4. Admin tries attach-to-patient.
5. Expect 403.
6. Admin discards external case.
7. Confirm status DISCARDED.

---

## WF-006 External X-ray Doctor Attach Workflow

Goal: prove Doctor can attach external X-ray/AI to patient profile.

Steps:

1. Doctor uploads temporary external X-ray.
2. Doctor runs AI.
3. Doctor gets AI result.
4. Doctor attaches external case to patient.
5. GET patient X-rays includes saved XrayAttachment.
6. GET saved X-ray AI result exists and has disclaimer.
7. External case status is ATTACHED_TO_PATIENT.
8. Trying to attach again returns conflict.

---

## WF-007 Staff External X-ray Denial Workflow

Goal: prove Staff has no external X-ray/AI access.

Steps:

1. Staff GET /api/external-xrays/.
2. Staff POST /api/external-xrays/.
3. Staff GET /api/external-xrays/{id}/.
4. Staff POST /api/external-xrays/{id}/run-ai/.
5. Staff POST /api/external-xrays/{id}/attach-to-patient/.

Expected: all 403 or 404 based on access policy.

---

## WF-008 Billing Workflow

Goal: prove Doctor handoff → Staff invoice/payment.

Steps:

1. Doctor creates billing handoff for completed visit.
2. Admin tries convert handoff.
3. Expect 403.
4. Doctor tries convert handoff.
5. Expect 403.
6. Staff converts handoff to invoice.
7. Staff records payment with mismatched currency.
8. Expect PAYMENT_CURRENCY_MISMATCH.
9. Staff records valid partial payment.
10. Invoice status PARTIALLY_PAID.
11. Staff tries overpayment.
12. Expect OVERPAYMENT_NOT_ALLOWED.
13. Staff records remaining payment.
14. Invoice status PAID.

---

## WF-009 Protected Media Workflow

Goal: prove file access is protected.

Steps:

1. Doctor uploads saved X-ray.
2. Anonymous GET file endpoint.
3. Expect 401.
4. Staff GET saved patient X-ray file.
5. Expect allowed read-only if patient profile access.
6. Doctor GET file.
7. Expect 200.
8. Unrelated doctor GET file.
9. Expect 403 or 404 if object scope enforced.

---

## WF-010 Admin Read-only Workflow

Goal: prove Admin cannot mutate operational records.

Steps:

1. Admin POST /api/patients/.
2. Admin PATCH /api/patients/{id}/.
3. Admin POST /api/appointments/.
4. Admin POST /api/appointments/{id}/check-in/.
5. Admin POST /api/appointments/{id}/start-visit/.
6. Admin PATCH /api/visits/{id}/clinical-notes/.
7. Admin POST /api/invoices/.
8. Admin POST /api/invoices/{id}/payments/.

Expected: all denied.

Admin read endpoints should still work.
