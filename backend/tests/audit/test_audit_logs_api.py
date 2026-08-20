from datetime import datetime, timedelta

import pytest
from django.contrib import admin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, override_settings
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.admin import ActivityLogAdmin
from apps.audit.models import ActivityLog
from apps.audit.services import log_activity
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
def test_activity_log_django_admin_is_view_only(client):
    django_admin = User.objects.create_superuser(
        email="audit-django-admin@example.com",
        password="strong-admin-password",
        full_name="Audit Django Admin",
    )
    log = ActivityLog.objects.create(
        actor=django_admin,
        actor_role=User.Role.ADMIN,
        action="security_event",
        entity_type="user",
        entity_id=str(django_admin.id),
    )
    request = RequestFactory().get("/admin/audit/activitylog/")
    request.user = django_admin
    model_admin = ActivityLogAdmin(ActivityLog, admin.site)

    assert model_admin.has_view_permission(request, log) is True
    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request, log) is False
    assert model_admin.has_delete_permission(request, log) is False

    client.force_login(django_admin)
    changelist = client.get("/admin/audit/activitylog/")
    detail = client.get(f"/admin/audit/activitylog/{log.id}/change/")
    add = client.get("/admin/audit/activitylog/add/")
    change = client.post(
        f"/admin/audit/activitylog/{log.id}/change/",
        {"action": "tampered"},
    )
    delete = client.post(f"/admin/audit/activitylog/{log.id}/delete/", {"post": "yes"})

    assert changelist.status_code == 200
    assert detail.status_code == 200
    assert add.status_code == 403
    assert change.status_code == 403
    assert delete.status_code == 403
    log.refresh_from_db()
    assert log.action == "security_event"


@pytest.mark.django_db
def test_audit_ip_ignores_untrusted_forwarding_header(rf):
    request = rf.get(
        "/api/probe",
        REMOTE_ADDR="203.0.113.40",
        HTTP_X_FORWARDED_FOR="198.51.100.25",
    )

    log_activity(request=request, action="ip_probe", entity_type="request")

    assert ActivityLog.objects.get(action="ip_probe").ip_address == "203.0.113.40"


@pytest.mark.django_db
@override_settings(TRUSTED_PROXY_CIDRS=("10.0.0.0/8",))
def test_audit_ip_uses_rightmost_untrusted_address_from_trusted_proxy_chain(rf):
    request = rf.get(
        "/api/probe",
        REMOTE_ADDR="10.0.0.8",
        HTTP_X_FORWARDED_FOR="192.0.2.200, 198.51.100.25, 10.1.2.3",
    )

    log_activity(request=request, action="trusted_ip_probe", entity_type="request")

    # The left-most value can be attacker-supplied.  The right-most untrusted
    # hop is the address accepted by the trusted reverse-proxy boundary.
    assert ActivityLog.objects.get(action="trusted_ip_probe").ip_address == "198.51.100.25"


@pytest.mark.django_db
@override_settings(TRUSTED_PROXY_CIDRS=("10.0.0.0/8", "not-a-network"))
@pytest.mark.parametrize(
    "remote_address,forwarded_for,expected",
    [
        ("10.0.0.8", "not-an-ip, 198.51.100.25", "10.0.0.8"),
        ("10.0.0.8", "198.51.100.25,", "10.0.0.8"),
        ("not-an-ip", "198.51.100.25", None),
        ("10.0.0.8", ",".join(["198.51.100.25"] * 33), "10.0.0.8"),
        ("10.0.0.8", "1" * 2049, "10.0.0.8"),
    ],
)
def test_malformed_or_oversized_forwarding_data_cannot_break_audit_logging(
    rf,
    remote_address,
    forwarded_for,
    expected,
):
    request = rf.get(
        "/api/probe",
        REMOTE_ADDR=remote_address,
        HTTP_X_FORWARDED_FOR=forwarded_for,
    )

    log_activity(request=request, action="malformed_ip_probe", entity_type="request")

    assert ActivityLog.objects.get(action="malformed_ip_probe").ip_address == expected


@pytest.mark.django_db
def test_audit_failure_policy_is_fail_open_by_default_and_explicitly_fail_closed_for_durable_events(monkeypatch):
    def audit_unavailable(**_kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(ActivityLog.objects, "create", audit_unavailable)

    log_activity(action="ordinary_read_audit", entity_type="request")
    with pytest.raises(RuntimeError, match="audit unavailable"):
        log_activity(
            action="security_lifecycle_audit",
            entity_type="user",
            raise_on_error=True,
        )


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
            "billing": {
                "description": "Clinical audit treatment",
                "total_amount": "90.00",
                "currency": "SYP",
                "note": "Invoice after clinical audit",
            },
        },
        format="json",
    )
    visit_handoff = completion.data["created_handoff"]
    staff_client.post(f"/api/billing-handoffs/{visit_handoff['id']}/invoices/", {"amount": "90.00"}, format="json")

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
        "invoice_issued",
    }
    assert expected.issubset(actions)

    metadata_text = str(list(ActivityLog.objects.values_list("metadata_json", flat=True)))
    assert "secret-password" not in metadata_text
    assert "Sensitive diagnosis body" not in metadata_text
    assert "Sensitive clinical body" not in metadata_text
    assert "patient-name.png" not in metadata_text
    assert "/media/" not in metadata_text
    assert "\\" not in metadata_text
