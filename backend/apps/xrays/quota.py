from __future__ import annotations

from django.conf import settings
from django.db.models import Sum

from apps.ai_results.models import AIResult
from apps.xrays.models import ExternalXrayCase, XrayAttachment, XrayStorageState


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


def enforce_storage_quota(*, additional_bytes: int, uploader_id: int, patient_id: int | None = None) -> None:
    additional_bytes = max(0, int(additional_bytes))
    patient_limit = int(settings.PEARLIX_XRAY_PATIENT_QUOTA_BYTES)
    user_limit = int(settings.PEARLIX_XRAY_USER_QUOTA_BYTES)
    global_limit = int(settings.PEARLIX_XRAY_GLOBAL_QUOTA_BYTES)

    if patient_id is not None:
        patient_total = _sum(XrayAttachment.objects.filter(patient_id=patient_id))
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
    if user_total + additional_bytes > user_limit:
        raise StorageQuotaExceeded("user", user_limit)

    global_total = _sum(XrayAttachment.objects.all()) + _sum(
        ExternalXrayCase.objects.exclude(original_file="")
    ) + _sum(AIResult.objects.all(), "overlay_size_bytes")
    if global_total + additional_bytes > global_limit:
        raise StorageQuotaExceeded("clinic", global_limit)
