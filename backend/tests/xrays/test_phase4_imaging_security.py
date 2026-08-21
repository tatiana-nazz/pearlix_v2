from io import BytesIO
from datetime import timedelta

import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.db import close_old_connections, connection, transaction
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, Lock
from PIL import Image

from apps.accounts.models import User
from apps.ai_results.models import AIResult
from apps.ai_results.services import AICapacityBusy, AIAnalysisInProgress, _claim_processing
from apps.xrays.image_validation import ImageValidationError, validate_image_upload
from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask, XrayAttachment
from apps.xrays.services import (
    XrayUploadError,
    create_external_xray_case,
    create_xray_attachment,
    process_imaging_deletion_task,
    purge_external_artifacts,
)
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
    AIResult.objects.create(
        xray_attachment=first,
        requested_by=doctor_user,
        status=AIResult.Status.PROCESSING,
    )
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
def test_postgresql_ai_admission_allows_two_distinct_users_below_global_limit(
    settings, xray_attachment_factory, doctor_user, other_doctor_user
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    users = [doctor_user, other_doctor_user]
    sources = [xray_attachment_factory(uploaded_by=user) for user in users]
    barrier = Barrier(2)

    def claim(payload):
        source_id, user = payload
        close_old_connections()
        barrier.wait()
        try:
            _claim_processing(
                source_model=XrayAttachment,
                source_id=source_id,
                source_field="xray_attachment",
                user=user,
            )
            return "accepted"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(claim, [(source.id, user) for source, user in zip(sources, users)]))
    assert outcomes == ["accepted", "accepted"]
    assert AIResult.objects.filter(status=AIResult.Status.PROCESSING).count() == 2


@pytest.mark.django_db(transaction=True)
def test_postgresql_ai_admission_enforces_global_limit_across_three_users(
    settings, xray_attachment_factory, doctor_user, other_doctor_user
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    third_user = User.objects.create_user(
        email="phase41-third-doctor@example.com",
        password="password123",
        full_name="Third Doctor",
        role=User.Role.DOCTOR,
        must_change_password=False,
    )
    users = [doctor_user, other_doctor_user, third_user]
    sources = [xray_attachment_factory(uploaded_by=user) for user in users]
    barrier = Barrier(3)

    def claim(payload):
        source_id, user = payload
        close_old_connections()
        barrier.wait()
        try:
            _claim_processing(
                source_model=XrayAttachment,
                source_id=source_id,
                source_field="xray_attachment",
                user=user,
            )
            return "accepted"
        except AICapacityBusy:
            return "busy"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=3) as pool:
        outcomes = list(pool.map(claim, [(source.id, user) for source, user in zip(sources, users)]))
    assert sorted(outcomes) == ["accepted", "accepted", "busy"]
    assert AIResult.objects.filter(status=AIResult.Status.PROCESSING).count() == 2


@pytest.mark.django_db(transaction=True)
def test_postgresql_ai_admission_rejects_concurrent_duplicate_source(
    settings, xray_attachment_factory, doctor_user
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    source = xray_attachment_factory(uploaded_by=doctor_user)
    barrier = Barrier(2)

    def claim(_index):
        close_old_connections()
        barrier.wait()
        try:
            _claim_processing(
                source_model=XrayAttachment,
                source_id=source.id,
                source_field="xray_attachment",
                user=doctor_user,
            )
            return "accepted"
        except AIAnalysisInProgress:
            return "duplicate"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(claim, [1, 2]))
    assert sorted(outcomes) == ["accepted", "duplicate"]
    assert AIResult.objects.filter(xray_attachment=source).count() == 1


@pytest.mark.django_db(transaction=True)
def test_postgresql_ai_admission_reconciles_stale_processing_without_count_corruption(
    settings, xray_attachment_factory, doctor_user, other_doctor_user
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL = 2
    settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER = 1
    stale_source = xray_attachment_factory(uploaded_by=doctor_user)
    fresh_source = xray_attachment_factory(uploaded_by=other_doctor_user)
    stale_result = AIResult.objects.create(xray_attachment=stale_source, status=AIResult.Status.PROCESSING)
    AIResult.objects.filter(pk=stale_result.pk).update(updated_at=timezone.now() - timedelta(minutes=16))
    barrier = Barrier(2)

    def claim(payload):
        source_id, user = payload
        close_old_connections()
        barrier.wait()
        try:
            claim_result, _source = _claim_processing(
                source_model=XrayAttachment,
                source_id=source_id,
                source_field="xray_attachment",
                user=user,
            )
            return claim_result.result_id
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        result_ids = list(
            pool.map(claim, [(stale_source.id, doctor_user), (fresh_source.id, other_doctor_user)])
        )
    assert stale_result.id in result_ids
    assert AIResult.objects.filter(status=AIResult.Status.PROCESSING).count() == 2
    assert AIResult.objects.count() == 2


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


@pytest.mark.parametrize("dimension", ["patient", "user", "clinic"])
@pytest.mark.django_db(transaction=True)
def test_postgresql_storage_quota_dimensions_never_overcommit(
    settings, patient_factory, doctor_user, other_doctor_user, dimension
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 1_000
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = 1_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 1_000
    quota_setting = {
        "patient": "PEARLIX_XRAY_PATIENT_QUOTA_BYTES",
        "user": "PEARLIX_XRAY_USER_QUOTA_BYTES",
        "clinic": "PEARLIX_XRAY_GLOBAL_QUOTA_BYTES",
    }[dimension]
    setattr(settings, quota_setting, 100)
    patient = patient_factory()
    other_patient = patient_factory()
    XrayAttachment.objects.create(
        patient=patient,
        uploaded_by=doctor_user,
        original_file="xrays/phase41-existing.png",
        stored_file_name="phase41-existing.png",
        original_file_name="phase41-existing.png",
        content_type="image/png",
        size_bytes=40,
    )
    barrier = Barrier(2)

    def admit(index):
        close_old_connections()
        candidate_user = other_doctor_user if dimension == "clinic" else doctor_user
        candidate_patient = other_patient if dimension == "clinic" else patient
        barrier.wait()
        try:
            with transaction.atomic():
                lock_storage_admission()
                enforce_storage_quota(
                    additional_bytes=40,
                    uploader_id=candidate_user.id,
                    patient_id=candidate_patient.id,
                )
                XrayAttachment.objects.create(
                    patient_id=candidate_patient.id,
                    uploaded_by_id=candidate_user.id,
                    original_file=f"xrays/phase41-{dimension}-{index}.png",
                    stored_file_name=f"phase41-{dimension}-{index}.png",
                    original_file_name=f"phase41-{dimension}-{index}.png",
                    content_type="image/png",
                    size_bytes=40,
                )
            return "accepted"
        except StorageQuotaExceeded:
            return "quota"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(admit, [1, 2]))
    assert sorted(outcomes) == ["accepted", "quota"]
    assert XrayAttachment.objects.count() == 2


def _blocking_delete_probe():
    first_entered = Event()
    release_first = Event()
    duplicate_entered = Event()
    counter_lock = Lock()
    calls = {"count": 0}

    def delete(_name):
        with counter_lock:
            calls["count"] += 1
            current = calls["count"]
        if current == 1:
            first_entered.set()
            assert release_first.wait(timeout=5)
        else:
            duplicate_entered.set()

    return delete, first_entered, release_first, duplicate_entered, calls


@pytest.mark.django_db(transaction=True)
def test_postgresql_imaging_deletion_task_is_claimed_by_only_one_worker(monkeypatch):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    task = ImagingDeletionTask.objects.create(storage_name="phase41/deletion-task.png")
    delete, first_entered, release_first, duplicate_entered, calls = _blocking_delete_probe()
    monkeypatch.setattr(default_storage, "delete", delete)

    def process():
        close_old_connections()
        try:
            return process_imaging_deletion_task(task.id)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(process)
        assert first_entered.wait(timeout=5)
        second = pool.submit(process)
        second_result = second.result(timeout=3)
        release_first.set()
        first_result = first.result(timeout=5)

    assert first_result is True
    assert second_result is False
    assert duplicate_entered.is_set() is False
    assert calls["count"] == 1
    assert ImagingDeletionTask.objects.filter(pk=task.id).exists() is False


@pytest.mark.django_db(transaction=True)
def test_postgresql_failed_imaging_deletion_task_remains_retryable(monkeypatch):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    task = ImagingDeletionTask.objects.create(storage_name="phase41/retry-task.png")
    first_entered = Event()
    release_first = Event()
    calls = {"count": 0}

    def failing_delete(_name):
        calls["count"] += 1
        first_entered.set()
        assert release_first.wait(timeout=5)
        raise OSError("storage unavailable")

    monkeypatch.setattr(default_storage, "delete", failing_delete)

    def process():
        close_old_connections()
        try:
            return process_imaging_deletion_task(task.id)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(process)
        assert first_entered.wait(timeout=5)
        second = pool.submit(process)
        assert second.result(timeout=3) is False
        release_first.set()
        assert first.result(timeout=5) is False

    task.refresh_from_db()
    assert calls["count"] == 1
    assert task.attempts == 1
    assert task.last_error == "storage unavailable"


@pytest.mark.django_db(transaction=True)
def test_postgresql_external_artifact_purge_is_claimed_by_only_one_worker(monkeypatch, doctor_user):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    external = ExternalXrayCase.objects.create(
        uploaded_by=doctor_user,
        original_file="external-xrays/phase41-purge.png",
        stored_file_name="phase41-purge.png",
        original_file_name="phase41-purge.png",
        content_type="image/png",
        size_bytes=40,
        status=ExternalXrayCase.Status.DISCARDED,
        discarded_at=timezone.now(),
        purge_after=timezone.now() - timedelta(minutes=1),
    )
    delete, first_entered, release_first, duplicate_entered, calls = _blocking_delete_probe()
    monkeypatch.setattr(default_storage, "delete", delete)

    def purge():
        close_old_connections()
        try:
            return purge_external_artifacts(external.id)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(purge)
        assert first_entered.wait(timeout=5)
        second = pool.submit(purge)
        second_result = second.result(timeout=3)
        release_first.set()
        first_result = first.result(timeout=5)

    assert first_result is True
    assert second_result is False
    assert duplicate_entered.is_set() is False
    assert calls["count"] == 1
    external.refresh_from_db()
    assert external.original_file.name == ""
    assert external.artifacts_purged_at is not None
