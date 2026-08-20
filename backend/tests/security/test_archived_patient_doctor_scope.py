from datetime import timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.ai_results.models import AIResult
from apps.billing.models import BillingHandoff
from apps.clinic.models import ClinicSettings
from apps.patients.selectors import (
    get_doctor_related_patients,
    get_doctor_upcoming_patients,
    get_patients_for_user,
)
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def _upload(name):
    return SimpleUploadedFile(name, b"phase-2.1-test-image", content_type="image/png")


def _ids(response):
    return {row["id"] for row in response.data["results"]}


@pytest.fixture
def archived_patient_projection_story(
    doctor_user,
    staff_user,
    patient_factory,
    appointment_factory,
    visit_factory,
    billing_handoff_factory,
):
    clinic_timezone = ZoneInfo(ClinicSettings.get_solo().timezone)
    now = timezone.localtime(timezone.now(), clinic_timezone).replace(
        hour=12,
        minute=0,
        second=0,
        microsecond=0,
    )
    archived_patient = patient_factory(
        first_name="ArchivedScope",
        last_name="Patient",
        phone_number="0902121001",
        is_archived=True,
    )
    visible_patient = patient_factory(
        first_name="VisibleScope",
        last_name="Patient",
        phone_number="0902121002",
    )

    completed_appointment = appointment_factory(
        patient=archived_patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime=now - timedelta(hours=3),
        end_datetime=now - timedelta(hours=2, minutes=30),
    )
    completed_visit = visit_factory(
        appointment=completed_appointment,
        status=Visit.Status.COMPLETED,
        started_at=now - timedelta(hours=3),
        completed_at=now - timedelta(hours=2, minutes=30),
    )
    archived_active_appointment = appointment_factory(
        patient=archived_patient,
        doctor=doctor_user,
        status=Appointment.Status.ACTIVE,
        start_datetime=now - timedelta(minutes=15),
        end_datetime=now + timedelta(minutes=15),
    )
    archived_active_visit = visit_factory(
        appointment=archived_active_appointment,
        status=Visit.Status.ACTIVE,
        started_at=now - timedelta(minutes=15),
    )
    archived_upcoming_appointment = appointment_factory(
        patient=archived_patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime=now + timedelta(hours=1),
        end_datetime=now + timedelta(hours=1, minutes=30),
    )
    visible_appointment = appointment_factory(
        patient=visible_patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime=now + timedelta(hours=2),
        end_datetime=now + timedelta(hours=2, minutes=30),
    )

    archived_handoff = billing_handoff_factory(
        patient=archived_patient,
        visit=completed_visit,
        doctor=doctor_user,
        origin=BillingHandoff.Origin.VISIT_COMPLETION,
        description="ArchivedScope completed treatment",
    )
    visible_handoff = billing_handoff_factory(
        patient=visible_patient,
        doctor=doctor_user,
        description="VisibleScope treatment",
    )

    archived_file = _upload("archived-saved-xray.png")
    archived_xray = XrayAttachment.objects.create(
        patient=archived_patient,
        visit=completed_visit,
        uploaded_by=doctor_user,
        source=XrayAttachment.Source.ACTIVE_VISIT,
        original_file=archived_file,
        stored_file_name="archived-saved-xray.png",
        original_file_name=archived_file.name,
        content_type=archived_file.content_type,
        size_bytes=archived_file.size,
        title="ArchivedScope saved X-ray",
    )
    archived_ai = AIResult.objects.create(
        xray_attachment=archived_xray,
        status=AIResult.Status.COMPLETED,
        result_summary="ArchivedScope saved AI result",
        overall_confidence=0.81,
        findings_json=[],
        model_version="phase-2.1-test-model",
        overlay_file=_upload("archived-saved-overlay.png"),
    )
    visible_file = _upload("visible-saved-xray.png")
    visible_xray = XrayAttachment.objects.create(
        patient=visible_patient,
        visit=None,
        uploaded_by=doctor_user,
        source=XrayAttachment.Source.PATIENT_PROFILE,
        original_file=visible_file,
        stored_file_name="visible-saved-xray.png",
        original_file_name=visible_file.name,
        content_type=visible_file.content_type,
        size_bytes=visible_file.size,
        title="VisibleScope saved X-ray",
    )
    visible_ai = AIResult.objects.create(
        xray_attachment=visible_xray,
        status=AIResult.Status.COMPLETED,
        result_summary="VisibleScope saved AI result",
        overall_confidence=0.82,
        findings_json=[],
        model_version="phase-2.1-test-model",
    )

    archived_external_file = _upload("archived-external-xray.png")
    archived_external = ExternalXrayCase.objects.create(
        uploaded_by=doctor_user,
        original_file=archived_external_file,
        stored_file_name="archived-external-xray.png",
        original_file_name=archived_external_file.name,
        content_type=archived_external_file.content_type,
        size_bytes=archived_external_file.size,
        title="ArchivedScope external X-ray",
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=archived_patient,
        attached_visit=completed_visit,
        attached_xray=archived_xray,
        attached_at=now,
    )
    archived_external_ai = AIResult.objects.create(
        external_xray_case=archived_external,
        status=AIResult.Status.COMPLETED,
        result_summary="ArchivedScope external AI result",
        overall_confidence=0.83,
        findings_json=[],
        model_version="phase-2.1-test-model",
        overlay_file=_upload("archived-external-overlay.png"),
    )
    visible_external_file = _upload("visible-external-xray.png")
    visible_external = ExternalXrayCase.objects.create(
        uploaded_by=doctor_user,
        original_file=visible_external_file,
        stored_file_name="visible-external-xray.png",
        original_file_name=visible_external_file.name,
        content_type=visible_external_file.content_type,
        size_bytes=visible_external_file.size,
        title="VisibleScope external X-ray",
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=visible_patient,
        attached_xray=visible_xray,
        attached_at=now,
    )
    temporary_external_file = _upload("temporary-external-xray.png")
    temporary_external = ExternalXrayCase.objects.create(
        uploaded_by=doctor_user,
        original_file=temporary_external_file,
        stored_file_name="temporary-external-xray.png",
        original_file_name=temporary_external_file.name,
        content_type=temporary_external_file.content_type,
        size_bytes=temporary_external_file.size,
        title="Temporary external X-ray",
        status=ExternalXrayCase.Status.TEMPORARY,
    )

    return {
        "archived_patient": archived_patient,
        "visible_patient": visible_patient,
        "completed_appointment": completed_appointment,
        "completed_visit": completed_visit,
        "archived_active_appointment": archived_active_appointment,
        "archived_active_visit": archived_active_visit,
        "archived_upcoming_appointment": archived_upcoming_appointment,
        "visible_appointment": visible_appointment,
        "archived_handoff": archived_handoff,
        "visible_handoff": visible_handoff,
        "archived_xray": archived_xray,
        "archived_ai": archived_ai,
        "visible_xray": visible_xray,
        "visible_ai": visible_ai,
        "archived_external": archived_external,
        "archived_external_ai": archived_external_ai,
        "visible_external": visible_external,
        "temporary_external": temporary_external,
    }


@pytest.mark.django_db
def test_doctor_appointment_and_patient_selectors_hide_archived_patient_everywhere(
    doctor_client,
    admin_client,
    staff_client,
    doctor_user,
    archived_patient_projection_story,
):
    story = archived_patient_projection_story
    archived_patient = story["archived_patient"]
    archived_appointment_ids = {
        story["completed_appointment"].id,
        story["archived_active_appointment"].id,
        story["archived_upcoming_appointment"].id,
    }

    assert archived_patient.id not in set(get_patients_for_user(doctor_user).values_list("id", flat=True))
    assert archived_patient.id not in set(get_doctor_related_patients(doctor_user).values_list("id", flat=True))
    assert archived_patient.id not in set(get_doctor_upcoming_patients(doctor_user).values_list("id", flat=True))

    unfiltered = doctor_client.get("/api/appointments/")
    assert unfiltered.status_code == 200
    assert story["visible_appointment"].id in _ids(unfiltered)
    assert not archived_appointment_ids.intersection(_ids(unfiltered))

    clinic_timezone = ZoneInfo(ClinicSettings.get_solo().timezone)
    clinic_date = timezone.localtime(timezone.now(), clinic_timezone).date().isoformat()
    filter_requests = (
        {"patient_id": archived_patient.id},
        {"status": Appointment.Status.UPCOMING, "patient_id": archived_patient.id},
        {"date": clinic_date, "patient_id": archived_patient.id},
        {
            "start_from": (timezone.now() - timedelta(days=1)).isoformat(),
            "start_to": (timezone.now() + timedelta(days=1)).isoformat(),
            "patient_id": archived_patient.id,
        },
        {"search": "ArchivedScope"},
    )
    for params in filter_requests:
        response = doctor_client.get("/api/appointments/", params)
        assert response.status_code == 200
        assert response.data["count"] == 0

    assert doctor_client.get(f"/api/appointments/{story['completed_appointment'].id}/").status_code == 404
    assert doctor_client.get(f"/api/patients/{archived_patient.id}/appointments/").status_code == 404
    assert doctor_client.get(f"/api/patients/{archived_patient.id}/visits/").status_code == 404
    assert doctor_client.get(f"/api/patients/{archived_patient.id}/xrays/").status_code == 404
    assert doctor_client.get(f"/api/patients/{archived_patient.id}/ai-results/").status_code == 404

    for client in (admin_client, staff_client):
        historical_list = client.get("/api/appointments/", {"patient_id": archived_patient.id})
        assert historical_list.status_code == 200
        assert archived_appointment_ids == _ids(historical_list)
        assert client.get(f"/api/appointments/{story['completed_appointment'].id}/").status_code == 200
        assert client.get(f"/api/patients/{archived_patient.id}/appointments/").status_code == 200


@pytest.mark.django_db
def test_doctor_dashboard_and_billing_exclude_archived_patient_projections(
    doctor_client,
    admin_client,
    staff_client,
    archived_patient_projection_story,
):
    story = archived_patient_projection_story
    archived_patient = story["archived_patient"]

    dashboard = doctor_client.get("/api/dashboard/doctor/")
    assert dashboard.status_code == 200
    assert dashboard.data["today_appointments_count"] == 1
    assert dashboard.data["today_appointments"][0]["id"] == story["visible_appointment"].id
    assert dashboard.data["own_active_visit"] is None
    assert dashboard.data["completed_today_count"] == 0
    assert "ArchivedScope" not in str(dashboard.data)

    handoff_list = doctor_client.get("/api/billing-handoffs/")
    assert handoff_list.status_code == 200
    assert _ids(handoff_list) == {story["visible_handoff"].id}
    for params in (
        {"patient_id": archived_patient.id},
        {"visit_id": story["completed_visit"].id},
        {"search": "ArchivedScope"},
    ):
        response = doctor_client.get("/api/billing-handoffs/", params)
        assert response.status_code == 200
        assert response.data["count"] == 0
    assert doctor_client.get(f"/api/billing-handoffs/{story['archived_handoff'].id}/").status_code == 404

    summary = doctor_client.get("/api/billing-handoffs/summary/")
    assert summary.status_code == 200
    assert summary.data["open_count"] == 1
    assert summary.data["status_counts"][BillingHandoff.Status.OPEN] == 1
    archived_summary = doctor_client.get(
        "/api/billing-handoffs/summary/",
        {"patient_id": archived_patient.id},
    )
    assert archived_summary.status_code == 200
    assert archived_summary.data["open_count"] == 0

    for client in (admin_client, staff_client):
        historical_list = client.get("/api/billing-handoffs/", {"patient_id": archived_patient.id})
        assert historical_list.status_code == 200
        assert _ids(historical_list) == {story["archived_handoff"].id}
        assert client.get(f"/api/billing-handoffs/{story['archived_handoff'].id}/").status_code == 200


@pytest.mark.django_db
def test_doctor_saved_and_external_xray_scopes_hide_archived_patient_direct_ids_and_files(
    doctor_client,
    admin_client,
    staff_client,
    archived_patient_projection_story,
):
    story = archived_patient_projection_story
    archived_patient = story["archived_patient"]

    xray_list = doctor_client.get("/api/xrays/")
    assert xray_list.status_code == 200
    assert _ids(xray_list) == {story["visible_xray"].id}
    archived_filter = doctor_client.get("/api/xrays/", {"patient_id": archived_patient.id})
    assert archived_filter.status_code == 200
    assert archived_filter.data["count"] == 0

    archived_xray_id = story["archived_xray"].id
    for method, path in (
        ("get", f"/api/xrays/{archived_xray_id}/"),
        ("get", f"/api/xrays/{archived_xray_id}/file/"),
        ("get", f"/api/xrays/{archived_xray_id}/ai-result/"),
        ("get", f"/api/xrays/{archived_xray_id}/ai-overlay/"),
        ("post", f"/api/xrays/{archived_xray_id}/run-ai/"),
        ("delete", f"/api/xrays/{archived_xray_id}/"),
    ):
        assert getattr(doctor_client, method)(path).status_code == 404
    assert doctor_client.get(f"/api/xrays/{story['visible_xray'].id}/ai-result/").status_code == 200

    external_list = doctor_client.get("/api/external-xrays/")
    assert external_list.status_code == 200
    assert _ids(external_list) == {
        story["visible_external"].id,
        story["temporary_external"].id,
    }
    attached_list = doctor_client.get(
        "/api/external-xrays/",
        {"status": ExternalXrayCase.Status.ATTACHED_TO_PATIENT},
    )
    assert _ids(attached_list) == {story["visible_external"].id}

    archived_external_id = story["archived_external"].id
    for method, path in (
        ("get", f"/api/external-xrays/{archived_external_id}/"),
        ("get", f"/api/external-xrays/{archived_external_id}/file/"),
        ("get", f"/api/external-xrays/{archived_external_id}/ai-result/"),
        ("get", f"/api/external-xrays/{archived_external_id}/ai-overlay/"),
        ("post", f"/api/external-xrays/{archived_external_id}/run-ai/"),
        ("post", f"/api/external-xrays/{archived_external_id}/discard/"),
    ):
        assert getattr(doctor_client, method)(path).status_code == 404

    for client in (admin_client, staff_client):
        historical_xrays = client.get("/api/xrays/", {"patient_id": archived_patient.id})
        assert historical_xrays.status_code == 200
        assert _ids(historical_xrays) == {archived_xray_id}
        assert client.get(f"/api/xrays/{archived_xray_id}/").status_code == 200
        assert client.get(f"/api/xrays/{archived_xray_id}/file/").status_code == 200
        assert client.get(f"/api/xrays/{archived_xray_id}/ai-result/").status_code == 200
        assert client.get(f"/api/xrays/{archived_xray_id}/ai-overlay/").status_code == 200

    assert admin_client.get(f"/api/external-xrays/{archived_external_id}/").status_code == 200
    assert admin_client.get(f"/api/external-xrays/{archived_external_id}/file/").status_code == 200
    assert admin_client.get(f"/api/external-xrays/{archived_external_id}/ai-result/").status_code == 200
    assert admin_client.get(f"/api/external-xrays/{archived_external_id}/ai-overlay/").status_code == 200


@pytest.mark.django_db
def test_doctor_cannot_attach_external_case_to_archived_patient_or_archived_visit(
    doctor_client,
    archived_patient_projection_story,
):
    story = archived_patient_projection_story
    temporary_external = story["temporary_external"]

    patient_response = doctor_client.post(
        f"/api/external-xrays/{temporary_external.id}/attach-to-patient/",
        {"patient_id": story["archived_patient"].id},
        format="json",
    )
    visit_response = doctor_client.post(
        f"/api/external-xrays/{temporary_external.id}/attach-to-patient/",
        {
            "patient_id": story["visible_patient"].id,
            "visit_id": story["completed_visit"].id,
        },
        format="json",
    )

    assert patient_response.status_code == 404
    assert visit_response.status_code == 404
    temporary_external.refresh_from_db()
    assert temporary_external.status == ExternalXrayCase.Status.TEMPORARY
    assert temporary_external.attached_patient_id is None
