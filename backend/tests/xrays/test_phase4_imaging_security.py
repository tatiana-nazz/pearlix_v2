from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.db import close_old_connections, connection, transaction
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from PIL import Image

from apps.ai_results.models import AIResult
from apps.ai_results.services import AICapacityBusy, _claim_processing
from apps.xrays.image_validation import ImageValidationError, validate_image_upload
from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.xrays.services import XrayUploadError, create_external_xray_case, create_xray_attachment, purge_external_artifacts
from apps.xrays.quota import StorageQuotaExceeded, enforce_storage_quota, lock_storage_admission


def image_bytes(fmt="PNG", size=(64, 32), *, frames=1):
    output = BytesIO()
    images = [Image.new("L", size, 80 + index) for index in range(frames)]
    images[0].save(output, format=fmt, save_all=frames > 1, append_images=images[1:])
    return output.getvalue()


def upload(name="scan.png", content_type="image/png", content=None):
    fmt = "JPEG" if content_type == "image/jpeg" else "PNG"
    return SimpleUploadedFile(name, content if content is not None else image_bytes(fmt), content_type=content_type)


@pytest.mark.parametrize(("name", "content_type", "fmt"), [("scan.png", "image/png", "PNG"), ("scan.jpg", "image/jpeg", "JPEG")])
def test_valid_real_images_are_decoded(name, content_type, fmt):
    result = validate_image_upload(upload(name, content_type, image_bytes(fmt, (4000, 1500))))
    assert (result.width, result.height, result.format) == (4000, 1500, fmt)


@pytest.mark.parametrize(
    ("name", "content_type", "content"),
    [
        ("scan.jpg", "image/jpeg", image_bytes("PNG")),
        ("scan.png", "application/pdf", image_bytes("PNG")),
        ("scan.png", "image/png", b"text"),
        ("scan.png", "image/png", b""),
        ("scan.jpg", "image/jpeg", image_bytes("JPEG")[:20]),
        ("scan.png", "image/png", image_bytes("PNG")[:-8]),
    ],
)
def test_invalid_or_mismatched_images_fail_before_inference(name, content_type, content):
    with pytest.raises(ImageValidationError):
        validate_image_upload(upload(name, content_type, content))


def test_decoded_surface_frame_and_filename_limits(monkeypatch):
    import apps.xrays.image_validation as limits

    monkeypatch.setattr(limits, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(ImageValidationError, match="decoded image surface"):
        validate_image_upload(upload(content=image_bytes("PNG", (11, 10))))
    with pytest.raises(ImageValidationError, match="Multi-frame"):
        validate_image_upload(upload(content=image_bytes("PNG", frames=2)))
    with pytest.raises(ImageValidationError, match="filename"):
        validate_image_upload(upload("bad\x00.png"))
    assert validate_image_upload(upload("أشعة-بانوراما.png", content=image_bytes("PNG", (10, 10)))).original_file_name.startswith("أشعة")


@pytest.mark.django_db
def test_cumulative_user_quota_rejects_second_upload(settings, patient_factory, doctor_user):
    payload = image_bytes("PNG")
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = len(payload) + 10
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 10_000_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 10_000_000
    patient = patient_factory()
    create_xray_attachment(patient=patient, visit=None, uploaded_by=doctor_user, uploaded_file=upload(content=payload))
    with pytest.raises(XrayUploadError) as caught:
        create_external_xray_case(uploaded_by=doctor_user, uploaded_file=upload(content=payload))
    assert caught.value.code == "STORAGE_QUOTA_EXCEEDED"
    assert caught.value.details["dimension"] == "user"


@pytest.mark.django_db
def test_expired_external_cleanup_is_retryable_on_storage_failure(monkeypatch, settings, doctor_user):
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 10_000_000
    external = create_external_xray_case(uploaded_by=doctor_user, uploaded_file=upload())
    ExternalXrayCase.objects.filter(pk=external.pk).update(
        status=ExternalXrayCase.Status.DISCARDED,
        discarded_at=timezone.now(),
        purge_after=timezone.now(),
    )
    storage = external.original_file.storage
    original_delete = storage.delete
    monkeypatch.setattr(storage, "delete", lambda _name: (_ for _ in ()).throw(OSError("storage unavailable")))
    assert purge_external_artifacts(external.id) is False
    external.refresh_from_db()
    assert external.original_file.name and external.artifacts_purged_at is None
    monkeypatch.setattr(storage, "delete", original_delete)
    assert purge_external_artifacts(external.id) is True
    external.refresh_from_db()
    assert external.original_file.name == "" and external.artifacts_purged_at is not None


@pytest.mark.django_db
def test_database_shared_ai_per_user_admission(settings, xray_attachment_factory, doctor_user):
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    first = xray_attachment_factory(uploaded_by=doctor_user)
    second = xray_attachment_factory(uploaded_by=doctor_user)
    AIResult.objects.create(xray_attachment=first, status=AIResult.Status.PROCESSING)
    with pytest.raises(AICapacityBusy):
        _claim_processing(source_model=XrayAttachment, source_id=second.id, source_field="xray_attachment", user=doctor_user)


@pytest.mark.django_db(transaction=True)
def test_postgresql_ai_admission_serializes_concurrent_workers(settings, xray_attachment_factory, doctor_user):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 1
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    sources = [xray_attachment_factory(uploaded_by=doctor_user) for _ in range(2)]
    barrier = Barrier(2)

    def claim(source_id):
        close_old_connections()
        barrier.wait()
        try:
            _claim_processing(source_model=XrayAttachment, source_id=source_id, source_field="xray_attachment", user=doctor_user)
            return "accepted"
        except AICapacityBusy:
            return "busy"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(claim, [source.id for source in sources]))
    assert sorted(outcomes) == ["accepted", "busy"]


@pytest.mark.django_db(transaction=True)
def test_postgresql_storage_quota_admission_serializes_concurrent_workers(settings, patient_factory, doctor_user):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 100
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 1_000
    patient = patient_factory()
    barrier = Barrier(2)

    def admit(index):
        close_old_connections()
        barrier.wait()
        try:
            with transaction.atomic():
                lock_storage_admission()
                enforce_storage_quota(additional_bytes=80, uploader_id=doctor_user.id, patient_id=patient.id)
                XrayAttachment.objects.create(
                    patient_id=patient.id, uploaded_by_id=doctor_user.id,
                    original_file=f"xrays/thread-{index}.png", stored_file_name=f"thread-{index}.png",
                    original_file_name=f"thread-{index}.png", content_type="image/png", size_bytes=80,
                )
            return "accepted"
        except StorageQuotaExceeded:
            return "quota"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(admit, [1, 2]))
    assert sorted(outcomes) == ["accepted", "quota"]
