import pytest
from io import BytesIO
from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.ai_results.models import AIResult
from apps.audit.models import ActivityLog
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.xrays.models import XrayAttachment
from apps.xrays.services import MAX_XRAY_SIZE_BYTES


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


from apps.accounts.management.commands.seed_demo_clinic_story import XRAY_PNG_BYTES

_jpeg_buffer = BytesIO()
Image.new("L", (32, 16), 128).save(_jpeg_buffer, format="JPEG")
XRAY_JPEG_BYTES = _jpeg_buffer.getvalue()


def upload_file(name="xray.png", content_type="image/png", content=None):
    payload = content if content is not None else (XRAY_JPEG_BYTES if content_type == "image/jpeg" else XRAY_PNG_BYTES)
    return SimpleUploadedFile(name, payload, content_type=content_type)


def other_doctor_visit(visit_factory, appointment_factory, other_doctor_user, patient_factory):
    patient = patient_factory(full_name="Other Doctor Patient", phone="0944000000")
    appointment = appointment_factory(
        patient=patient,
        doctor=other_doctor_user,
        status=Appointment.Status.ACTIVE,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )
    return visit_factory(appointment=appointment, status=Visit.Status.ACTIVE)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/visits/{visit_id}/xrays/"),
        ("get", "/api/xrays/"),
        ("get", "/api/xrays/{xray_id}/"),
        ("delete", "/api/xrays/{xray_id}/"),
        ("get", "/api/xrays/{xray_id}/file/"),
        ("post", "/api/xrays/{xray_id}/run-ai/"),
        ("get", "/api/xrays/{xray_id}/ai-result/"),
        ("get", "/api/xrays/{xray_id}/ai-overlay/"),
    ],
)
def test_unauthenticated_user_cannot_access_xray_endpoints(api_client, active_visit, xray_attachment_factory, ai_result_factory, method, path):
    xray = xray_attachment_factory()
    ai_result_factory(xray_attachment=xray)

    response = getattr(api_client, method)(
        path.format(visit_id=active_visit.id, xray_id=xray.id),
        {"file": upload_file()},
        format="multipart",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_doctor_can_upload_png_xray_to_own_active_visit(doctor_client, active_visit, doctor_user):
    response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {"file": upload_file("Ahmad Khaled xray.png"), "title": "Initial X-ray", "notes": "Baseline"},
        format="multipart",
    )

    assert response.status_code == 201
    xray = XrayAttachment.objects.get(id=response.data["id"])
    assert xray.patient_id == active_visit.patient_id
    assert xray.visit_id == active_visit.id
    assert xray.uploaded_by == doctor_user
    assert xray.content_type == "image/png"
    assert xray.original_file_name == "Ahmad Khaled xray.png"
    assert "Ahmad" not in xray.stored_file_name
    assert "Khaled" not in xray.stored_file_name
    assert "original_file" not in response.data
    assert "/media/" not in str(response.data)
    assert response.data["file_endpoint"] == f"/api/xrays/{xray.id}/file/"


@pytest.mark.django_db
def test_doctor_can_upload_xray_to_own_completed_visit(doctor_client, completed_visit):
    response = doctor_client.post(
        f"/api/visits/{completed_visit.id}/xrays/",
        {"file": upload_file("completed.jpeg", "image/jpeg")},
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["visit"]["id"] == completed_visit.id


@pytest.mark.django_db
def test_doctor_can_upload_jpg_to_patient_profile_with_visit_access(doctor_client, active_visit):
    response = doctor_client.post(
        f"/api/patients/{active_visit.patient_id}/xrays/",
        {"file": upload_file("profile.jpg", "image/jpeg"), "title": "Profile X-ray"},
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["patient"]["id"] == active_visit.patient_id
    assert response.data["visit"] is None
    assert response.data["content_type"] == "image/jpeg"


@pytest.mark.django_db
def test_doctor_cannot_upload_xray_to_another_doctors_visit(
    doctor_client,
    visit_factory,
    appointment_factory,
    other_doctor_user,
    patient_factory,
):
    visit = other_doctor_visit(visit_factory, appointment_factory, other_doctor_user, patient_factory)

    response = doctor_client.post(f"/api/visits/{visit.id}/xrays/", {"file": upload_file()}, format="multipart")

    assert response.status_code == 404
    assert not XrayAttachment.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_upload_xray(request, client_fixture, active_visit):
    client = request.getfixturevalue(client_fixture)

    response = client.post(f"/api/visits/{active_visit.id}/xrays/", {"file": upload_file()}, format="multipart")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert not XrayAttachment.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("name", "content_type"),
    [
        ("scan.png", "image/png"),
        ("scan.jpg", "image/jpeg"),
        ("scan.jpeg", "image/jpeg"),
    ],
)
def test_allowed_xray_file_extensions_are_accepted(doctor_client, active_visit, name, content_type):
    response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {"file": upload_file(name, content_type)},
        format="multipart",
    )

    assert response.status_code == 201


@pytest.mark.django_db
@pytest.mark.parametrize(
    "name",
    ["scan.pdf", "scan.svg", "scan.exe", "xray.jpg.exe", "xray.exe.jpg", "scan.zip", "scan"],
)
def test_rejected_xray_file_extensions_are_blocked(doctor_client, active_visit, name):
    response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {"file": upload_file(name, "application/octet-stream")},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.data["code"] == "UNSUPPORTED_FILE_TYPE"
    assert not XrayAttachment.objects.exists()


@pytest.mark.django_db
def test_missing_xray_file_is_rejected(doctor_client, active_visit):
    response = doctor_client.post(f"/api/visits/{active_visit.id}/xrays/", {"title": "No file"}, format="multipart")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "file" in response.data["details"]


@pytest.mark.django_db
def test_uploader_doctor_can_delete_saved_xray_ai_and_storage(
    doctor_client,
    xray_attachment_factory,
    ai_result_factory,
    django_capture_on_commit_callbacks,
):
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray)
    result.overlay_file.save("delete-overlay.png", ContentFile(b"overlay"), save=True)
    original_storage = xray.original_file.storage
    original_name = xray.original_file.name
    overlay_storage = result.overlay_file.storage
    overlay_name = result.overlay_file.name

    with django_capture_on_commit_callbacks(execute=True):
        response = doctor_client.delete(f"/api/xrays/{xray.id}/")

    assert response.status_code == 204
    assert not XrayAttachment.objects.filter(pk=xray.id).exists()
    assert not AIResult.objects.filter(pk=result.id).exists()
    assert not original_storage.exists(original_name)
    assert not overlay_storage.exists(overlay_name)
    audit = ActivityLog.objects.get(action="xray_deleted", entity_id=xray.id)
    assert audit.metadata_json == {
        "xray_id": xray.id,
        "patient_id": xray.patient_id,
        "visit_id": xray.visit_id,
        "uploaded_by_id": xray.uploaded_by_id,
        "had_ai_result": True,
    }


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_delete_saved_xray(request, client_fixture, xray_attachment_factory):
    client = request.getfixturevalue(client_fixture)
    xray = xray_attachment_factory()

    response = client.delete(f"/api/xrays/{xray.id}/")

    assert response.status_code == 403
    assert XrayAttachment.objects.filter(pk=xray.id).exists()


@pytest.mark.django_db
def test_other_doctor_cannot_delete_saved_xray(doctor_client, xray_attachment_factory, other_doctor_user):
    xray = xray_attachment_factory(uploaded_by=other_doctor_user)

    response = doctor_client.delete(f"/api/xrays/{xray.id}/")

    assert response.status_code == 403
    assert XrayAttachment.objects.filter(pk=xray.id).exists()


@pytest.mark.django_db
def test_processing_ai_blocks_saved_xray_delete(doctor_client, xray_attachment_factory, ai_result_factory):
    xray = xray_attachment_factory()
    result = ai_result_factory(xray_attachment=xray, status=AIResult.Status.PROCESSING, model_version="")

    response = doctor_client.delete(f"/api/xrays/{xray.id}/")

    assert response.status_code == 409
    assert response.data["code"] == "AI_ANALYSIS_IN_PROGRESS"
    assert XrayAttachment.objects.filter(pk=xray.id).exists()
    assert AIResult.objects.filter(pk=result.id).exists()


@pytest.mark.django_db
def test_oversized_xray_file_is_rejected(doctor_client, active_visit):
    response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {"file": upload_file("large.png", "image/png", b"x" * (MAX_XRAY_SIZE_BYTES + 1))},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.data["code"] == "FILE_TOO_LARGE"


@pytest.mark.django_db
def test_content_type_mismatch_is_rejected(doctor_client, active_visit):
    response = doctor_client.post(
        f"/api/visits/{active_visit.id}/xrays/",
        {"file": upload_file("mismatch.png", "application/pdf")},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.data["code"] == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.django_db
def test_saved_xray_list_detail_and_file_permissions(
    admin_client,
    staff_client,
    doctor_client,
    other_doctor_client,
    xray_attachment_factory,
):
    xray = xray_attachment_factory()

    for client in (admin_client, staff_client, doctor_client):
        list_response = client.get("/api/xrays/")
        detail_response = client.get(f"/api/xrays/{xray.id}/")
        file_response = client.get(f"/api/xrays/{xray.id}/file/")

        assert list_response.status_code == 200
        assert list_response.data["count"] == 1
        assert detail_response.status_code == 200
        assert "original_file" not in detail_response.data
        assert file_response.status_code == 200
        assert file_response["Content-Type"] == xray.content_type

    assert other_doctor_client.get("/api/xrays/").data["count"] == 1
    assert other_doctor_client.get(f"/api/xrays/{xray.id}/").status_code == 200
    assert other_doctor_client.get(f"/api/xrays/{xray.id}/file/").status_code == 200


@pytest.mark.django_db
def test_xray_filters_and_patient_profile_xray_list(
    admin_client,
    staff_client,
    doctor_client,
    api_client,
    active_visit,
    xray_attachment_factory,
):
    xray = xray_attachment_factory()

    assert admin_client.get(f"/api/xrays/?patient_id={active_visit.patient_id}").data["count"] == 1
    assert admin_client.get(f"/api/xrays/?visit_id={active_visit.id}").data["count"] == 1
    assert admin_client.get(f"/api/xrays/?uploaded_by={active_visit.doctor_id}").data["count"] == 1
    assert api_client.get(f"/api/patients/{active_visit.patient_id}/xrays/").status_code == 401

    for client in (admin_client, staff_client, doctor_client):
        response = client.get(f"/api/patients/{active_visit.patient_id}/xrays/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == xray.id


@pytest.mark.django_db
def test_doctor_patient_profile_xray_list_allows_patient_with_no_prior_relation(
    doctor_client,
    patient_factory,
):
    unrelated_patient = patient_factory(full_name="Unrelated Patient", phone="0977000000")

    response = doctor_client.get(f"/api/patients/{unrelated_patient.id}/xrays/")

    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.django_db
def test_connected_doctor_can_read_saved_xrays_from_another_doctor(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
    xray_attachment_factory,
):
    other_appointment = appointment_factory(
        patient=patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.COMPLETED)
    xray = xray_attachment_factory(
        patient=patient,
        visit=other_visit,
        uploaded_by=other_doctor_user,
        uploaded_file=upload_file("other-doctor.png", "image/png"),
        stored_file_name="other-doctor.png",
    )
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T11:00:00+03:00",
        end_datetime="2026-07-25T11:30:00+03:00",
    )

    patient_xrays_response = doctor_client.get(f"/api/patients/{patient.id}/xrays/")
    list_response = doctor_client.get(f"/api/xrays/?patient_id={patient.id}")
    detail_response = doctor_client.get(f"/api/xrays/{xray.id}/")
    file_response = doctor_client.get(f"/api/xrays/{xray.id}/file/")

    assert patient_xrays_response.status_code == 200
    assert patient_xrays_response.data["count"] == 1
    assert patient_xrays_response.data["results"][0]["id"] == xray.id
    assert list_response.status_code == 200
    assert list_response.data["count"] == 1
    assert detail_response.status_code == 200
    assert file_response.status_code == 200


@pytest.mark.django_db
def test_overlay_file_model_validation_requires_png(ai_result_factory, xray_attachment_factory):
    result = ai_result_factory(xray_attachment=xray_attachment_factory(), overlay_file=upload_file("overlay.jpg", "image/jpeg"))

    with pytest.raises(Exception):
        result.full_clean()
