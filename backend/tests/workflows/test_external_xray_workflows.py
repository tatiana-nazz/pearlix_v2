import pytest
from io import BytesIO
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.accounts.management.commands.seed_demo_clinic_story import XRAY_PNG_BYTES

_jpeg = BytesIO()
Image.new("L", (32, 16), 100).save(_jpeg, format="JPEG")
XRAY_JPEG_BYTES = _jpeg.getvalue()

from apps.xrays.models import ExternalXrayCase


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def upload_file(name="external.png", content_type="image/png"):
    return SimpleUploadedFile(name, XRAY_JPEG_BYTES if content_type == "image/jpeg" else XRAY_PNG_BYTES, content_type=content_type)


@pytest.mark.django_db
def test_wf_005_external_xray_admin_temporary_workflow(admin_client, active_visit):
    create_response = admin_client.post("/api/external-xrays/", {"file": upload_file()}, format="multipart")
    assert create_response.status_code == 201

    case_id = create_response.data["id"]
    run_response = admin_client.post(f"/api/external-xrays/{case_id}/run-ai/")
    result_response = admin_client.get(f"/api/external-xrays/{case_id}/ai-result/")
    attach_response = admin_client.post(
        f"/api/external-xrays/{case_id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id},
        format="json",
    )
    discard_response = admin_client.post(f"/api/external-xrays/{case_id}/discard/")

    assert run_response.status_code == 200
    assert result_response.status_code == 200
    assert result_response.data["disclaimer"] == "Research-only AI assistance. Not a clinical diagnosis."
    assert attach_response.status_code == 403
    assert discard_response.status_code == 200
    assert discard_response.data["status"] == ExternalXrayCase.Status.DISCARDED


@pytest.mark.django_db
def test_wf_006_external_xray_doctor_attach_workflow(doctor_client, active_visit):
    create_response = doctor_client.post("/api/external-xrays/", {"file": upload_file("doctor-external.jpg", "image/jpeg")}, format="multipart")
    assert create_response.status_code == 201

    case_id = create_response.data["id"]
    run_response = doctor_client.post(f"/api/external-xrays/{case_id}/run-ai/")
    result_response = doctor_client.get(f"/api/external-xrays/{case_id}/ai-result/")
    attach_response = doctor_client.post(
        f"/api/external-xrays/{case_id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": active_visit.id},
        format="json",
    )
    patient_xrays_response = doctor_client.get(f"/api/patients/{active_visit.patient_id}/xrays/")
    patient_ai_response = doctor_client.get(f"/api/patients/{active_visit.patient_id}/ai-results/")
    repeat_attach_response = doctor_client.post(
        f"/api/external-xrays/{case_id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id},
        format="json",
    )

    assert run_response.status_code == 200
    assert result_response.status_code == 200
    assert attach_response.status_code == 200
    assert attach_response.data["status"] == ExternalXrayCase.Status.ATTACHED_TO_PATIENT
    assert patient_xrays_response.data["count"] == 1
    assert patient_ai_response.data["count"] == 1
    assert repeat_attach_response.status_code == 409


@pytest.mark.django_db
def test_wf_007_staff_external_xray_denial_workflow(staff_client, external_xray_case_factory):
    external = external_xray_case_factory()

    assert staff_client.get("/api/external-xrays/").status_code == 403
    assert staff_client.post("/api/external-xrays/", {"file": upload_file()}, format="multipart").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/run-ai/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/attach-to-patient/", {"patient_id": 1}).status_code == 403
