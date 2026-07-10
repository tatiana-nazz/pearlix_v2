import pytest

from apps.ai_results.serializers import AI_DISCLAIMER_EN
from apps.ai_results.services import MOCK_MODEL_VERSION
from apps.audit.models import ActivityLog
from apps.audit.services import log_activity
from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.visits.models import Visit


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.mark.django_db
def test_protected_file_responses_use_private_headers_and_hide_missing_paths(doctor_client, xray_attachment_factory):
    xray = xray_attachment_factory()

    file_response = doctor_client.get(f"/api/xrays/{xray.id}/file/")
    assert file_response.status_code == 200
    assert file_response["Cache-Control"] == "no-store"
    assert file_response["Pragma"] == "no-cache"
    assert file_response["X-Content-Type-Options"] == "nosniff"

    detail_response = doctor_client.get(f"/api/xrays/{xray.id}/")
    assert detail_response.status_code == 200
    assert "original_file" not in detail_response.data
    assert "/media/" not in str(detail_response.data)

    xray.original_file.name = "missing/private-xray.png"
    xray.save(update_fields=["original_file", "updated_at"])
    missing_response = doctor_client.get(f"/api/xrays/{xray.id}/file/")

    assert missing_response.status_code == 404
    assert "missing/private-xray.png" not in str(missing_response.data)
    assert "/media/" not in str(missing_response.data)


@pytest.mark.django_db
def test_ai_runs_are_stubbed_disclaimed_and_do_not_mutate_clinical_or_billing_state(
    admin_client,
    staff_client,
    doctor_client,
    admin_user,
    active_visit,
    xray_attachment_factory,
    external_xray_case_factory,
):
    active_visit.symptoms = "Original symptoms"
    active_visit.diagnosis = "Original diagnosis"
    active_visit.treatment = "Original treatment"
    active_visit.clinical_notes = "Original clinical notes"
    active_visit.save(update_fields=["symptoms", "diagnosis", "treatment", "clinical_notes", "updated_at"])
    patient = active_visit.patient
    patient.medical_summary = "Original patient summary"
    patient.save(update_fields=["medical_summary", "updated_at"])
    appointment = active_visit.appointment
    xray = xray_attachment_factory()
    external = external_xray_case_factory()
    admin_external = external_xray_case_factory(uploaded_by=admin_user, stored_file_name="admin-external.png")

    assert staff_client.post(f"/api/xrays/{xray.id}/run-ai/").status_code == 403
    assert admin_client.post(f"/api/xrays/{xray.id}/run-ai/").status_code == 403

    saved_response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")
    external_response = doctor_client.post(f"/api/external-xrays/{external.id}/run-ai/")
    admin_external_response = admin_client.post(f"/api/external-xrays/{admin_external.id}/run-ai/")

    assert saved_response.status_code == 200
    assert external_response.status_code == 200
    assert admin_external_response.status_code == 200
    for response in (saved_response, external_response, admin_external_response):
        assert response.data["disclaimer"] == AI_DISCLAIMER_EN
        assert response.data["disclaimer_ar"]
        assert "not a clinical diagnosis" in response.data["disclaimer"].lower()
        assert response.data["model_version"] == MOCK_MODEL_VERSION

    patient.refresh_from_db()
    active_visit.refresh_from_db()
    appointment.refresh_from_db()
    assert patient.medical_summary == "Original patient summary"
    assert active_visit.symptoms == "Original symptoms"
    assert active_visit.diagnosis == "Original diagnosis"
    assert active_visit.treatment == "Original treatment"
    assert active_visit.clinical_notes == "Original clinical notes"
    assert active_visit.status == Visit.Status.ACTIVE
    assert appointment.status == "ACTIVE"
    assert BillingHandoff.objects.count() == 0
    assert Invoice.objects.count() == 0
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_billing_security_blocks_privilege_escalation_and_enforces_backend_totals(
    admin_client,
    staff_client,
    doctor_client,
    invoice_factory,
):
    invoice = invoice_factory(total_amount="100.00", currency=Invoice.Currency.SYP)

    assert doctor_client.get(f"/api/invoices/{invoice.id}/").status_code == 403
    assert doctor_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json").status_code == 403
    assert admin_client.patch(f"/api/invoices/{invoice.id}/", {"notes": "Blocked"}, format="json").status_code == 403
    assert admin_client.post(f"/api/invoices/{invoice.id}/cancel/").status_code == 403
    assert admin_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json").status_code == 403

    spoofed_totals = staff_client.patch(
        f"/api/invoices/{invoice.id}/",
        {"paid_amount": "100.00", "remaining_amount": "0.00", "status": Invoice.Status.PAID},
        format="json",
    )
    mismatch = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "USD"}, format="json")
    partial = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "40.00", "currency": "SYP"}, format="json")
    overpay = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "70.00", "currency": "SYP"}, format="json")

    assert spoofed_totals.status_code == 400
    assert mismatch.status_code == 400
    assert mismatch.data["code"] == "PAYMENT_CURRENCY_MISMATCH"
    assert partial.status_code == 201
    assert partial.data["invoice"]["paid_amount"] == "40.00"
    assert partial.data["invoice"]["remaining_amount"] == "60.00"
    assert partial.data["invoice"]["status"] == Invoice.Status.PARTIALLY_PAID
    assert overpay.status_code == 400
    assert overpay.data["code"] == "OVERPAYMENT_NOT_ALLOWED"

    cancelled = invoice_factory(invoice_number="INV-SEC-CANCELLED-000001", total_amount="30.00")
    assert staff_client.post(f"/api/invoices/{cancelled.id}/cancel/").status_code == 200
    locked_payment = staff_client.post(f"/api/invoices/{cancelled.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json")
    assert locked_payment.status_code == 409
    assert locked_payment.data["code"] == "INVOICE_CANCELLED"


@pytest.mark.django_db
def test_audit_metadata_sanitizer_strips_sensitive_fields(admin_user):
    log_activity(
        actor=admin_user,
        action="security_metadata_probe",
        entity_type="security",
        entity_id="1",
        metadata={
            "safe_id": 123,
            "password": "secret-password",
            "refresh_token": "refresh-token",
            "raw_file_path": "C:/secret/xray.png",
            "clinical_notes": "Full clinical note",
            "nested": {"payment_id": 55, "authorization": "Bearer token"},
        },
    )

    log = ActivityLog.objects.get(action="security_metadata_probe")
    metadata_text = str(log.metadata_json)

    assert log.metadata_json["safe_id"] == 123
    assert log.metadata_json["nested"]["payment_id"] == 55
    assert "secret-password" not in metadata_text
    assert "refresh-token" not in metadata_text
    assert "C:/secret/xray.png" not in metadata_text
    assert "Full clinical note" not in metadata_text
    assert "Bearer token" not in metadata_text


@pytest.mark.django_db
def test_doctor_dashboard_does_not_leak_global_billing_notes_or_file_paths(
    doctor_client,
    doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
    invoice_factory,
):
    patient = patient_factory(full_name="Dashboard Security Patient", phone="0901000005")
    appointment = appointment_factory(patient=patient, doctor=doctor_user, status="ACTIVE")
    visit_factory(
        appointment=appointment,
        status=Visit.Status.ACTIVE,
        clinical_notes="Sensitive dashboard clinical note",
        diagnosis="Sensitive dashboard diagnosis",
    )
    invoice_factory(patient=patient, invoice_number="INV-DASH-SEC-000001")

    response = doctor_client.get("/api/dashboard/doctor/")

    assert response.status_code == 200
    payload = str(response.data)
    assert "Sensitive dashboard clinical note" not in payload
    assert "Sensitive dashboard diagnosis" not in payload
    assert "INV-DASH-SEC-000001" not in payload
    assert "invoice" not in payload.lower()
    assert "/media/" not in payload
