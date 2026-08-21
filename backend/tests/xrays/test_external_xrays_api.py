import pytest
from io import BytesIO
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.ai_results.models import AIResult
from apps.ai_results.serializers import AI_DISCLAIMER_EN
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.xrays.services import MAX_XRAY_SIZE_BYTES


@pytest.fixture(autouse=True)
def temp_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


from apps.accounts.management.commands.seed_demo_clinic_story import XRAY_PNG_BYTES

_jpeg_buffer = BytesIO()
Image.new("L", (32, 16), 128).save(_jpeg_buffer, format="JPEG")
XRAY_JPEG_BYTES = _jpeg_buffer.getvalue()


def upload_file(name="external.png", content_type="image/png", content=None):
    payload = content if content is not None else (XRAY_JPEG_BYTES if content_type == "image/jpeg" else XRAY_PNG_BYTES)
    return SimpleUploadedFile(name, payload, content_type=content_type)


def set_ai_mode(mode):
    settings = ClinicSettings.get_solo()
    settings.ai_mode = mode
    settings.save(update_fields=["ai_mode", "updated_at"])
    return settings


def make_patient_visit(appointment_factory, visit_factory, patient, doctor, status=Visit.Status.COMPLETED, start="2026-07-20T12:00:00+03:00"):
    appointment_status = Appointment.Status.ACTIVE if status == Visit.Status.ACTIVE else Appointment.Status.COMPLETED
    hour = start[11:13]
    minute = start[14:16]
    end_hour = f"{int(hour):02}"
    end_minute = "30" if minute == "00" else "59"
    appointment = appointment_factory(
        patient=patient,
        doctor=doctor,
        status=appointment_status,
        start_datetime=start,
        end_datetime=f"{start[:11]}{end_hour}:{end_minute}:00{start[19:]}",
    )
    return visit_factory(appointment=appointment, status=status)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/external-xrays/"),
        ("get", "/api/external-xrays/"),
        ("get", "/api/external-xrays/{id}/"),
        ("get", "/api/external-xrays/{id}/file/"),
        ("post", "/api/external-xrays/{id}/run-ai/"),
        ("get", "/api/external-xrays/{id}/ai-result/"),
        ("get", "/api/external-xrays/{id}/ai-overlay/"),
        ("post", "/api/external-xrays/{id}/discard/"),
        ("post", "/api/external-xrays/{id}/attach-to-patient/"),
    ],
)
def test_unauthenticated_user_cannot_access_external_xray_endpoints(api_client, external_xray_case_factory, method, path):
    external = external_xray_case_factory()

    response = getattr(api_client, method)(
        path.format(id=external.id),
        {"file": upload_file(), "patient_id": external.uploaded_by_id},
        format="multipart",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "doctor_client"])
def test_admin_and_doctor_can_upload_external_xray(request, client_fixture):
    client = request.getfixturevalue(client_fixture)

    response = client.post(
        "/api/external-xrays/",
        {"file": upload_file("temporary.png"), "title": "Temporary case", "notes": "Research only"},
        format="multipart",
    )

    assert response.status_code == 201
    external = ExternalXrayCase.objects.get(id=response.data["id"])
    assert external.status == ExternalXrayCase.Status.TEMPORARY
    assert external.original_file_name == "temporary.png"
    assert "temporary" not in external.stored_file_name
    assert "original_file" not in response.data
    assert "/media/" not in str(response.data)
    assert response.data["file_endpoint"] == f"/api/external-xrays/{external.id}/file/"


@pytest.mark.django_db
def test_staff_cannot_access_external_workspace(staff_client, external_xray_case_factory):
    external = external_xray_case_factory()

    assert staff_client.get("/api/external-xrays/").status_code == 403
    assert staff_client.post("/api/external-xrays/", {"file": upload_file()}, format="multipart").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/file/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/run-ai/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/ai-result/").status_code == 403
    assert staff_client.get(f"/api/external-xrays/{external.id}/ai-overlay/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/discard/").status_code == 403
    assert staff_client.post(f"/api/external-xrays/{external.id}/attach-to-patient/", {}).status_code == 403


@pytest.mark.django_db
def test_admin_can_list_read_and_access_external_file(admin_client, external_xray_case_factory):
    external = external_xray_case_factory()

    list_response = admin_client.get("/api/external-xrays/")
    detail_response = admin_client.get(f"/api/external-xrays/{external.id}/")
    file_response = admin_client.get(f"/api/external-xrays/{external.id}/file/")

    assert list_response.status_code == 200
    assert list_response.data["count"] == 1
    assert detail_response.status_code == 200
    assert detail_response.data["id"] == external.id
    assert "original_file" not in detail_response.data
    assert file_response.status_code == 200
    assert file_response["Content-Type"] == external.content_type


@pytest.mark.django_db
def test_doctor_can_list_and_read_own_external_cases_only(
    doctor_client,
    other_doctor_client,
    doctor_user,
    other_doctor_user,
    external_xray_case_factory,
):
    own = external_xray_case_factory(uploaded_by=doctor_user)
    other = external_xray_case_factory(uploaded_by=other_doctor_user, stored_file_name="other-external.png")

    list_response = doctor_client.get("/api/external-xrays/")
    own_response = doctor_client.get(f"/api/external-xrays/{own.id}/")
    other_response = doctor_client.get(f"/api/external-xrays/{other.id}/")
    other_file_response = doctor_client.get(f"/api/external-xrays/{other.id}/file/")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data["results"]] == [own.id]
    assert own_response.status_code == 200
    assert other_response.status_code == 404
    assert other_file_response.status_code == 404
    assert other_doctor_client.get(f"/api/external-xrays/{own.id}/").status_code == 404


@pytest.mark.django_db
def test_external_case_filters(admin_client, doctor_user, other_doctor_user, external_xray_case_factory):
    own = external_xray_case_factory(uploaded_by=doctor_user, status=ExternalXrayCase.Status.TEMPORARY)
    external_xray_case_factory(uploaded_by=other_doctor_user, status=ExternalXrayCase.Status.DISCARDED, stored_file_name="discarded.png")

    assert admin_client.get(f"/api/external-xrays/?status={ExternalXrayCase.Status.TEMPORARY}").data["count"] == 1
    assert admin_client.get(f"/api/external-xrays/?uploaded_by={doctor_user.id}").data["results"][0]["id"] == own.id
    assert admin_client.get("/api/external-xrays/?created_from=2020-01-01T00:00:00Z").data["count"] == 2
    assert admin_client.get("/api/external-xrays/?created_to=2099-01-01T00:00:00Z").data["count"] == 2


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("name", "content_type"),
    [
        ("scan.png", "image/png"),
        ("scan.jpg", "image/jpeg"),
        ("scan.jpeg", "image/jpeg"),
    ],
)
def test_allowed_external_xray_formats_are_accepted(doctor_client, name, content_type):
    response = doctor_client.post("/api/external-xrays/", {"file": upload_file(name, content_type)}, format="multipart")

    assert response.status_code == 201


@pytest.mark.django_db
@pytest.mark.parametrize("name", ["scan.pdf", "scan.svg", "scan.exe", "xray.jpg.exe", "scan.zip", "scan"])
def test_invalid_external_xray_files_are_rejected(doctor_client, name):
    response = doctor_client.post(
        "/api/external-xrays/",
        {"file": upload_file(name, "application/octet-stream")},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.data["code"] == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.django_db
def test_missing_oversized_and_content_type_mismatch_external_files_are_rejected(doctor_client):
    missing = doctor_client.post("/api/external-xrays/", {"title": "No file"}, format="multipart")
    oversized = doctor_client.post(
        "/api/external-xrays/",
        {"file": upload_file("large.png", "image/png", b"x" * (MAX_XRAY_SIZE_BYTES + 1))},
        format="multipart",
    )
    mismatch = doctor_client.post(
        "/api/external-xrays/",
        {"file": upload_file("mismatch.png", "application/pdf")},
        format="multipart",
    )

    assert missing.status_code == 400
    assert missing.data["code"] == "VALIDATION_ERROR"
    assert oversized.status_code == 400
    assert oversized.data["code"] == "FILE_TOO_LARGE"
    assert mismatch.status_code == 400
    assert mismatch.data["code"] == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.django_db
def test_admin_and_doctor_can_run_external_ai(admin_client, doctor_client, admin_user, external_xray_case_factory):
    admin_case = external_xray_case_factory(uploaded_by=admin_user)
    doctor_case = external_xray_case_factory()

    admin_response = admin_client.post(f"/api/external-xrays/{admin_case.id}/run-ai/")
    doctor_response = doctor_client.post(f"/api/external-xrays/{doctor_case.id}/run-ai/")

    assert admin_response.status_code == 200
    assert admin_response.data["status"] == AIResult.Status.COMPLETED
    assert admin_response.data["disclaimer"] == AI_DISCLAIMER_EN
    assert admin_response.data["external_xray_case"]["id"] == admin_case.id
    assert doctor_response.status_code == 200
    assert doctor_response.data["findings"][0]["fdi_tooth_id"] == "36"
    assert doctor_response.data["model_version"] == "pearlix-mock-xray-v1"


@pytest.mark.django_db
@pytest.mark.parametrize("ai_mode", [ClinicSettings.AiMode.DJANGO_INTERNAL, ClinicSettings.AiMode.SEPARATE_SERVICE])
def test_external_xray_ai_run_requires_mock_adapter(admin_client, doctor_client, admin_user, external_xray_case_factory, ai_mode):
    cases = [
        (admin_client, {"uploaded_by": admin_user, "stored_file_name": f"external-admin-{ai_mode}.png"}),
        (doctor_client, {"stored_file_name": f"external-doctor-{ai_mode}.png"}),
    ]
    for client, kwargs in cases:
        set_ai_mode(ai_mode)
        external = external_xray_case_factory(**kwargs)

        response = client.post(f"/api/external-xrays/{external.id}/run-ai/")

        assert response.status_code == 503
        assert response.data["code"] == "AI_SERVICE_NOT_CONFIGURED"
        assert not AIResult.objects.filter(external_xray_case=external).exists()
        external.refresh_from_db()
        assert external.status == ExternalXrayCase.Status.TEMPORARY


@pytest.mark.django_db
def test_doctor_cannot_run_or_read_ai_for_another_doctors_external_case(doctor_client, other_doctor_user, external_xray_case_factory):
    external = external_xray_case_factory(uploaded_by=other_doctor_user)

    assert doctor_client.post(f"/api/external-xrays/{external.id}/run-ai/").status_code == 404
    assert doctor_client.get(f"/api/external-xrays/{external.id}/ai-result/").status_code == 404


@pytest.mark.django_db
def test_external_ai_run_rejects_discarded_and_attached_cases(doctor_client, active_visit, patient, external_xray_case_factory):
    discarded = external_xray_case_factory(status=ExternalXrayCase.Status.DISCARDED, discarded_at=timezone.now())
    attached = external_xray_case_factory(
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=patient,
        attached_visit=active_visit,
        attached_at=timezone.now(),
        stored_file_name="attached-external.png",
    )

    discarded_response = doctor_client.post(f"/api/external-xrays/{discarded.id}/run-ai/")
    attached_response = doctor_client.post(f"/api/external-xrays/{attached.id}/run-ai/")

    assert discarded_response.status_code == 409
    assert discarded_response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert attached_response.status_code == 409
    assert attached_response.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_external_ai_run_does_not_modify_patient_visit_or_appointment(doctor_client, active_visit, external_xray_case_factory):
    active_visit.diagnosis = "Original diagnosis"
    active_visit.treatment = "Original treatment"
    active_visit.clinical_notes = "Original notes"
    active_visit.save(update_fields=["diagnosis", "treatment", "clinical_notes", "updated_at"])
    patient = active_visit.patient
    appointment = active_visit.appointment
    external = external_xray_case_factory()

    response = doctor_client.post(f"/api/external-xrays/{external.id}/run-ai/")

    patient.refresh_from_db()
    active_visit.refresh_from_db()
    appointment.refresh_from_db()
    assert response.status_code == 200
    assert active_visit.diagnosis == "Original diagnosis"
    assert active_visit.treatment == "Original treatment"
    assert active_visit.clinical_notes == "Original notes"
    assert active_visit.status == Visit.Status.ACTIVE
    assert appointment.status == Appointment.Status.ACTIVE
    assert not patient.xrays.exists()


@pytest.mark.django_db
def test_external_ai_result_read_and_missing_behavior(admin_client, doctor_client, external_xray_case_factory, ai_result_factory):
    missing = external_xray_case_factory()
    external = external_xray_case_factory(stored_file_name="with-ai.png")
    result = ai_result_factory(external_xray_case=external)

    missing_response = doctor_client.get(f"/api/external-xrays/{missing.id}/ai-result/")
    admin_response = admin_client.get(f"/api/external-xrays/{external.id}/ai-result/")
    doctor_response = doctor_client.get(f"/api/external-xrays/{external.id}/ai-result/")

    assert missing_response.status_code == 404
    assert missing_response.data["code"] == "AI_RESULT_UNAVAILABLE"
    assert admin_response.status_code == 200
    assert admin_response.data["id"] == result.id
    assert doctor_response.status_code == 200
    assert "overlay_file" not in doctor_response.data


@pytest.mark.django_db
def test_external_overlay_permission_and_missing_behavior(api_client, admin_client, doctor_client, other_doctor_client, external_xray_case_factory, ai_result_factory):
    missing_overlay_case = external_xray_case_factory()
    ai_result_factory(external_xray_case=missing_overlay_case)
    overlay_case = external_xray_case_factory(stored_file_name="overlay-case.png")
    ai_result_factory(external_xray_case=overlay_case, overlay_file=upload_file("overlay.png", "image/png"))

    assert api_client.get(f"/api/external-xrays/{overlay_case.id}/ai-overlay/").status_code == 401
    assert doctor_client.get(f"/api/external-xrays/{missing_overlay_case.id}/ai-overlay/").data["code"] == "AI_RESULT_UNAVAILABLE"
    admin_response = admin_client.get(f"/api/external-xrays/{overlay_case.id}/ai-overlay/")
    doctor_response = doctor_client.get(f"/api/external-xrays/{overlay_case.id}/ai-overlay/")
    unrelated_response = other_doctor_client.get(f"/api/external-xrays/{overlay_case.id}/ai-overlay/")

    assert admin_response.status_code == 200
    assert admin_response["Content-Type"] == "image/png"
    assert doctor_response.status_code == 200
    assert unrelated_response.status_code == 404


@pytest.mark.django_db
def test_admin_and_doctor_can_discard_temporary_case(
    admin_client,
    doctor_client,
    admin_user,
    external_xray_case_factory,
    ai_result_factory,
):
    admin_case = external_xray_case_factory(uploaded_by=admin_user)
    doctor_case = external_xray_case_factory(stored_file_name="doctor-discard.png")
    ai_result_factory(external_xray_case=doctor_case)

    admin_response = admin_client.post(f"/api/external-xrays/{admin_case.id}/discard/")
    doctor_response = doctor_client.post(f"/api/external-xrays/{doctor_case.id}/discard/")

    assert admin_response.status_code == 200
    assert admin_response.data["status"] == ExternalXrayCase.Status.DISCARDED
    assert admin_response.data["discarded_at"] is not None
    assert doctor_response.status_code == 200
    assert doctor_response.data["status"] == ExternalXrayCase.Status.DISCARDED


@pytest.mark.django_db
def test_discard_rejects_forbidden_or_non_temporary_cases(doctor_client, other_doctor_user, patient, active_visit, external_xray_case_factory):
    other_case = external_xray_case_factory(uploaded_by=other_doctor_user)
    discarded = external_xray_case_factory(status=ExternalXrayCase.Status.DISCARDED, discarded_at=timezone.now(), stored_file_name="already-discarded.png")
    attached = external_xray_case_factory(
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=patient,
        attached_visit=active_visit,
        attached_at=timezone.now(),
        stored_file_name="already-attached.png",
    )

    assert doctor_client.post(f"/api/external-xrays/{other_case.id}/discard/").status_code == 404
    assert doctor_client.post(f"/api/external-xrays/{discarded.id}/discard/").status_code == 409
    assert doctor_client.post(f"/api/external-xrays/{attached.id}/discard/").status_code == 409


@pytest.mark.django_db
def test_doctor_can_attach_external_case_to_accessible_patient_and_copy_ai(
    doctor_client,
    active_visit,
    external_xray_case_factory,
    ai_result_factory,
):
    external = external_xray_case_factory()
    ai_result_factory(external_xray_case=external)

    before_xrays = doctor_client.get(f"/api/patients/{active_visit.patient_id}/xrays/")
    before_ai = doctor_client.get(f"/api/patients/{active_visit.patient_id}/ai-results/")
    response = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": active_visit.id, "title": "Attached title", "notes": "Attached notes"},
        format="json",
    )

    assert before_xrays.data["count"] == 0
    assert before_ai.data["count"] == 0
    assert response.status_code == 200
    external.refresh_from_db()
    assert external.status == ExternalXrayCase.Status.ATTACHED_TO_PATIENT
    assert external.attached_patient_id == active_visit.patient_id
    assert external.attached_visit_id == active_visit.id
    assert external.attached_xray_id is not None
    assert external.attached_at is not None

    saved_xray = external.attached_xray
    assert saved_xray.source == XrayAttachment.Source.EXTERNAL_WORKSPACE
    assert saved_xray.patient_id == active_visit.patient_id
    assert saved_xray.visit_id == active_visit.id
    assert saved_xray.uploaded_by_id == active_visit.doctor_id
    assert saved_xray.original_file.name != external.original_file.name
    assert hasattr(saved_xray, "ai_result")
    assert saved_xray.ai_result.result_summary == "Research-only AI analysis completed."
    assert doctor_client.get(f"/api/patients/{active_visit.patient_id}/xrays/").data["count"] == 1
    assert doctor_client.get(f"/api/patients/{active_visit.patient_id}/ai-results/").data["count"] == 1
    assert doctor_client.get(f"/api/xrays/{saved_xray.id}/file/").status_code == 200


@pytest.mark.django_db
def test_doctor_can_attach_own_external_case_to_active_patient_without_prior_visit(
    doctor_client,
    patient_factory,
    external_xray_case_factory,
):
    patient = patient_factory(full_name="Clinic Wide Patient", phone="0999333000")
    external = external_xray_case_factory()

    response = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": patient.id, "title": "Profile-only attach"},
        format="json",
    )

    assert response.status_code == 200
    external.refresh_from_db()
    assert external.attached_patient_id == patient.id
    assert external.attached_visit_id is None
    assert external.attached_xray.patient_id == patient.id
    assert external.attached_xray.visit_id is None


@pytest.mark.django_db
def test_attach_reserves_patient_quota_for_retained_external_and_saved_copy(
    doctor_client, patient_factory, external_xray_case_factory, settings
):
    patient = patient_factory(full_name="Quota Patient")
    external = external_xray_case_factory()
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 2 * external.size_bytes - 1
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = 10_000_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 10_000_000

    response = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": patient.id},
        format="json",
    )
    assert response.status_code == 409
    assert response.data["code"] == "STORAGE_QUOTA_EXCEEDED"
    external.refresh_from_db()
    assert external.status == ExternalXrayCase.Status.TEMPORARY
    assert not XrayAttachment.objects.filter(patient=patient).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_attach_external_case(request, client_fixture, active_visit, external_xray_case_factory):
    client = request.getfixturevalue(client_fixture)
    external = external_xray_case_factory()

    response = client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id},
        format="json",
    )

    assert response.status_code == 403
    assert not XrayAttachment.objects.exists()


@pytest.mark.django_db
def test_attach_rejects_other_doctor_discarded_attached_and_invalid_targets(
    doctor_client,
    active_visit,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
    external_xray_case_factory,
):
    other_case = external_xray_case_factory(uploaded_by=other_doctor_user)
    discarded = external_xray_case_factory(status=ExternalXrayCase.Status.DISCARDED, discarded_at=timezone.now(), stored_file_name="attach-discarded.png")
    attached = external_xray_case_factory(
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=active_visit.patient,
        attached_visit=active_visit,
        attached_at=timezone.now(),
        stored_file_name="attach-attached.png",
    )
    archived_patient = patient_factory(full_name="Archived Patient", phone="0999000000", is_archived=True)
    other_patient = patient_factory(full_name="Other Patient", phone="0999000001")
    other_visit = make_patient_visit(appointment_factory, visit_factory, other_patient, active_visit.doctor, start="2026-07-20T13:00:00+03:00")
    other_doctor_visit = make_patient_visit(
        appointment_factory,
        visit_factory,
        active_visit.patient,
        other_doctor_user,
        start="2026-07-20T14:00:00+03:00",
    )
    external = external_xray_case_factory(stored_file_name="valid-targets.png")

    assert doctor_client.post(f"/api/external-xrays/{other_case.id}/attach-to-patient/", {"patient_id": active_visit.patient_id}).status_code == 404
    assert doctor_client.post(f"/api/external-xrays/{discarded.id}/attach-to-patient/", {"patient_id": active_visit.patient_id}).status_code == 409
    assert doctor_client.post(f"/api/external-xrays/{attached.id}/attach-to-patient/", {"patient_id": active_visit.patient_id}).status_code == 409
    assert doctor_client.post(f"/api/external-xrays/{external.id}/attach-to-patient/", {"patient_id": 999999}).status_code == 404
    assert doctor_client.post(f"/api/external-xrays/{external.id}/attach-to-patient/", {"patient_id": archived_patient.id}).status_code == 404
    mismatch = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": other_visit.id},
        format="json",
    )
    other_doctor_visit_response = doctor_client.post(
        f"/api/external-xrays/{external.id}/attach-to-patient/",
        {"patient_id": active_visit.patient_id, "visit_id": other_doctor_visit.id},
        format="json",
    )
    assert mismatch.status_code == 400
    assert mismatch.data["code"] == "VALIDATION_ERROR"
    assert other_doctor_visit_response.status_code == 404
