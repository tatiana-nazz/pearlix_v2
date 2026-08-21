from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.ai_results.adapters import InferenceAdapter, MOCK_MODEL_VERSION, MockInferenceAdapter
from apps.ai_results.adapters.base import InferenceConfigurationError, InferenceImageInvalidError
from apps.ai_results.models import AIExecutionState, AIInvocationBucket, AIResult
from apps.ai_results.model_contract import FINDINGS_SCHEMA_VERSION, MAX_IMAGE_INPUT_BYTES
from apps.ai_results.result_types import ImageInput, PipelineResult
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.xrays.image_validation import ImageValidationError, validate_image_upload
from apps.xrays.quota import StorageQuotaExceeded, enforce_storage_quota, lock_storage_admission


DEFAULT_PROCESSING_STALE_SECONDS = 15 * 60
_MOCK_ADAPTER = MockInferenceAdapter()


class AIServiceError(Exception):
    code = "AI_ANALYSIS_FAILED"
    public_message = "AI analysis failed."
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    audit_outcome = "failed"

    def __init__(self, *, result_id: int | None = None, model_version: str = ""):
        super().__init__(self.public_message)
        self.result_id = result_id
        self.model_version = model_version

    def to_response(self):
        details = {"result_id": self.result_id} if self.result_id is not None else {}
        return error_response(self.code, self.public_message, details, status_code=self.status_code)


class AIServiceNotConfigured(AIServiceError):
    code = "AI_SERVICE_NOT_CONFIGURED"
    public_message = "AI service is not configured for the selected AI mode."
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    audit_outcome = "rejected"


class AIAnalysisInProgress(AIServiceError):
    code = "AI_ANALYSIS_IN_PROGRESS"
    public_message = "AI analysis is already in progress."
    status_code = status.HTTP_409_CONFLICT
    audit_outcome = "rejected"


class AICapacityBusy(AIServiceError):
    code = "AI_CAPACITY_BUSY"
    public_message = "AI capacity is busy. Try again shortly."
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    audit_outcome = "rejected"


class AIRateLimited(AIServiceError):
    code = "AI_RATE_LIMITED"
    public_message = "AI invocation limit reached. Try again after the current window."
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    audit_outcome = "rejected"


class AIStorageQuotaExceeded(AIServiceError):
    code = "AI_STORAGE_QUOTA_EXCEEDED"
    public_message = "Imaging storage quota exceeded while saving the AI overlay."
    status_code = status.HTTP_409_CONFLICT


class AIImageUnavailable(AIServiceError):
    code = "AI_IMAGE_UNAVAILABLE"
    public_message = "X-ray image is unavailable for analysis."
    status_code = status.HTTP_404_NOT_FOUND


class AIImageInvalid(AIServiceError):
    code = "AI_IMAGE_INVALID"
    public_message = "X-ray image is invalid."
    status_code = status.HTTP_400_BAD_REQUEST


class AIAnalysisFailed(AIServiceError):
    code = "AI_ANALYSIS_FAILED"
    public_message = "AI analysis failed."
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR


class AISourceStateInvalid(AIServiceError):
    code = "INVALID_STATUS_TRANSITION"
    public_message = "AI can only run on temporary external X-ray cases."
    status_code = status.HTTP_409_CONFLICT
    audit_outcome = "rejected"


@dataclass(frozen=True)
class _ProcessingClaim:
    result_id: int
    claimed_at: datetime


def select_inference_adapter(ai_mode: str) -> InferenceAdapter:
    if ai_mode == ClinicSettings.AiMode.MOCK_ADAPTER:
        is_production = (
            str(getattr(settings, "PEARLIX_RUNTIME_ENVIRONMENT", "") or "").strip().lower()
            == "production"
        )
        if getattr(settings, "PEARLIX_ALLOW_MOCK_AI", False) and not is_production:
            return _MOCK_ADAPTER
        raise AIServiceNotConfigured
    if ai_mode == ClinicSettings.AiMode.DJANGO_INTERNAL:
        try:
            from apps.ai_results.adapters.dentex import get_dentex_adapter

            return get_dentex_adapter()
        except InferenceConfigurationError as exc:
            raise AIServiceNotConfigured from exc
    if ai_mode == ClinicSettings.AiMode.SEPARATE_SERVICE:
        try:
            from apps.ai_results.adapters.remote import get_remote_adapter

            return get_remote_adapter()
        except InferenceConfigurationError as exc:
            raise AIServiceNotConfigured from exc
    raise AIServiceNotConfigured


def load_image_input(file_field, *, content_type: str) -> ImageInput:
    try:
        handle = file_field.open("rb")
        try:
            content = handle.read(MAX_IMAGE_INPUT_BYTES + 1)
        finally:
            handle.close()
    except (FileNotFoundError, OSError, ValueError) as exc:
        raise AIImageUnavailable from exc
    if not content or len(content) > MAX_IMAGE_INPUT_BYTES:
        raise AIImageUnavailable
    try:
        return ImageInput(content=bytes(content), content_type=content_type)
    except ValueError as exc:
        raise AIImageUnavailable from exc


def _processing_stale_seconds() -> int:
    configured = int(getattr(settings, "PEARLIX_AI_PROCESSING_STALE_SECONDS", DEFAULT_PROCESSING_STALE_SECONDS))
    return configured if configured > 0 else DEFAULT_PROCESSING_STALE_SECONDS


def _is_active_processing(result: AIResult) -> bool:
    if result.status != AIResult.Status.PROCESSING:
        return False
    cutoff = timezone.now() - timedelta(seconds=_processing_stale_seconds())
    return result.updated_at > cutoff


def _safe_delete_storage_file(storage, name: str) -> None:
    try:
        storage.delete(name)
    except Exception as exc:
        from apps.xrays.models import ImagingDeletionTask

        ImagingDeletionTask.objects.update_or_create(
            storage_name=name,
            defaults={"last_error": str(exc)[:255]},
        )
        return


def _validate_locked_source(source) -> None:
    if isinstance(source, ExternalXrayCase) and source.status != ExternalXrayCase.Status.TEMPORARY:
        raise AISourceStateInvalid


def _locked_invocation_bucket(*, scope: str, key: str, now, expires_at) -> AIInvocationBucket:
    bucket, created = AIInvocationBucket.objects.get_or_create(
        scope=scope,
        key=key,
        defaults={
            "request_count": 0,
            "window_started_at": now,
            "expires_at": expires_at,
        },
    )
    if not created:
        bucket = AIInvocationBucket.objects.select_for_update().get(pk=bucket.pk)
    if bucket.expires_at <= now:
        bucket.request_count = 0
        bucket.window_started_at = now
        bucket.expires_at = expires_at
    return bucket


def _consume_invocation_budget(*, user) -> None:
    """Consume one admitted start; downstream validation/provider failures still count."""

    now = timezone.now()
    window_seconds = max(1, int(settings.PEARLIX_AI_INVOCATION_WINDOW_SECONDS))
    expires_at = now + timedelta(seconds=window_seconds)
    user_bucket = _locked_invocation_bucket(
        scope=AIInvocationBucket.Scope.USER,
        key=str(user.id),
        now=now,
        expires_at=expires_at,
    )
    clinic_bucket = _locked_invocation_bucket(
        scope=AIInvocationBucket.Scope.CLINIC,
        key="clinic",
        now=now,
        expires_at=expires_at,
    )
    if user_bucket.request_count >= max(1, int(settings.PEARLIX_AI_MAX_INVOCATIONS_PER_USER)):
        raise AIRateLimited
    if clinic_bucket.request_count >= max(1, int(settings.PEARLIX_AI_MAX_INVOCATIONS_GLOBAL)):
        raise AIRateLimited
    user_bucket.request_count += 1
    clinic_bucket.request_count += 1
    user_bucket.save(
        update_fields=[
            "request_count",
            "window_started_at",
            "expires_at",
            "updated_at",
        ]
    )
    clinic_bucket.save(
        update_fields=[
            "request_count",
            "window_started_at",
            "expires_at",
            "updated_at",
        ]
    )


def _claim_processing(*, source_model, source_id: int, source_field: str, user) -> tuple[_ProcessingClaim, object]:
    with transaction.atomic():
        AIExecutionState.objects.get_or_create(pk=1)
        AIExecutionState.objects.select_for_update().get(pk=1)
        source = source_model.objects.select_for_update().get(pk=source_id)
        _validate_locked_source(source)
        result = (
            AIResult.objects.select_for_update()
            .filter(**{f"{source_field}_id": source.id})
            .first()
        )
        if result is not None and _is_active_processing(result):
            raise AIAnalysisInProgress(result_id=result.id)

        cutoff = timezone.now() - timedelta(seconds=_processing_stale_seconds())
        active = AIResult.objects.filter(status=AIResult.Status.PROCESSING, updated_at__gt=cutoff)
        user_active = active.filter(requested_by_id=user.id).count()
        if user_active >= max(1, int(settings.PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER)):
            raise AICapacityBusy
        if active.count() >= max(1, int(settings.PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL)):
            raise AICapacityBusy
        _consume_invocation_budget(user=user)

        old_overlay = None
        if result is None:
            result = AIResult(**{source_field: source})
        elif result.overlay_file:
            old_overlay = (result.overlay_file.storage, result.overlay_file.name)

        result.status = AIResult.Status.PROCESSING
        result.requested_by = user
        result.result_summary = ""
        result.overall_confidence = None
        result.findings_json = {
            "schema_version": FINDINGS_SCHEMA_VERSION,
            "pipeline": {},
            "teeth": [],
            "display_findings": [],
        }
        result.overlay_file = None
        result.overlay_size_bytes = 0
        result.model_version = ""
        result.error_message = ""
        result.full_clean()
        result.save()

        if old_overlay:
            storage, name = old_overlay
            transaction.on_commit(lambda storage=storage, name=name: _safe_delete_storage_file(storage, name))
        return _ProcessingClaim(result_id=result.id, claimed_at=result.updated_at), source


def _claim_is_current(result: AIResult, claim: _ProcessingClaim) -> bool:
    return result.status == AIResult.Status.PROCESSING and result.updated_at == claim.claimed_at


def _mark_failed(claim: _ProcessingClaim, *, error_message: str) -> AIResult | None:
    with transaction.atomic():
        result = AIResult.objects.select_for_update().filter(pk=claim.result_id).first()
        if result is None or not _claim_is_current(result, claim):
            return None
        result.status = AIResult.Status.FAILED
        result.error_message = error_message
        result.full_clean()
        result.save(update_fields=["status", "error_message", "updated_at"])
        return result


def _complete_result(claim: _ProcessingClaim, pipeline_result: PipelineResult) -> AIResult:
    created_overlay = None
    try:
        with transaction.atomic():
            lock_storage_admission()
            result = AIResult.objects.select_for_update().get(pk=claim.result_id)
            if not _claim_is_current(result, claim):
                raise AIAnalysisInProgress(result_id=result.id, model_version=pipeline_result.model_version)

            payload = pipeline_result.to_persistence_payload()
            result.status = AIResult.Status.COMPLETED
            result.result_summary = payload["result_summary"]
            result.overall_confidence = payload["overall_confidence"]
            result.findings_json = payload["findings_json"]
            result.model_version = payload["model_version"]
            result.error_message = payload["error_message"]
            if pipeline_result.overlay_png is not None:
                overlay_upload = SimpleUploadedFile("overlay.png", pipeline_result.overlay_png, content_type="image/png")
                try:
                    validated_overlay = validate_image_upload(
                        overlay_upload, require_png=True, maximum_bytes=20 * 1024 * 1024
                    )
                except ImageValidationError as exc:
                    raise ValueError("Inference overlay failed validation.") from exc
                source = result.xray_attachment or result.external_xray_case
                patient_id = result.xray_attachment.patient_id if result.xray_attachment_id else None
                enforce_storage_quota(
                    additional_bytes=validated_overlay.size_bytes,
                    uploader_id=source.uploaded_by_id,
                    patient_id=patient_id,
                )
                result.overlay_file.save(f"{uuid4().hex}.png", ContentFile(validated_overlay.content), save=False)
                result.overlay_size_bytes = validated_overlay.size_bytes
                created_overlay = (result.overlay_file.storage, result.overlay_file.name)
            result.full_clean()
            result.save()
            return result
    except Exception:
        if created_overlay:
            _safe_delete_storage_file(*created_overlay)
        raise


def _execute_analysis(*, source_model, source_id: int, source_field: str, content_type: str, user) -> AIResult:
    clinic_settings = ClinicSettings.get_solo()
    adapter = select_inference_adapter(clinic_settings.ai_mode)
    if not isinstance(adapter, InferenceAdapter):
        raise AIServiceNotConfigured

    claim, locked_source = _claim_processing(
        source_model=source_model,
        source_id=source_id,
        source_field=source_field,
        user=user,
    )
    try:
        image = load_image_input(locked_source.original_file, content_type=content_type)
        pipeline_result = adapter.analyze(image)
        if not isinstance(pipeline_result, PipelineResult):
            raise TypeError("Inference adapter returned an unsupported result type.")
        if pipeline_result.model_version != adapter.model_version:
            raise ValueError("Inference adapter returned an unexpected model version.")
        return _complete_result(claim, pipeline_result)
    except AIAnalysisInProgress:
        raise
    except AIServiceError as exc:
        _mark_failed(claim, error_message=exc.public_message)
        exc.result_id = claim.result_id
        exc.model_version = adapter.model_version
        raise
    except InferenceImageInvalidError as exc:
        service_error = AIImageInvalid(result_id=claim.result_id, model_version=adapter.model_version)
        _mark_failed(claim, error_message=service_error.public_message)
        raise service_error from exc
    except InferenceConfigurationError as exc:
        service_error = AIServiceNotConfigured(result_id=claim.result_id, model_version=adapter.model_version)
        _mark_failed(claim, error_message=service_error.public_message)
        raise service_error from exc
    except StorageQuotaExceeded as exc:
        service_error = AIStorageQuotaExceeded(
            result_id=claim.result_id,
            model_version=adapter.model_version,
        )
        _mark_failed(claim, error_message=service_error.public_message)
        raise service_error from exc
    except Exception as exc:
        _mark_failed(claim, error_message=AIAnalysisFailed.public_message)
        raise AIAnalysisFailed(result_id=claim.result_id, model_version=adapter.model_version) from exc


def run_ai_for_xray(*, xray_attachment, user):
    return _execute_analysis(
        source_model=XrayAttachment,
        source_id=xray_attachment.id,
        source_field="xray_attachment",
        content_type=xray_attachment.content_type,
        user=user,
    )


def run_ai_for_external_case(*, external_xray_case, user):
    return _execute_analysis(
        source_model=ExternalXrayCase,
        source_id=external_xray_case.id,
        source_field="external_xray_case",
        content_type=external_xray_case.content_type,
        user=user,
    )
