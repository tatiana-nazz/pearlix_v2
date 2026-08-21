"""Phase 6.2 physical-deletion quota and cleanup regressions."""

from concurrent.futures import ThreadPoolExecutor
from io import StringIO
from threading import Event

import pytest
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import close_old_connections, connection, transaction
from django.utils import timezone

from apps.ai_results.models import AIResult
from apps.ai_results.services import _claim_processing
from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask, XrayAttachment
from apps.xrays.quota import StorageQuotaExceeded, enforce_storage_quota, lock_storage_admission
from apps.xrays.services import (
    create_external_xray_case,
    delete_xray_attachment,
    process_imaging_deletion_task,
    purge_external_artifacts,
)
from tests.xrays.test_phase4_imaging_security import upload


def _set_quota_dimension(settings, dimension, limit):
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 1_000_000
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = 1_000_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 1_000_000
    setting_name = {
        "patient": "PEARLIX_XRAY_PATIENT_QUOTA_BYTES",
        "user": "PEARLIX_XRAY_USER_QUOTA_BYTES",
        "clinic": "PEARLIX_XRAY_GLOBAL_QUOTA_BYTES",
    }[dimension]
    setattr(settings, setting_name, limit)


@pytest.mark.django_db
def test_legacy_pending_task_without_quota_metadata_fails_new_storage_closed(
    settings,
    doctor_user,
):
    _set_quota_dimension(settings, "clinic", 1_000_000)
    ImagingDeletionTask.objects.create(storage_name="phase62/legacy-unknown.png")

    with pytest.raises(StorageQuotaExceeded) as caught:
        enforce_storage_quota(additional_bytes=1, uploader_id=doctor_user.id)

    assert caught.value.dimension == "clinic"


@pytest.mark.parametrize("dimension", ["patient", "user", "clinic"])
@pytest.mark.django_db(transaction=True)
def test_failed_physical_deletion_stays_in_every_quota_until_retry_succeeds(
    monkeypatch,
    settings,
    xray_attachment_factory,
    doctor_user,
    dimension,
):
    xray = xray_attachment_factory(uploaded_by=doctor_user)
    XrayAttachment.objects.filter(pk=xray.pk).update(size_bytes=40)
    xray.refresh_from_db()
    AIResult.objects.create(
        xray_attachment=xray,
        requested_by=doctor_user,
        status=AIResult.Status.COMPLETED,
        model_version="phase62-test",
        overlay_file="ai-overlays/phase62-overlay.png",
        overlay_size_bytes=15,
    )
    total_bytes = 55
    _set_quota_dimension(settings, dimension, total_bytes)
    should_fail = {"value": True}

    def provider_delete(_name):
        if should_fail["value"]:
            raise OSError("storage unavailable")

    monkeypatch.setattr(default_storage, "delete", provider_delete)
    delete_xray_attachment(xray=xray)

    tasks = list(ImagingDeletionTask.objects.order_by("size_bytes"))
    assert [task.size_bytes for task in tasks] == [15, 40]
    assert {task.uploader_id for task in tasks} == {doctor_user.id}
    assert {task.patient_id for task in tasks} == {xray.patient_id}
    assert all(task.attempts == 1 for task in tasks)
    with pytest.raises(StorageQuotaExceeded) as caught:
        enforce_storage_quota(
            additional_bytes=1,
            uploader_id=doctor_user.id,
            patient_id=xray.patient_id,
        )
    assert caught.value.dimension == dimension

    assert process_imaging_deletion_task(tasks[0].id) is False
    with pytest.raises(StorageQuotaExceeded):
        enforce_storage_quota(
            additional_bytes=1,
            uploader_id=doctor_user.id,
            patient_id=xray.patient_id,
        )

    should_fail["value"] = False
    task_ids = list(ImagingDeletionTask.objects.values_list("id", flat=True))
    assert [process_imaging_deletion_task(task_id) for task_id in task_ids] == [True, True]
    assert ImagingDeletionTask.objects.count() == 0
    enforce_storage_quota(
        additional_bytes=total_bytes,
        uploader_id=doctor_user.id,
        patient_id=xray.patient_id,
    )
    assert all(process_imaging_deletion_task(task_id) is False for task_id in task_ids)


@pytest.mark.django_db(transaction=True)
def test_replaced_overlay_remains_accounted_when_provider_delete_fails(
    monkeypatch,
    settings,
    xray_attachment_factory,
    doctor_user,
):
    xray = xray_attachment_factory(uploaded_by=doctor_user)
    XrayAttachment.objects.filter(pk=xray.pk).update(size_bytes=40)
    xray.refresh_from_db()
    AIResult.objects.create(
        xray_attachment=xray,
        requested_by=doctor_user,
        status=AIResult.Status.COMPLETED,
        model_version="phase62-test",
        overlay_file="ai-overlays/phase62-replaced.png",
        overlay_size_bytes=15,
    )
    _set_quota_dimension(settings, "patient", 55)
    monkeypatch.setattr(
        default_storage,
        "delete",
        lambda _name: (_ for _ in ()).throw(OSError("storage unavailable")),
    )

    _claim_processing(
        source_model=XrayAttachment,
        source_id=xray.id,
        source_field="xray_attachment",
        user=doctor_user,
    )

    task = ImagingDeletionTask.objects.get()
    assert (task.size_bytes, task.uploader_id, task.patient_id, task.attempts) == (
        15,
        doctor_user.id,
        xray.patient_id,
        1,
    )
    with pytest.raises(StorageQuotaExceeded, match="patient"):
        enforce_storage_quota(
            additional_bytes=1,
            uploader_id=doctor_user.id,
            patient_id=xray.patient_id,
        )


@pytest.mark.django_db(transaction=True)
def test_failed_external_purge_counts_live_row_once_until_success(
    monkeypatch,
    settings,
    doctor_user,
):
    external = create_external_xray_case(uploaded_by=doctor_user, uploaded_file=upload())
    ExternalXrayCase.objects.filter(pk=external.pk).update(
        status=ExternalXrayCase.Status.DISCARDED,
        discarded_at=external.created_at,
        purge_after=external.created_at,
    )
    _set_quota_dimension(settings, "user", external.size_bytes)
    monkeypatch.setattr(
        default_storage,
        "delete",
        lambda _name: (_ for _ in ()).throw(OSError("storage unavailable")),
    )

    assert purge_external_artifacts(external.id) is False
    assert ImagingDeletionTask.objects.count() == 0
    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id)
    with pytest.raises(StorageQuotaExceeded, match="user"):
        enforce_storage_quota(additional_bytes=1, uploader_id=doctor_user.id)

    monkeypatch.setattr(default_storage, "delete", lambda _name: None)
    assert purge_external_artifacts(external.id) is True
    enforce_storage_quota(
        additional_bytes=external.size_bytes,
        uploader_id=doctor_user.id,
    )


@pytest.mark.django_db(transaction=True)
def test_attached_external_original_and_overlay_count_for_own_patient_until_purged(
    monkeypatch, settings, doctor_user, patient_factory
):
    patient = patient_factory()
    other_patient = patient_factory()
    external = create_external_xray_case(uploaded_by=doctor_user, uploaded_file=upload())
    ExternalXrayCase.objects.filter(pk=external.pk).update(
        status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT,
        attached_patient=patient,
        attached_at=external.created_at,
        purge_after=external.created_at,
    )
    AIResult.objects.create(
        external_xray_case=external,
        requested_by=doctor_user,
        status=AIResult.Status.COMPLETED,
        model_version="phase63-test",
        overlay_file="ai-overlays/phase63.png",
        overlay_size_bytes=30,
    )
    _set_quota_dimension(settings, "patient", external.size_bytes + 30)

    enforce_storage_quota(additional_bytes=0, uploader_id=doctor_user.id, patient_id=patient.id)
    with pytest.raises(StorageQuotaExceeded, match="patient"):
        enforce_storage_quota(additional_bytes=1, uploader_id=doctor_user.id, patient_id=patient.id)
    enforce_storage_quota(additional_bytes=1, uploader_id=doctor_user.id, patient_id=other_patient.id)

    monkeypatch.setattr(default_storage, "delete", lambda _name: None)
    assert purge_external_artifacts(external.id) is True
    enforce_storage_quota(
        additional_bytes=external.size_bytes + 30,
        uploader_id=doctor_user.id,
        patient_id=patient.id,
    )


@pytest.mark.django_db
def test_attach_admission_reserves_external_and_saved_patient_duplicates(
    settings, doctor_user, patient_factory
):
    patient = patient_factory()
    external = create_external_xray_case(uploaded_by=doctor_user, uploaded_file=upload())
    overlay_bytes = 30
    _set_quota_dimension(settings, "patient", 2 * (external.size_bytes + overlay_bytes) - 1)
    with pytest.raises(StorageQuotaExceeded, match="patient"):
        enforce_storage_quota(
            additional_bytes=external.size_bytes + overlay_bytes,
            additional_patient_bytes=2 * (external.size_bytes + overlay_bytes),
            uploader_id=doctor_user.id,
            patient_id=patient.id,
        )


@pytest.mark.django_db(transaction=True)
def test_cleanup_command_is_bounded_retryable_idempotent_and_monitorable(
    monkeypatch,
    doctor_user,
):
    tasks = [
        ImagingDeletionTask.objects.create(
            storage_name=f"phase62/task-{index}.png",
            size_bytes=10,
            uploader_id=doctor_user.id,
        )
        for index in range(3)
    ]
    failures_remaining = {"count": 2}

    def provider_delete(_name):
        if failures_remaining["count"]:
            failures_remaining["count"] -= 1
            raise OSError("storage unavailable")

    monkeypatch.setattr(default_storage, "delete", provider_delete)
    output = StringIO()
    call_command("purge_expired_imaging_artifacts", batch_size=1, stdout=output)
    tasks[0].refresh_from_db()
    assert tasks[0].attempts == 1
    assert "attempted 0 expired artifact set(s) and 1 deletion task(s)" in output.getvalue()
    assert "deferred 1" in output.getvalue()
    assert tasks[0].storage_name not in output.getvalue()

    with pytest.raises(CommandError, match="left selected objects pending"):
        call_command(
            "purge_expired_imaging_artifacts",
            batch_size=1,
            fail_on_deferred=True,
            stdout=StringIO(),
        )
    tasks[0].refresh_from_db()
    tasks[1].refresh_from_db()
    assert tasks[0].attempts == 1
    assert tasks[1].attempts == 1

    call_command(
        "purge_expired_imaging_artifacts",
        batch_size=1,
        fail_on_deferred=True,
        stdout=StringIO(),
    )
    assert ImagingDeletionTask.objects.count() == 2
    ImagingDeletionTask.objects.update(next_attempt_at=timezone.now())
    call_command("purge_expired_imaging_artifacts", batch_size=2, stdout=StringIO())
    assert ImagingDeletionTask.objects.count() == 0
    final_output = StringIO()
    call_command("purge_expired_imaging_artifacts", batch_size=2, stdout=final_output)
    assert "attempted 0 expired artifact set(s) and 0 deletion task(s)" in final_output.getvalue()


@pytest.mark.django_db(transaction=True)
def test_cleanup_backoff_prevents_poisoned_oldest_task_from_starving_newer_work(
    monkeypatch, doctor_user
):
    oldest = ImagingDeletionTask.objects.create(
        storage_name="phase63/poisoned.png", size_bytes=10, uploader_id=doctor_user.id
    )
    newer = ImagingDeletionTask.objects.create(
        storage_name="phase63/healthy.png", size_bytes=10, uploader_id=doctor_user.id
    )

    def provider_delete(name):
        if name == oldest.storage_name:
            raise OSError("provider outage for one object")

    monkeypatch.setattr(default_storage, "delete", provider_delete)
    call_command("purge_expired_imaging_artifacts", batch_size=1, stdout=StringIO())
    oldest.refresh_from_db()
    assert oldest.attempts == 1 and oldest.next_attempt_at is not None

    call_command("purge_expired_imaging_artifacts", batch_size=1, stdout=StringIO())
    assert not ImagingDeletionTask.objects.filter(pk=newer.pk).exists()
    oldest.refresh_from_db()
    assert oldest.attempts == 1

    ImagingDeletionTask.objects.filter(pk=oldest.pk).update(next_attempt_at=timezone.now())
    call_command("purge_expired_imaging_artifacts", batch_size=1, stdout=StringIO())
    oldest.refresh_from_db()
    assert oldest.attempts == 2


@pytest.mark.django_db(transaction=True)
def test_postgresql_pending_bytes_block_upload_until_cleanup_commit(
    monkeypatch,
    settings,
    doctor_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL pending-delete quota interleaving proof")
    settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES = 1_000
    settings.PEARLIX_XRAY_USER_QUOTA_BYTES = 1_000
    settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES = 100
    task = ImagingDeletionTask.objects.create(
        storage_name="phase62/concurrent-delete.png",
        size_bytes=80,
        uploader_id=doctor_user.id,
    )
    entered = Event()
    release = Event()

    def blocking_delete(_name):
        entered.set()
        assert release.wait(timeout=5)

    monkeypatch.setattr(default_storage, "delete", blocking_delete)

    def cleanup():
        close_old_connections()
        try:
            return process_imaging_deletion_task(task.id)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(cleanup)
        assert entered.wait(timeout=5)
        with pytest.raises(StorageQuotaExceeded, match="clinic"):
            with transaction.atomic():
                lock_storage_admission()
                enforce_storage_quota(additional_bytes=30, uploader_id=doctor_user.id)
        release.set()
        assert future.result(timeout=5) is True

    with transaction.atomic():
        lock_storage_admission()
        enforce_storage_quota(additional_bytes=30, uploader_id=doctor_user.id)
