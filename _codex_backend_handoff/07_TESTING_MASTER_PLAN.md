# Testing Master Plan — Detailed

Testing is mandatory, not optional.

Every phase must add or update tests for implemented behavior. A phase is not complete until relevant tests pass or the exact blocker is reported.

---

## 1. Test Stack

Use:

- pytest
- pytest-django
- Django REST Framework APIClient or APIRequestFactory
- model factories/fixtures
- temporary media storage for file tests
- optional freezegun/time helpers if installed

Do not require a real AI model in tests. Use a deterministic mock AI adapter.

---

## 2. Test Levels

### Unit Tests

Test pure business rules/services:

- capacity counting
- doctor overlap detection
- working hour checks
- appointment status transitions
- active visit constraint
- invoice status calculation
- payment validation
- file extension validation
- AI result normalization
- permission helper functions

### API Tests

Test endpoint behavior:

- auth required
- role allowed/denied
- request validation
- response fields
- status codes
- error codes

### Integration / Workflow Tests

Test user workflows across multiple modules:

- Staff creates patient → books appointment → checks in.
- Doctor starts visit → notes → X-ray → AI → complete → billing handoff.
- Staff converts handoff → invoice → payment → print data.
- External X-ray: Admin temporary workflow and Doctor attach workflow.

### Security Regression Tests

Test forbidden actions:

- Admin cannot create operational data.
- Staff cannot perform clinical/X-ray/AI external actions.
- Doctor cannot perform billing/payment actions.
- Object IDs cannot leak unrelated records.

---

## 3. Global Test Rules

- Tests must be deterministic.
- Tests must not rely on test order.
- Tests must not use real external AI service.
- Tests must not write media outside temp test media directory.
- Tests must assert status codes and important response body fields.
- Tests must include negative cases.
- Use factories/fixtures to keep setup readable.
- Use parameterized tests for role matrix checks.

---

## 4. Minimum Commands Per Phase

At minimum run:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
pytest
```

If full pytest is too slow during one phase, run targeted tests and report that full suite was not run:

```bash
pytest tests/scheduling -q
pytest tests/security -q
```

Final report must include exact commands run.

---

## 5. Test Naming Convention

Use descriptive names:

```python
def test_staff_can_create_patient(api_client, staff_user): ...
def test_admin_cannot_create_patient(api_client, admin_user): ...
def test_capacity_full_blocks_exact_start_time(api_client, staff_user): ...
def test_doctor_cannot_create_invoice(api_client, doctor_user): ...
```

---

## 6. Core Test Categories Required

### Authentication

- login success
- login wrong password
- inactive user denied
- `/api/me/` requires auth
- preferences update valid values
- preferences invalid values rejected

### Accounts / Users

- admin can create user
- staff/doctor cannot create user
- admin can deactivate user
- inactive user cannot log in
- role-specific profile creation if implemented

### Patients

- staff can create patient
- admin cannot create patient
- doctor cannot create patient
- staff can update patient
- doctor can update patient
- admin cannot update patient
- patient list requires auth
- search by phone returns expected patient
- search by name returns expected patient
- archived excluded by default if archiving implemented

### Scheduling / Appointments

- admin can read appointments
- staff can create appointment
- admin cannot create appointment
- doctor cannot create appointment
- duration must be 15/30/45/60
- appointment inside working hours succeeds
- outside working hours fails
- unavailable exception fails
- doctor overlapping appointment fails
- exact-slot capacity full fails
- completed/cancelled/no-show do not count against capacity
- check-in staff only
- invalid status transitions fail

### Visits / Clinical Notes

- doctor can start own checked-in appointment
- doctor cannot start upcoming appointment
- doctor cannot start another doctor appointment
- staff/admin cannot start visit
- one active visit per doctor enforced
- doctor can update notes
- doctor can update completed notes forever
- staff/admin cannot update notes
- complete visit changes visit and appointment statuses

### Saved X-rays / AI

- doctor can upload valid xray to visit
- doctor can upload valid xray to patient profile
- staff/admin cannot upload saved xray
- invalid file extension rejected
- oversized file rejected
- protected xray file requires auth
- staff/admin can view saved files read-only if allowed
- doctor can run AI
- staff cannot run AI
- AI result has disclaimer

### External X-ray / AI

- admin can create temporary external xray
- doctor can create temporary external xray
- staff cannot create/list external xray
- admin can run AI on external xray
- doctor can run AI on external xray
- staff cannot run AI
- admin cannot attach external xray to patient
- doctor can attach external xray to patient
- attached case creates saved XrayAttachment
- existing AI result is linked/copied on attach
- discard marks status DISCARDED

### Billing

- doctor can create billing handoff for own visit
- staff converts handoff to invoice
- admin cannot convert handoff
- doctor cannot convert handoff
- converted handoff cannot convert again
- staff can create invoice
- admin/doctor cannot create invoice
- staff can record payment
- payment currency mismatch rejected
- overpayment rejected
- cancelled invoice cannot receive payment
- invoice status calculated correctly
- print-data endpoint allowed for staff/admin read-only, denied doctor

### Dashboards / Audit

- each role can access only its dashboard
- dashboard counts match created data
- important actions create ActivityLog entries

---

## 7. Required Full Workflow Tests

At least these workflow tests must exist by the end of backend phases:

1. Full staff → doctor → staff clinic workflow.
2. Appointment capacity conflict workflow.
3. Doctor clinical workflow with X-ray and AI.
4. External X-ray Admin temporary-only workflow.
5. External X-ray Doctor attach-to-patient workflow.
6. Billing handoff to invoice/payment workflow.
7. Permission regression workflow across Admin/Staff/Doctor.
8. Protected media access workflow.

Details are in `09_WORKFLOW_E2E_TESTS.md`.
