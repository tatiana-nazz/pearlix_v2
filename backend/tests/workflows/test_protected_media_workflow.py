import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.ai_results.serializers import AI_DISCLAIMER_EN


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def upload_file(name="workflow-xray.png", content_type="image/png"):
    return SimpleUploadedFile(name, b"fake-image", content_type=content_type)


@pytest.mark.django_db
def test_wf_009_protected_media_access_workflow(api_client, staff_client, doctor_client, other_doctor_client, active_visit):
    upload_response = doctor_client.post(f"/api/visits/{active_visit.id}/xrays/", {"file": upload_file()}, format="multipart")
    assert upload_response.status_code == 201
    xray_id = upload_response.data["id"]

    anonymous_response = api_client.get(f"/api/xrays/{xray_id}/file/")
    staff_response = staff_client.get(f"/api/xrays/{xray_id}/file/")
    doctor_response = doctor_client.get(f"/api/xrays/{xray_id}/file/")
    unrelated_response = other_doctor_client.get(f"/api/xrays/{xray_id}/file/")
    ai_response = doctor_client.post(f"/api/xrays/{xray_id}/run-ai/")

    assert anonymous_response.status_code == 401
    assert staff_response.status_code == 200
    assert staff_response["Cache-Control"] == "no-store"
    assert doctor_response.status_code == 200
    assert unrelated_response.status_code == 200
    assert ai_response.status_code == 200
    assert ai_response.data["disclaimer"] == AI_DISCLAIMER_EN
