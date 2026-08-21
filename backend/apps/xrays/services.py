from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status

from apps.ai_results.models import AIResult
from apps.common.errors import error_response
from apps.patients.selectors import user_can_read_patient_clinical_history
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask, XrayAttachment
from apps.xrays.image_validation import ImageValidationError, validate_image_upload
from apps.xrays.quota import (
    StorageQuotaExceeded,
    enforce_storage_quota,
    lock_storage_admission,
    register_pending_imaging_deletion,
)


ALLOWED_XRAY_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_CONTENT_TYPES = {
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
}
REJECTED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".php",
    ".html",
    ".svg",
    ".pdf",
    ".zip",
    ".rar",
    ".js",
}
MAX_XRAY_SIZE_BYTES = 10 * 1024 * 1024


class XrayUploadError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


class XrayDeleteError(Exception):
    def __init__(self, code: str, message: str, status_code: int):
        self.code = code
        self.message = message
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, status_code=self.status_code)


def _metadata_filename(name: str) -> str:
    return name.replace("\\", "/").split("/")[-1]


def _file_suffixes(name: str) -> list[str]:
    return [suffix.lower() for suffix in Path(_metadata_filename(name)).suffixes]


def validate_xray_file(uploaded_file):
    if uploaded_file is None:
        raise XrayUploadError("VALIDATION_ERROR", "Some fields are invalid.", {"file": ["This field is required."]})

    original_name = _metadata_filename(uploaded_file.name or "")
    suffixes = _file_suffixes(original_name)
    extension = suffixes[-1] if suffixes else ""
    declared_type = str(getattr(uploaded_file, "content_type", "") or "").lower()
    if not extension or extension not in ALLOWED_XRAY_EXTENSIONS or any(suffix in REJECTED_EXTENSIONS for suffix in suffixes):
        raise XrayUploadError("UNSUPPORTED_FILE_TYPE", "Unsupported X-ray file type.", {"allowed_extensions": sorted(ALLOWED_XRAY_EXTENSIONS)})
    if declared_type not in ALLOWED_CONTENT_TYPES[extension]:
        raise XrayUploadError("UNSUPPORTED_FILE_TYPE", "Unsupported X-ray content type.", {"content_type": declared_type})
    try:
        validated = validate_image_upload(uploaded_file)
    except ImageValidationError as exc:
        code = "FILE_TOO_LARGE" if "byte limit" in str(exc) else "INVALID_IMAGE"
        raise XrayUploadError(code, "The X-ray image is invalid.", {"file": [str(exc)]}) from exc
    return {
        "extension": validated.extension,
        "original_file_name": validated.original_file_name,
        "content_type": validated.content_type,
        "size_bytes": validated.size_bytes,
        "width": validated.width,
        "height": validated.height,
        "content": validated.content,
    }


def _quota_error(exc: StorageQuotaExceeded) -> XrayUploadError:
    return XrayUploadError(
        "STORAGE_QUOTA_EXCEEDED",
        "Imaging storage quota exceeded.",
        {"dimension": exc.dimension, "limit_bytes": exc.limit},
        status_code=status.HTTP_409_CONFLICT,
    )


def _save_with_storage_compensation(instance):
    try:
        instance.full_clean()
        instance.save()
    except Exception:
        field = instance.original_file
        if field and getattr(field, "_committed", False) and field.name:
            try:
                field.storage.delete(field.name)
            except Exception:
                pass
        raise


def create_xray_attachment(*, patient, visit, uploaded_by, uploaded_file, title="", notes="", source=None, stored_file_name=None):
    metadata = validate_xray_file(uploaded_file)
    stored_file_name = stored_file_name or f"{uuid4().hex}{metadata['extension']}"
    xray = None
    try:
        with transaction.atomic():
            lock_storage_admission()
            enforce_storage_quota(additional_bytes=metadata["size_bytes"], uploader_id=uploaded_by.id, patient_id=patient.id)
            xray = XrayAttachment(
                patient=patient, visit=visit, uploaded_by=uploaded_by,
                source=source or (XrayAttachment.Source.ACTIVE_VISIT if visit else XrayAttachment.Source.PATIENT_PROFILE),
                original_file=ContentFile(metadata["content"], name=metadata["original_file_name"]),
                stored_file_name=stored_file_name, original_file_name=metadata["original_file_name"],
                content_type=metadata["content_type"], size_bytes=metadata["size_bytes"],
                title=(title or "").strip(), notes=(notes or "").strip(),
            )
            _save_with_storage_compensation(xray)
            return xray
    except StorageQuotaExceeded as exc:
        raise _quota_error(exc) from exc
    except Exception:
        if xray is not None and xray.original_file and getattr(xray.original_file, "_committed", False):
            _delete_storage_files(
                [
                    (
                        xray.original_file.storage,
                        xray.original_file.name,
                        metadata["size_bytes"],
                        uploaded_by.id,
                        patient.id,
                    )
                ]
            )
        raise


def create_external_xray_case(*, uploaded_by, uploaded_file, title="", notes="", stored_file_name=None):
    metadata = validate_xray_file(uploaded_file)
    stored_file_name = stored_file_name or f"{uuid4().hex}{metadata['extension']}"
    external = None
    try:
        with transaction.atomic():
            lock_storage_admission()
            enforce_storage_quota(additional_bytes=metadata["size_bytes"], uploader_id=uploaded_by.id)
            external = ExternalXrayCase(
                uploaded_by=uploaded_by,
                original_file=ContentFile(metadata["content"], name=metadata["original_file_name"]),
                stored_file_name=stored_file_name, original_file_name=metadata["original_file_name"],
                content_type=metadata["content_type"], size_bytes=metadata["size_bytes"],
                title=(title or "").strip(), notes=(notes or "").strip(),
            )
            _save_with_storage_compensation(external)
            return external
    except StorageQuotaExceeded as exc:
        raise _quota_error(exc) from exc
    except Exception:
        if external is not None and external.original_file and getattr(external.original_file, "_committed", False):
            _delete_storage_files(
                [
                    (
                        external.original_file.storage,
                        external.original_file.name,
                        metadata["size_bytes"],
                        uploaded_by.id,
                        None,
                    )
                ]
            )
        raise


class ExternalXrayRuleError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def validate_external_temporary(external_case, message="External X-ray case is not temporary."):
    if external_case.status != ExternalXrayCase.Status.TEMPORARY:
        raise ExternalXrayRuleError(
            "INVALID_STATUS_TRANSITION",
            message,
            status_code=status.HTTP_409_CONFLICT,
        )


def validate_external_not_processing(external_case):
    ai_result = getattr(external_case, "ai_result", None)
    if ai_result is not None and ai_result.status == AIResult.Status.PROCESSING:
        raise ExternalXrayRuleError(
            "AI_ANALYSIS_IN_PROGRESS",
            "AI analysis is already in progress.",
            status_code=status.HTTP_409_CONFLICT,
        )


def discard_external_case(*, external_case, user):
    with transaction.atomic():
        external_case = (
            ExternalXrayCase.objects.select_for_update(of=("self",))
            .select_related("ai_result")
            .get(pk=external_case.pk)
        )
        validate_external_temporary(external_case, "Only temporary external X-ray cases can be discarded.")
        validate_external_not_processing(external_case)
        external_case.status = ExternalXrayCase.Status.DISCARDED
        external_case.discarded_at = timezone.now()
        external_case.purge_after = _external_purge_deadline()
        external_case.save(update_fields=["status", "discarded_at", "purge_after", "updated_at"])
        transaction.on_commit(lambda external_id=external_case.id: purge_external_artifacts(external_id))
        return external_case


def _external_purge_deadline():
    from datetime import timedelta

    hours = max(0, int(getattr(settings, "PEARLIX_EXTERNAL_XRAY_RETENTION_HOURS", 0)))
    return timezone.now() + timedelta(hours=hours)


def purge_external_artifacts(external_id: int) -> bool:
    """Idempotently remove non-clinical duplicate blobs; failures remain retryable."""
    with transaction.atomic():
        external_cases = ExternalXrayCase.objects.select_related("ai_result")
        if connection.features.has_select_for_update_skip_locked:
            external_cases = external_cases.select_for_update(of=("self",), skip_locked=True)
        else:
            external_cases = external_cases.select_for_update(of=("self",))
        locked = external_cases.filter(pk=external_id).first()
        if (
            locked is None
            or locked.artifacts_purged_at
            or not locked.purge_after
            or locked.purge_after > timezone.now()
        ):
            return False
        files = []
        if locked.original_file and locked.original_file.name:
            files.append((locked.original_file.storage, locked.original_file.name))
        ai_result = getattr(locked, "ai_result", None)
        if ai_result is not None and ai_result.overlay_file and ai_result.overlay_file.name:
            files.append((ai_result.overlay_file.storage, ai_result.overlay_file.name))
        try:
            for storage, name in files:
                storage.delete(name)
        except Exception:
            return False
        locked.original_file = ""
        locked.artifacts_purged_at = timezone.now()
        locked.save(update_fields=["original_file", "artifacts_purged_at", "updated_at"])
        AIResult.objects.filter(external_xray_case_id=external_id).update(overlay_file="", overlay_size_bytes=0)
    return True


def _copy_external_file_to_saved_xray(
    *,
    external_case,
    patient,
    visit,
    uploaded_by,
    title,
    notes,
    created_storage_files,
):
    extension = Path(external_case.stored_file_name).suffix.lower()
    source_stem = Path(external_case.stored_file_name).stem
    stored_file_name = (
        f"{source_stem}-attached-{uuid4().hex}{extension}"
        if source_stem.startswith("demo")
        else f"{uuid4().hex}{extension}"
    )
    external_case.original_file.open("rb")
    try:
        content = external_case.original_file.read()
    finally:
        external_case.original_file.close()

    xray = XrayAttachment(
        patient=patient,
        visit=visit,
        uploaded_by=uploaded_by,
        source=XrayAttachment.Source.EXTERNAL_WORKSPACE,
        original_file=ContentFile(content, name=external_case.original_file_name),
        stored_file_name=stored_file_name,
        original_file_name=external_case.original_file_name,
        content_type=external_case.content_type,
        size_bytes=external_case.size_bytes,
        title=(title or external_case.title or "").strip(),
        notes=(notes or external_case.notes or "").strip(),
    )
    xray.full_clean()
    try:
        xray.save()
    except Exception:
        if xray.original_file and getattr(xray.original_file, "_committed", False):
            created_storage_files.append(
                (
                    xray.original_file.storage,
                    xray.original_file.name,
                    xray.size_bytes,
                    uploaded_by.id,
                    patient.id,
                )
            )
        raise
    created_storage_files.append(
        (
            xray.original_file.storage,
            xray.original_file.name,
            xray.size_bytes,
            uploaded_by.id,
            patient.id,
        )
    )
    return xray


def _delete_storage_files(files):
    for storage, name, size_bytes, uploader_id, patient_id in files:
        if not name:
            continue
        try:
            storage.delete(name)
        except Exception as exc:
            register_pending_imaging_deletion(
                storage_name=name,
                size_bytes=size_bytes,
                uploader_id=uploader_id,
                patient_id=patient_id,
                last_error=str(exc),
            )
            continue


def process_imaging_deletion_task(task_id: int) -> bool:
    from django.core.files.storage import default_storage

    with transaction.atomic():
        tasks = ImagingDeletionTask.objects
        if connection.features.has_select_for_update_skip_locked:
            tasks = tasks.select_for_update(skip_locked=True)
        else:
            tasks = tasks.select_for_update()
        task = tasks.filter(pk=task_id).first()
        if task is None:
            return False
        try:
            default_storage.delete(task.storage_name)
        except Exception as exc:
            task.attempts += 1
            task.last_error = str(exc)[:255]
            task.save(update_fields=["attempts", "last_error", "updated_at"])
            return False
        task.delete()
        return True


def delete_xray_attachment(*, xray):
    with transaction.atomic():
        lock_storage_admission()
        locked_xray = (
            XrayAttachment.objects.select_for_update(of=("self",))
            .select_related("patient", "visit", "uploaded_by", "ai_result")
            .get(pk=xray.pk)
        )
        ai_result = getattr(locked_xray, "ai_result", None)
        if ai_result is not None and ai_result.status == AIResult.Status.PROCESSING:
            raise XrayDeleteError(
                "AI_ANALYSIS_IN_PROGRESS",
                "AI analysis is already in progress.",
                status.HTTP_409_CONFLICT,
            )

        files = [
            (
                locked_xray.original_file.storage,
                locked_xray.original_file.name,
                locked_xray.size_bytes,
                locked_xray.uploaded_by_id,
                locked_xray.patient_id,
            )
        ]
        if ai_result is not None and ai_result.overlay_file:
            files.append(
                (
                    ai_result.overlay_file.storage,
                    ai_result.overlay_file.name,
                    ai_result.overlay_size_bytes,
                    locked_xray.uploaded_by_id,
                    locked_xray.patient_id,
                )
            )

        summary = {
            "xray_id": locked_xray.id,
            "patient_id": locked_xray.patient_id,
            "visit_id": locked_xray.visit_id,
            "uploaded_by_id": locked_xray.uploaded_by_id,
            "had_ai_result": ai_result is not None,
        }
        ExternalXrayCase.objects.filter(attached_xray=locked_xray).update(attached_xray=None)
        locked_xray.delete()
        task_ids = [
            register_pending_imaging_deletion(
                storage_name=name,
                size_bytes=size_bytes,
                uploader_id=uploader_id,
                patient_id=patient_id,
            ).id
            for _storage, name, size_bytes, uploader_id, patient_id in files
            if name
        ]
        transaction.on_commit(lambda: [process_imaging_deletion_task(task_id) for task_id in task_ids])
        return summary


def _copy_external_ai_result(*, external_case, xray_attachment, created_storage_files):
    external_result = getattr(external_case, "ai_result", None)
    if not external_result:
        return None
    result = AIResult(
        xray_attachment=xray_attachment,
        requested_by=external_result.requested_by,
        status=external_result.status,
        result_summary=external_result.result_summary,
        overall_confidence=external_result.overall_confidence,
        findings_json=deepcopy(external_result.findings_json),
        model_version=external_result.model_version,
        error_message=external_result.error_message,
    )
    if external_result.overlay_file:
        source_handle = external_result.overlay_file.open("rb")
        try:
            overlay_content = source_handle.read()
        finally:
            source_handle.close()
        result.overlay_file.save(f"{uuid4().hex}.png", ContentFile(overlay_content), save=False)
        result.overlay_size_bytes = len(overlay_content)
        created_storage_files.append(
            (
                result.overlay_file.storage,
                result.overlay_file.name,
                result.overlay_size_bytes,
                xray_attachment.uploaded_by_id,
                xray_attachment.patient_id,
            )
        )
    result.full_clean()
    result.save()
    return result


def attach_external_case_to_patient(*, external_case, patient, visit, user, title="", notes=""):
    created_storage_files = []
    try:
        with transaction.atomic():
            lock_storage_admission()
            external_case = (
                ExternalXrayCase.objects.select_for_update(of=("self",))
                .select_related("uploaded_by", "ai_result")
                .get(pk=external_case.pk)
            )
            validate_external_temporary(external_case, "Only temporary external X-ray cases can be attached.")
            validate_external_not_processing(external_case)
            if not user_can_read_patient_clinical_history(user, patient):
                raise ExternalXrayRuleError("NOT_FOUND", "Patient was not found.", status_code=status.HTTP_404_NOT_FOUND)
            if visit is not None:
                if visit.patient_id != patient.id:
                    raise ExternalXrayRuleError(
                        "VALIDATION_ERROR",
                        "Some fields are invalid.",
                        {"visit_id": ["Visit must belong to the selected patient."]},
                    )
                if visit.doctor_id != user.id:
                    raise ExternalXrayRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)

            external_overlay_bytes = int(getattr(getattr(external_case, "ai_result", None), "overlay_size_bytes", 0) or 0)
            try:
                enforce_storage_quota(
                    additional_bytes=external_case.size_bytes + external_overlay_bytes,
                    uploader_id=user.id,
                    patient_id=patient.id,
                )
            except StorageQuotaExceeded as exc:
                raise ExternalXrayRuleError(
                    "STORAGE_QUOTA_EXCEEDED",
                    "Imaging storage quota exceeded.",
                    {"dimension": exc.dimension, "limit_bytes": exc.limit},
                    status_code=status.HTTP_409_CONFLICT,
                ) from exc

            xray = _copy_external_file_to_saved_xray(
                external_case=external_case,
                patient=patient,
                visit=visit,
                uploaded_by=user,
                title=title,
                notes=notes,
                created_storage_files=created_storage_files,
            )
            _copy_external_ai_result(
                external_case=external_case,
                xray_attachment=xray,
                created_storage_files=created_storage_files,
            )

            external_case.status = ExternalXrayCase.Status.ATTACHED_TO_PATIENT
            external_case.attached_patient = patient
            external_case.attached_visit = visit
            external_case.attached_xray = xray
            external_case.attached_at = timezone.now()
            external_case.purge_after = _external_purge_deadline()
            external_case.save(
                update_fields=[
                    "status",
                    "attached_patient",
                    "attached_visit",
                    "attached_xray",
                    "attached_at",
                    "purge_after",
                    "updated_at",
                ]
            )
            transaction.on_commit(lambda external_id=external_case.id: purge_external_artifacts(external_id))
            return external_case
    except Exception:
        _delete_storage_files(reversed(created_storage_files))
        raise
