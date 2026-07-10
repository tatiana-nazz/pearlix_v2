from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.ai_results.models import AIResult


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def overlay_file(name="overlay.png"):
    return SimpleUploadedFile(name, b"overlay-bytes", content_type="image/png")


def assert_protected_headers(response, content_type):
    assert response.status_code == 200
    assert response["Content-Type"] == content_type
    assert response["Cache-Control"] == "no-store"
    assert response["Pragma"] == "no-cache"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "\\" not in response["Content-Disposition"]
    assert "/media/" not in response["Content-Disposition"]


@pytest.mark.django_db
def test_saved_xray_file_protected_headers_permissions_and_missing_file(
    api_client,
    staff_client,
    doctor_client,
    other_doctor_client,
    xray_attachment_factory,
):
    xray = xray_attachment_factory()

    assert api_client.get(f"/api/xrays/{xray.id}/file/").status_code == 401
    assert other_doctor_client.get(f"/api/xrays/{xray.id}/file/").status_code == 200
    assert_protected_headers(staff_client.get(f"/api/xrays/{xray.id}/file/"), xray.content_type)
    assert_protected_headers(doctor_client.get(f"/api/xrays/{xray.id}/file/"), xray.content_type)

    missing = xray_attachment_factory(uploaded_file=SimpleUploadedFile("missing.png", b"missing", content_type="image/png"), stored_file_name="missing-xray.png")
    missing_path = Path(missing.original_file.path)
    missing_path.unlink()
    missing_response = doctor_client.get(f"/api/xrays/{missing.id}/file/")
    assert missing_response.status_code == 404
    assert missing_response.data["code"] == "NOT_FOUND"
    assert str(missing_path) not in str(missing_response.data)


@pytest.mark.django_db
def test_saved_ai_overlay_protected_headers_and_permissions(
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
    assert other_doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/").status_code == 200
    assert_protected_headers(staff_client.get(f"/api/xrays/{xray.id}/ai-overlay/"), "image/png")
    assert_protected_headers(doctor_client.get(f"/api/xrays/{xray.id}/ai-overlay/"), "image/png")


@pytest.mark.django_db
def test_external_xray_file_and_overlay_protected_headers_permissions_and_missing_file(
    api_client,
    admin_client,
    staff_client,
    doctor_client,
    other_doctor_client,
    external_xray_case_factory,
    ai_result_factory,
):
    external = external_xray_case_factory()
    ai_result_factory(external_xray_case=external, overlay_file=overlay_file())

    assert api_client.get(f"/api/external-xrays/{external.id}/file/").status_code == 401
    assert staff_client.get(f"/api/external-xrays/{external.id}/file/").status_code == 403
    assert other_doctor_client.get(f"/api/external-xrays/{external.id}/file/").status_code == 404
    assert_protected_headers(admin_client.get(f"/api/external-xrays/{external.id}/file/"), external.content_type)
    assert_protected_headers(doctor_client.get(f"/api/external-xrays/{external.id}/file/"), external.content_type)

    assert api_client.get(f"/api/external-xrays/{external.id}/ai-overlay/").status_code == 401
    assert staff_client.get(f"/api/external-xrays/{external.id}/ai-overlay/").status_code == 403
    assert other_doctor_client.get(f"/api/external-xrays/{external.id}/ai-overlay/").status_code == 404
    assert_protected_headers(admin_client.get(f"/api/external-xrays/{external.id}/ai-overlay/"), "image/png")
    assert_protected_headers(doctor_client.get(f"/api/external-xrays/{external.id}/ai-overlay/"), "image/png")

    missing = external_xray_case_factory(
        uploaded_file=SimpleUploadedFile("missing-external.png", b"missing", content_type="image/png"),
        stored_file_name="missing-external.png",
    )
    missing_path = Path(missing.original_file.path)
    missing_path.unlink()
    missing_response = doctor_client.get(f"/api/external-xrays/{missing.id}/file/")
    assert missing_response.status_code == 404
    assert missing_response.data["code"] == "NOT_FOUND"
    assert str(missing_path) not in str(missing_response.data)
