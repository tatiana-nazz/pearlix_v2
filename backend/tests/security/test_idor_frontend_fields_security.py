import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


def upload_file(name="security-xray.png", content_type="image/png"):
    return SimpleUploadedFile(name, b"fake-image", content_type=content_type)


@pytest.mark.django_db
def test_cross_doctor_direct_object_ids_are_hidden(
    doctor_client,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
    xray_attachment_factory,
    external_xray_case_factory,
):
    other_patient = patient_factory(full_name="Other Doctor Secure Patient", phone="0901000001")
    other_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.ACTIVE)
    other_xray = xray_attachment_factory(
        patient=other_patient,
        visit=other_visit,
        uploaded_by=other_doctor_user,
        stored_file_name="other-doctor-xray.png",
    )
    completed_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-20T12:00:00+03:00",
        end_datetime="2026-07-20T12:30:00+03:00",
    )
    completed_visit = visit_factory(appointment=completed_appointment, status=Visit.Status.COMPLETED)
    handoff = BillingHandoff.objects.create(
        patient=other_patient,
        visit=completed_visit,
        doctor=other_doctor_user,
        status=BillingHandoff.Status.PENDING,
        created_by=other_doctor_user,
        updated_by=other_doctor_user,
    )
    external = external_xray_case_factory(uploaded_by=other_doctor_user, stored_file_name="other-external.png")

    assert doctor_client.get(f"/api/appointments/{other_appointment.id}/").status_code == 404
    assert doctor_client.post(f"/api/appointments/{other_appointment.id}/start-visit/").status_code == 404
    assert doctor_client.get(f"/api/visits/{other_visit.id}/").status_code == 200
    assert doctor_client.post(f"/api/visits/{other_visit.id}/complete/").status_code == 404
    assert doctor_client.patch(f"/api/visits/{other_visit.id}/clinical-notes/", {"diagnosis": "Blocked"}, format="json").status_code == 404
    assert doctor_client.get(f"/api/xrays/{other_xray.id}/").status_code == 200
    assert doctor_client.post(f"/api/xrays/{other_xray.id}/run-ai/").status_code == 200
    assert doctor_client.get(f"/api/external-xrays/{external.id}/").status_code == 404
    assert doctor_client.post(f"/api/external-xrays/{external.id}/run-ai/").status_code == 404
    assert doctor_client.post(f"/api/external-xrays/{external.id}/attach-to-patient/", {"patient_id": other_patient.id}, format="json").status_code == 404
    assert doctor_client.get(f"/api/billing-handoffs/{handoff.id}/").status_code == 404


@pytest.mark.django_db
def test_staff_direct_external_xray_ids_are_denied(staff_client, external_xray_case_factory, ai_result_factory):
    external = external_xray_case_factory()
    ai_result_factory(external_xray_case=external)

    assert staff_client.get(f"/api/external-xrays/{external.id}/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/file/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/run-ai/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/ai-result/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/ai-overlay/").status_code == 403


@pytest.mark.django_db
def test_frontend_controlled_fields_are_rejected_or_overridden(
    staff_client,
    doctor_client,
    staff_user,
    admin_user,
    doctor_user,
    other_doctor_user,
    patient,
    patient_factory,
    appointment_factory,
    active_visit,
    invoice_factory,
):
    spoofed_patient = staff_client.post(
        "/api/patients/",
        {
            "first_name": "Spoofed",
            "last_name": "Audit Fields",
            "phone_number": "0901000002",
            "gender": "Female",
            "created_by": admin_user.id,
            "updated_by": admin_user.id,
        },
        format="json",
    )
    assert spoofed_patient.status_code == 400
    assert "created_by" in spoofed_patient.data["details"]
    assert "updated_by" in spoofed_patient.data["details"]

    WorkingShift.objects.create(employee=doctor_user, name="Test shift", weekday=0, start_time="09:00", end_time="17:00")
    create_appointment = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient.id,
            "doctor_id": doctor_user.id,
            "start_datetime": "2026-07-20T11:00:00+03:00",
            "duration_minutes": 30,
            "end_datetime": "2026-07-20T15:00:00+03:00",
        },
        format="json",
    )
    assert create_appointment.status_code == 201
    assert create_appointment.data["end_datetime"].startswith("2026-07-20T11:30:00")

    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T13:00:00+03:00",
        end_datetime="2026-07-20T13:30:00+03:00",
    )
    status_patch = staff_client.patch(f"/api/appointments/{appointment.id}/", {"status": Appointment.Status.CANCELLED}, format="json")
    assert status_patch.status_code == 400
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING

    original_visit_state = {
        "status": active_visit.status,
        "patient_id": active_visit.patient_id,
        "doctor_id": active_visit.doctor_id,
        "appointment_id": active_visit.appointment_id,
        "started_at": active_visit.started_at,
        "completed_at": active_visit.completed_at,
    }
    clinical_patch = doctor_client.patch(
        f"/api/visits/{active_visit.id}/clinical-notes/",
        {
            "status": Visit.Status.COMPLETED,
            "patient_id": patient_factory(full_name="Other Field Patient", phone="0901000003").id,
            "doctor_id": other_doctor_user.id,
            "appointment_id": active_visit.appointment_id + 999,
            "started_at": timezone.now().isoformat(),
            "completed_at": timezone.now().isoformat(),
        },
        format="json",
    )
    assert clinical_patch.status_code == 400
    active_visit.refresh_from_db()
    assert active_visit.status == original_visit_state["status"]
    assert active_visit.patient_id == original_visit_state["patient_id"]
    assert active_visit.doctor_id == original_visit_state["doctor_id"]
    assert active_visit.appointment_id == original_visit_state["appointment_id"]
    assert active_visit.started_at == original_visit_state["started_at"]
    assert active_visit.completed_at == original_visit_state["completed_at"]

    xray_response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {
            "file": upload_file(),
            "patient": patient_factory(full_name="Spoofed Xray Patient", phone="0901000004").id,
            "visit": active_visit.id + 999,
            "uploaded_by": other_doctor_user.id,
        },
        format="multipart",
    )
    assert xray_response.status_code == 201
    xray = XrayAttachment.objects.get(id=xray_response.data["id"])
    assert xray.patient_id == active_visit.patient_id
    assert xray.visit_id == active_visit.id
    assert xray.uploaded_by_id == doctor_user.id

    external_response = doctor_client.post(
        "/api/external-xrays/",
        {"file": upload_file("external.png"), "status": ExternalXrayCase.Status.ATTACHED_TO_PATIENT, "attached_patient": patient.id},
        format="multipart",
    )
    assert external_response.status_code == 201
    external = ExternalXrayCase.objects.get(id=external_response.data["id"])
    assert external.status == ExternalXrayCase.Status.TEMPORARY
    assert external.attached_patient_id is None
    assert doctor_client.patch(f"/api/external-xrays/{external.id}/", {"status": ExternalXrayCase.Status.DISCARDED}, format="json").status_code == 405

    invoice = invoice_factory()
    invoice_patch = staff_client.patch(
        f"/api/invoices/{invoice.id}/",
        {"status": Invoice.Status.PAID, "paid_amount": "100.00", "remaining_amount": "0.00"},
        format="json",
    )
    assert invoice_patch.status_code == 400
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.UNPAID
    assert invoice.paid_amount == 0
