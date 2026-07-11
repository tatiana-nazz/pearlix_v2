from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.ai_results.models import AIResult
from apps.common.errors import error_response
from apps.patients.selectors import user_can_read_patient_clinical_history
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


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
    if not extension or extension not in ALLOWED_XRAY_EXTENSIONS or any(suffix in REJECTED_EXTENSIONS for suffix in suffixes):
        raise XrayUploadError(
            "UNSUPPORTED_FILE_TYPE",
            "Unsupported X-ray file type.",
            {"allowed_extensions": sorted(ALLOWED_XRAY_EXTENSIONS)},
        )

    if uploaded_file.size > MAX_XRAY_SIZE_BYTES:
        raise XrayUploadError(
            "FILE_TOO_LARGE",
            "X-ray file is too large.",
            {"max_size_bytes": MAX_XRAY_SIZE_BYTES},
        )

    content_type = getattr(uploaded_file, "content_type", "") or ""
    if content_type not in ALLOWED_CONTENT_TYPES[extension]:
        raise XrayUploadError(
            "UNSUPPORTED_FILE_TYPE",
            "Unsupported X-ray content type.",
            {"content_type": content_type},
        )

    return {
        "extension": extension,
        "original_file_name": original_name,
        "content_type": content_type,
        "size_bytes": uploaded_file.size,
    }


def create_xray_attachment(*, patient, visit, uploaded_by, uploaded_file, title="", notes="", source=None, stored_file_name=None):
    metadata = validate_xray_file(uploaded_file)
    stored_file_name = stored_file_name or f"{uuid4().hex}{metadata['extension']}"
    xray = XrayAttachment(
        patient=patient,
        visit=visit,
        uploaded_by=uploaded_by,
        source=source or (XrayAttachment.Source.ACTIVE_VISIT if visit else XrayAttachment.Source.PATIENT_PROFILE),
        original_file=uploaded_file,
        stored_file_name=stored_file_name,
        original_file_name=metadata["original_file_name"],
        content_type=metadata["content_type"],
        size_bytes=metadata["size_bytes"],
        title=(title or "").strip(),
        notes=(notes or "").strip(),
    )
    xray.full_clean()
    xray.save()
    return xray


def create_external_xray_case(*, uploaded_by, uploaded_file, title="", notes="", stored_file_name=None):
    metadata = validate_xray_file(uploaded_file)
    stored_file_name = stored_file_name or f"{uuid4().hex}{metadata['extension']}"
    external = ExternalXrayCase(
        uploaded_by=uploaded_by,
        original_file=uploaded_file,
        stored_file_name=stored_file_name,
        original_file_name=metadata["original_file_name"],
        content_type=metadata["content_type"],
        size_bytes=metadata["size_bytes"],
        title=(title or "").strip(),
        notes=(notes or "").strip(),
    )
    external.full_clean()
    external.save()
    return external


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


def discard_external_case(*, external_case, user):
    with transaction.atomic():
        external_case = ExternalXrayCase.objects.select_for_update().get(pk=external_case.pk)
        validate_external_temporary(external_case, "Only temporary external X-ray cases can be discarded.")
        external_case.status = ExternalXrayCase.Status.DISCARDED
        external_case.discarded_at = timezone.now()
        external_case.save(update_fields=["status", "discarded_at", "updated_at"])
        return external_case


def _copy_external_file_to_saved_xray(*, external_case, patient, visit, uploaded_by, title, notes):
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
    xray.save()
    return xray


def _copy_external_ai_result(*, external_case, xray_attachment):
    external_result = getattr(external_case, "ai_result", None)
    if not external_result:
        return None
    result = AIResult(
        xray_attachment=xray_attachment,
        status=external_result.status,
        result_summary=external_result.result_summary,
        overall_confidence=external_result.overall_confidence,
        findings_json=external_result.findings_json,
        overlay_file=external_result.overlay_file,
        model_version=external_result.model_version,
        error_message=external_result.error_message,
    )
    result.full_clean()
    result.save()
    return result


def attach_external_case_to_patient(*, external_case, patient, visit, user, title="", notes=""):
    with transaction.atomic():
        external_case = (
            ExternalXrayCase.objects.select_for_update(of=("self",))
            .select_related("uploaded_by", "ai_result")
            .get(pk=external_case.pk)
        )
        validate_external_temporary(external_case, "Only temporary external X-ray cases can be attached.")
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

        xray = _copy_external_file_to_saved_xray(
            external_case=external_case,
            patient=patient,
            visit=visit,
            uploaded_by=user,
            title=title,
            notes=notes,
        )
        _copy_external_ai_result(external_case=external_case, xray_attachment=xray)

        external_case.status = ExternalXrayCase.Status.ATTACHED_TO_PATIENT
        external_case.attached_patient = patient
        external_case.attached_visit = visit
        external_case.attached_xray = xray
        external_case.attached_at = timezone.now()
        external_case.save(
            update_fields=[
                "status",
                "attached_patient",
                "attached_visit",
                "attached_xray",
                "attached_at",
                "updated_at",
            ]
        )
        return external_case
