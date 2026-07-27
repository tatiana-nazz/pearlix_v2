from datetime import datetime, timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.models import ActivityLog
from apps.billing.models import Invoice
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


def upload_file(name="audit-xray.png", content_type="image/png"):
    return SimpleUploadedFile(name, b"fake-image", content_type=content_type)


def future_at(hour):
    return timezone.make_aware(datetime(2026, 7, 20, hour, 0, 0), timezone.get_current_timezone())


@pytest.mark.django_db
def test_audit_log_endpoint_permissions_and_no_public_mutations(api_client, admin_client, staff_client, doctor_client, admin_user):
    log = ActivityLog.objects.create(
        actor=admin_user,
        actor_role=User.Role.ADMIN,
        action="patient_created",
        entity_type="patient",
        entity_id="1",
    )

    assert api_client.get("/api/audit-logs/").status_code == 401
    assert staff_client.get("/api/audit-logs/").status_code == 403
    assert doctor_client.get("/api/audit-logs/").status_code == 403

    list_response = admin_client.get("/api/audit-logs/")
    detail_response = admin_client.get(f"/api/audit-logs/{log.id}/")
    create_response = admin_client.post("/api/audit-logs/", {"action": "manual"}, format="json")
    update_response = admin_client.patch(f"/api/audit-logs/{log.id}/", {"action": "changed"}, format="json")
    delete_response = admin_client.delete(f"/api/audit-logs/{log.id}/")

    assert list_response.status_code == 200
    assert list_response.data["count"] == 1
    assert detail_response.status_code == 200
    assert "user_agent" not in detail_response.data
    assert create_response.status_code == 405
    assert update_response.status_code == 405
    assert delete_response.status_code == 405


@pytest.mark.django_db
def test_audit_log_filters_and_pagination_shape(admin_client, admin_user, staff_user):
    first = ActivityLog.objects.create(
        actor=admin_user,
        actor_role=User.Role.ADMIN,
        action="patient_created",
        entity_type="patient",
        entity_id="10",
        metadata_json={"safe": True},
    )
    ActivityLog.objects.create(
        actor=staff_user,
        actor_role=User.Role.STAFF,
        action="payment_recorded",
        entity_type="payment",
        entity_id="20",
    )

    assert admin_client.get(f"/api/audit-logs/?actor_id={admin_user.id}").data["results"][0]["id"] == first.id
    assert admin_client.get(f"/api/audit-logs/?actor_role={User.Role.ADMIN}").data["count"] == 1
    assert admin_client.get("/api/audit-logs/?action=patient_created").data["results"][0]["id"] == first.id
    assert admin_client.get("/api/audit-logs/?entity_type=patient").data["results"][0]["id"] == first.id
    assert admin_client.get("/api/audit-logs/?entity_id=10").data["results"][0]["id"] == first.id
    assert admin_client.get("/api/audit-logs/?created_from=2020-01-01T00:00:00Z").data["count"] == 2
    assert admin_client.get("/api/audit-logs/?created_to=2099-01-01T00:00:00Z").data["count"] == 2
    response = admin_client.get("/api/audit-logs/")
    assert set(response.data) == {"count", "next", "previous", "results"}


@pytest.mark.django_db
def test_important_actions_create_safe_audit_logs(
    admin_client,
    staff_client,
    doctor_client,
    admin_user,
    doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    WorkingShift.objects.create(employee=doctor_user, name="Test shift", weekday=0, start_time="09:00", end_time="15:00")

    user_create = admin_client.post(
        "/api/users/",
        {"email": "audit-new@example.com", "password": "secret-password", "full_name": "Audit User", "role": User.Role.ADMIN},
        format="json",
    )
    new_user_id = user_create.data["id"]
    admin_client.patch(f"/api/users/{new_user_id}/", {"full_name": "Audit User Updated"}, format="json")
    admin_client.post(f"/api/users/{new_user_id}/deactivate/")
    admin_client.patch("/api/clinic/settings/", {"capacity_per_slot": 4}, format="json")

    patient_response = staff_client.post(
        "/api/patients/",
        {"first_name": "Audit", "last_name": "Patient", "phone_number": "0922000000", "gender": "Female"},
        format="json",
    )
    patient_id = patient_response.data["id"]
    staff_client.patch(
        f"/api/patients/{patient_id}/",
        {"version": patient_response.data["version"], "general_notes": "safe patient update"},
        format="json",
    )

    update_appointment = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient_id,
            "doctor_id": doctor_user.id,
            "start_datetime": future_at(9).isoformat(),
            "duration_minutes": 30,
            "reason": "Update audit",
        },
        format="json",
    )
    staff_client.patch(
        f"/api/appointments/{update_appointment.data['id']}/",
        {"start_datetime": future_at(9).replace(minute=30).isoformat()},
        format="json",
    )
    cancel_appointment = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient_id,
            "doctor_id": doctor_user.id,
            "start_datetime": future_at(10).isoformat(),
            "duration_minutes": 30,
            "reason": "Cancel audit",
        },
        format="json",
    )
    staff_client.post(f"/api/appointments/{cancel_appointment.data['id']}/cancel/")
    no_show_appointment = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient_id,
            "doctor_id": doctor_user.id,
            "start_datetime": future_at(11).isoformat(),
            "duration_minutes": 30,
            "reason": "No show audit",
        },
        format="json",
    )
    staff_client.post(f"/api/appointments/{no_show_appointment.data['id']}/no-show/")
    clinical_appointment = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient_id,
            "doctor_id": doctor_user.id,
            "start_datetime": future_at(12).isoformat(),
            "duration_minutes": 30,
            "reason": "Clinical audit",
        },
        format="json",
    )
    staff_client.post(f"/api/appointments/{clinical_appointment.data['id']}/check-in/")
    start_visit = doctor_client.post(f"/api/appointments/{clinical_appointment.data['id']}/start-visit/")
    visit_id = start_visit.data["id"]
    notes_response = doctor_client.patch(
        f"/api/visits/{visit_id}/clinical-notes/",
        {"diagnosis": "Sensitive diagnosis body", "clinical_notes": "Sensitive clinical body"},
        format="json",
    )
    xray_upload = doctor_client.post(f"/api/visits/{visit_id}/xrays/", {"file": upload_file("patient-name.png")}, format="multipart")
    doctor_client.post(f"/api/xrays/{xray_upload.data['id']}/run-ai/")
    completion = doctor_client.post(
        f"/api/visits/{visit_id}/complete/",
        {
            "version": notes_response.data["updated_at"],
            "notes": {"diagnosis": "Sensitive diagnosis body", "clinical_notes": "Sensitive clinical body"},
            "billing_handoff": {
                "description": "Clinical audit treatment",
                "suggested_amount": "90.00",
                "currency": "SYP",
                "note": "Invoice after clinical audit",
            },
        },
        format="json",
    )
    handoff = completion.data["billing_handoff"]
    invoice = staff_client.post(f"/api/billing-handoffs/{handoff['id']}/convert-to-invoice/", {}, format="json")
    staff_client.post(f"/api/invoices/{invoice.data['id']}/payments/", {"amount": "90.00", "currency": "SYP"}, format="json")

    patient = Patient.objects.get(id=patient_id)
    second_appointment = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime=future_at(13),
        end_datetime=future_at(13) + timedelta(minutes=30),
    )
    second_visit = visit_factory(appointment=second_appointment, status=Visit.Status.COMPLETED)
    dismissed_handoff = doctor_client.post(
        f"/api/visits/{second_visit.id}/billing-handoff/",
        {"suggested_amount": "20.00", "currency": "SYP"},
        format="json",
    )
    staff_client.post(f"/api/billing-handoffs/{dismissed_handoff.data['id']}/dismiss/")

    direct_invoice = staff_client.post(
        "/api/invoices/",
        {"patient_id": patient_id, "total_amount": "30.00", "currency": "SYP"},
        format="json",
    )
    staff_client.patch(f"/api/invoices/{direct_invoice.data['id']}/", {"notes": "invoice note update"}, format="json")
    staff_client.post(f"/api/invoices/{direct_invoice.data['id']}/cancel/")

    external = doctor_client.post("/api/external-xrays/", {"file": upload_file("external.png")}, format="multipart")
    doctor_client.post(f"/api/external-xrays/{external.data['id']}/run-ai/")
    doctor_client.post(f"/api/external-xrays/{external.data['id']}/attach-to-patient/", {"patient_id": patient_id}, format="json")
    discarded = doctor_client.post("/api/external-xrays/", {"file": upload_file("discarded.png")}, format="multipart")
    doctor_client.post(f"/api/external-xrays/{discarded.data['id']}/discard/")

    actions = set(ActivityLog.objects.values_list("action", flat=True))
    expected = {
        "user_created",
        "user_updated",
        "user_deactivated",
        "clinic_settings_updated",
        "patient_created",
        "patient_updated",
        "appointment_created",
        "appointment_updated",
        "appointment_checked_in",
        "appointment_cancelled",
        "appointment_marked_no_show",
        "visit_started",
        "clinical_notes_updated",
        "visit_completed",
        "xray_uploaded",
        "xray_ai_run",
        "external_xray_uploaded",
        "external_xray_ai_run",
        "external_xray_discarded",
        "external_xray_attached_to_patient",
        "billing_handoff_created",
        "billing_handoff_dismissed",
        "billing_handoff_converted_to_invoice",
        "invoice_created",
        "invoice_updated",
        "invoice_cancelled",
        "payment_recorded",
    }
    assert expected.issubset(actions)

    metadata_text = str(list(ActivityLog.objects.values_list("metadata_json", flat=True)))
    assert "secret-password" not in metadata_text
    assert "Sensitive diagnosis body" not in metadata_text
    assert "Sensitive clinical body" not in metadata_text
    assert "patient-name.png" not in metadata_text
    assert "/media/" not in metadata_text
    assert "\\" not in metadata_text
