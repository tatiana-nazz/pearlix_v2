import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.ai_results.models import AIResult
from apps.ai_results.serializers import AI_DISCLAIMER_EN
from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def overlay_file(name="overlay.png", content_type="image/png"):
    return SimpleUploadedFile(name, b"overlay-bytes", content_type=content_type)


def set_ai_mode(mode):
    settings = ClinicSettings.get_solo()
    settings.ai_mode = mode
    settings.save(update_fields=["ai_mode", "updated_at"])
    return settings


@pytest.mark.django_db
def test_doctor_can_run_ai_on_own_xray_and_result_has_required_shape(doctor_client, xray_attachment_factory):
    xray = xray_attachment_factory()

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 200
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1
    assert response.data["status"] == AIResult.Status.COMPLETED
    assert response.data["result_summary"] == "Research-only AI analysis completed."
    assert response.data["overall_confidence"] == 0.74
    assert response.data["findings"][0]["fdi_tooth_id"] == "36"
    assert response.data["model_version"] == "pearlix-mock-xray-v1"
    assert response.data["disclaimer"] == AI_DISCLAIMER_EN
    assert "overlay_file" not in response.data


@pytest.mark.django_db
def test_ai_run_updates_existing_result_instead_of_creating_duplicate(doctor_client, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray, result_summary="Old")

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    result.refresh_from_db()
    assert response.status_code == 200
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1
    assert result.result_summary == "Research-only AI analysis completed."


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_run_ai(request, client_fixture, xray_attachment_factory):
    client = request.getfixturevalue(client_fixture)
    xray = xray_attachment_factory()

    response = client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert not AIResult.objects.exists()


@pytest.mark.django_db
def test_other_doctor_can_run_ai_on_saved_xray_for_active_patient(other_doctor_client, xray_attachment_factory):
    xray = xray_attachment_factory()

    response = other_doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 200
    assert AIResult.objects.filter(xray_attachment=xray).exists()


@pytest.mark.django_db
def test_ai_run_does_not_modify_clinical_or_status_data(doctor_client, active_visit, xray_attachment_factory):
    active_visit.diagnosis = "Original diagnosis"
    active_visit.treatment = "Original treatment"
    active_visit.clinical_notes = "Original notes"
    active_visit.save(update_fields=["diagnosis", "treatment", "clinical_notes", "updated_at"])
    appointment = active_visit.appointment
    xray = xray_attachment_factory(visit=active_visit, patient=active_visit.patient, uploaded_by=active_visit.doctor)

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    active_visit.refresh_from_db()
    appointment.refresh_from_db()
    assert response.status_code == 200
    assert active_visit.diagnosis == "Original diagnosis"
    assert active_visit.treatment == "Original treatment"
    assert active_visit.clinical_notes == "Original notes"
    assert active_visit.status == Visit.Status.ACTIVE
    assert appointment.status == appointment.Status.ACTIVE


@pytest.mark.django_db
@pytest.mark.parametrize("ai_mode", [ClinicSettings.AiMode.DJANGO_INTERNAL, ClinicSettings.AiMode.SEPARATE_SERVICE])
def test_saved_xray_ai_run_requires_mock_adapter_and_does_not_mutate_state(
    doctor_client,
    active_visit,
    xray_attachment_factory,
    ai_result_factory,
    ai_mode,
):
    set_ai_mode(ai_mode)
    active_visit.diagnosis = "Original diagnosis"
    active_visit.treatment = "Original treatment"
    active_visit.clinical_notes = "Original notes"
    active_visit.save(update_fields=["diagnosis", "treatment", "clinical_notes", "updated_at"])
    appointment = active_visit.appointment
    xray = xray_attachment_factory(visit=active_visit, patient=active_visit.patient, uploaded_by=active_visit.doctor)
    result = ai_result_factory(xray_attachment=xray, result_summary="Existing result")
    before_result_updated_at = result.updated_at

    response = doctor_client.post(f"/api/xrays/{xray.id}/run-ai/")

    assert response.status_code == 503
    assert response.data["code"] == "AI_SERVICE_NOT_CONFIGURED"
    assert AIResult.objects.filter(xray_attachment=xray).count() == 1
    result.refresh_from_db()
    active_visit.refresh_from_db()
    appointment.refresh_from_db()
    assert result.result_summary == "Existing result"
    assert result.updated_at == before_result_updated_at
    assert active_visit.diagnosis == "Original diagnosis"
    assert active_visit.treatment == "Original treatment"
    assert active_visit.clinical_notes == "Original notes"
    assert active_visit.status == Visit.Status.ACTIVE
    assert appointment.status == Appointment.Status.ACTIVE
    assert BillingHandoff.objects.count() == 0
    assert Invoice.objects.count() == 0


@pytest.mark.django_db
def test_admin_staff_and_doctor_can_read_ai_result(admin_client, staff_client, doctor_client, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    ai_result_factory(xray_attachment=xray)

    for client in (admin_client, staff_client, doctor_client):
        response = client.get(f"/api/xrays/{xray.id}/ai-result/")
        assert response.status_code == 200
        assert response.data["disclaimer"] == AI_DISCLAIMER_EN
        assert response.data["xray_attachment"]["id"] == xray.id


@pytest.mark.django_db
def test_other_doctor_can_read_ai_result_for_active_patient(other_doctor_client, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    ai_result_factory(xray_attachment=xray)

    response = other_doctor_client.get(f"/api/xrays/{xray.id}/ai-result/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_missing_ai_result_returns_unavailable_code(doctor_client, xray_attachment_factory):
    xray = xray_attachment_factory()

    response = doctor_client.get(f"/api/xrays/{xray.id}/ai-result/")

    assert response.status_code == 404
    assert response.data["code"] == "AI_RESULT_UNAVAILABLE"


@pytest.mark.django_db
def test_patient_ai_results_endpoint_returns_results_by_patient(admin_client, staff_client, doctor_client, api_client, active_visit, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray)

    assert api_client.get(f"/api/patients/{active_visit.patient_id}/ai-results/").status_code == 401
    for client in (admin_client, staff_client, doctor_client):
        response = client.get(f"/api/patients/{active_visit.patient_id}/ai-results/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == result.id
        assert response.data["results"][0]["disclaimer"] == AI_DISCLAIMER_EN
        assert "overlay_file" not in response.data["results"][0]


@pytest.mark.django_db
def test_patient_ai_results_doctor_scope_allows_active_patient_with_no_prior_relation(doctor_client, patient_factory):
    patient = patient_factory(full_name="No AI Patient", phone="0988000000")

    response = doctor_client.get(f"/api/patients/{patient.id}/ai-results/")

    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.django_db
def test_ai_overlay_endpoint_requires_result_and_overlay(doctor_client, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    ai_result_factory(xray_attachment=xray)

    response = doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/")

    assert response.status_code == 404
    assert response.data["code"] == "AI_RESULT_UNAVAILABLE"


@pytest.mark.django_db
def test_ai_overlay_endpoint_is_protected_and_permission_checked(
    api_client,
    staff_client,
    doctor_client,
    other_doctor_client,
    xray_attachment_factory,
    ai_result_factory,
):
    xray = xray_attachment_factory()
    ai_result_factory(xray_attachment=xray, overlay_file=overlay_file())

    assert api_client.get(f"/api/xrays/{xray.id}/ai-overlay/").status_code == 401
    staff_response = staff_client.get(f"/api/xrays/{xray.id}/ai-overlay/")
    doctor_response = doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/")
    other_response = other_doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/")

    assert staff_response.status_code == 200
    assert staff_response["Content-Type"] == "image/png"
    assert doctor_response.status_code == 200
    assert other_response.status_code == 200


@pytest.mark.django_db
def test_connected_doctor_can_read_saved_ai_results_and_overlay_from_another_doctor(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
    xray_attachment_factory,
    ai_result_factory,
):
    other_appointment = appointment_factory(
        patient=patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.COMPLETED)
    xray = xray_attachment_factory(patient=patient, visit=other_visit, uploaded_by=other_doctor_user)
    result = ai_result_factory(xray_attachment=xray, overlay_file=overlay_file())
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T11:00:00+03:00",
        end_datetime="2026-07-25T11:30:00+03:00",
    )

    patient_ai_response = doctor_client.get(f"/api/patients/{patient.id}/ai-results/")
    xray_ai_response = doctor_client.get(f"/api/xrays/{xray.id}/ai-result/")
    overlay_response = doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/")

    assert patient_ai_response.status_code == 200
    assert patient_ai_response.data["count"] == 1
    assert patient_ai_response.data["results"][0]["id"] == result.id
    assert xray_ai_response.status_code == 200
    assert xray_ai_response.data["id"] == result.id
    assert overlay_response.status_code == 200
    assert overlay_response["Content-Type"] == "image/png"
