from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.db.models import Sum

from apps.ai_results.models import AIResult
from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask, XrayAttachment, XrayStorageState


class StorageQuotaExceeded(ValueError):
    def __init__(self, dimension: str, limit: int):
        super().__init__(f"The {dimension} imaging storage quota would be exceeded.")
        self.dimension = dimension
        self.limit = limit


def lock_storage_admission() -> XrayStorageState:
    XrayStorageState.objects.get_or_create(pk=1)
    return XrayStorageState.objects.select_for_update().get(pk=1)


def _sum(queryset, field: str = "size_bytes") -> int:
    return int(queryset.aggregate(total=Sum(field))["total"] or 0)


def register_pending_imaging_deletion(
    *,
    storage_name: str,
    size_bytes: int,
    uploader_id: int | None,
    patient_id: int | None = None,
    last_error: str = "",
) -> ImagingDeletionTask:
    """Persist physical-byte ownership until the provider confirms deletion."""

    normalized_name = str(storage_name or "").strip()
    if not normalized_name:
        raise ValueError("A storage object name is required for deferred deletion.")
    normalized_size = max(0, int(size_bytes))
    with transaction.atomic():
        task, _created = ImagingDeletionTask.objects.get_or_create(
            storage_name=normalized_name,
            defaults={
                "size_bytes": normalized_size,
                "uploader_id": uploader_id,
                "patient_id": patient_id,
                "last_error": str(last_error or "")[:255],
            },
        )
        task = ImagingDeletionTask.objects.select_for_update().get(pk=task.pk)
        update_fields = []
        if normalized_size > task.size_bytes:
            task.size_bytes = normalized_size
            update_fields.append("size_bytes")
        if task.uploader_id is None and uploader_id is not None:
            task.uploader_id = uploader_id
            update_fields.append("uploader_id")
        if task.patient_id is None and patient_id is not None:
            task.patient_id = patient_id
            update_fields.append("patient_id")
        normalized_error = str(last_error or "")[:255]
        if normalized_error and normalized_error != task.last_error:
            task.last_error = normalized_error
            update_fields.append("last_error")
        if update_fields:
            task.save(update_fields=[*update_fields, "updated_at"])
        return task


def enforce_storage_quota(*, additional_bytes: int, uploader_id: int, patient_id: int | None = None) -> None:
    additional_bytes = max(0, int(additional_bytes))
    patient_limit = int(settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES)
    user_limit = int(settings.PEARLIX_XRAY_USER_QUOTA_BYTES)
    global_limit = int(settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES)

    # Pre-6.2 deletion tasks cannot be attributed or sized safely. Fail closed
    # for new storage until cleanup confirms those legacy objects are absent.
    if ImagingDeletionTask.objects.filter(size_bytes=0).exists():
        raise StorageQuotaExceeded("clinic", global_limit)

    if patient_id is not None:
        patient_total = _sum(XrayAttachment.objects.filter(patient_id=patient_id))
        patient_total += _sum(
            AIResult.objects.filter(xray_attachment__patient_id=patient_id),
            "overlay_size_bytes",
        )
        patient_total += _sum(ImagingDeletionTask.objects.filter(patient_id=patient_id))
        if patient_total + additional_bytes > patient_limit:
            raise StorageQuotaExceeded("patient", patient_limit)

    user_total = _sum(XrayAttachment.objects.filter(uploaded_by_id=uploader_id)) + _sum(
        ExternalXrayCase.objects.filter(uploaded_by_id=uploader_id).exclude(original_file="")
    )
    user_total += _sum(
        AIResult.objects.filter(xray_attachment__uploaded_by_id=uploader_id)
        | AIResult.objects.filter(external_xray_case__uploaded_by_id=uploader_id),
        "overlay_size_bytes",
    )
    user_total += _sum(ImagingDeletionTask.objects.filter(uploader_id=uploader_id))
    if user_total + additional_bytes > user_limit:
        raise StorageQuotaExceeded("user", user_limit)

    global_total = _sum(XrayAttachment.objects.all()) + _sum(
        ExternalXrayCase.objects.exclude(original_file="")
    ) + _sum(AIResult.objects.all(), "overlay_size_bytes")
    global_total += _sum(ImagingDeletionTask.objects.all())
    if global_total + additional_bytes > global_limit:
        raise StorageQuotaExceeded("clinic", global_limit)
