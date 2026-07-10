# Pytest Fixtures and Factories Guidance

Codex should implement tests using shared factories/fixtures to avoid duplicated setup.

---

## 1. Recommended Fixtures

Place in `tests/conftest.py` and/or `tests/factories.py`.

Required user fixtures:

```text
admin_user
staff_user
doctor_user
other_doctor_user
inactive_user
```

Required profile fixtures:

```text
doctor_profile
other_doctor_profile
staff_profile
```

Required API clients:

```text
api_client
admin_client
staff_client
doctor_client
other_doctor_client
anonymous_client
```

Required domain fixtures/factories:

```text
clinic_settings
patient
patient_factory
working_hour_factory
availability_exception_factory
appointment_factory
checked_in_appointment
active_visit
completed_visit
xray_file_factory
xray_attachment_factory
external_xray_case_factory
ai_result_factory
billing_handoff_factory
invoice_factory
payment_factory
```

---

## 2. API Client Authentication Pattern

Implement helper:

```python
def authenticated_client(user):
    client = APIClient()
    # use force_authenticate or token depending auth implementation
    client.force_authenticate(user=user)
    return client
```

Do not require actual login in every API permission test. Use direct authenticated clients for speed. Keep a few auth endpoint tests for login behavior.

---

## 3. File Upload Test Helpers

Use temporary image-like files:

```python
SimpleUploadedFile("xray.jpg", b"fake-image-bytes", content_type="image/jpeg")
```

If actual image validation requires valid image content, create a tiny valid PNG/JPEG in memory.

Use temporary media settings:

```python
@override_settings(MEDIA_ROOT=temp_dir)
```

Clean files after tests.

---

## 4. Time Helpers

Use timezone-aware datetimes.

Recommended fixture values:

```text
today 2026-07-08
working hours 09:00-15:00
appointment 10:00-10:30
```

Do not use naive datetimes.

---

## 5. Parameterized Role Tests

Use parameterized tests to reduce duplication.

Example targets:

- create patient allowed only staff
- create appointment allowed only staff
- check-in allowed only staff
- start visit allowed only doctor
- update notes allowed only doctor
- create invoice allowed only staff
- external xray route allowed admin/doctor but not staff
- attach external xray allowed only doctor

---

## 6. Assertion Standards

Each API test should assert:

- status code
- error code for failures
- important fields in response
- database side effect
- no side effect when denied

Example denial test expectations:

```text
response.status_code == 403
response.data["code"] == "PERMISSION_DENIED"
object count unchanged
```

---

## 7. Mock AI Adapter

Tests must not call a real model.

Use a deterministic adapter returning:

```json
{
  "result_summary": "Research-only AI analysis completed.",
  "overall_confidence": 0.74,
  "findings": [
    {
      "fdi_tooth_id": "36",
      "disease_label": "Caries",
      "disease_label_ar": "تسوس",
      "confidence_score": 0.82,
      "confidence_percent": 82
    }
  ],
  "model_version": "v1.0"
}
```

Patch adapter in tests if needed.
