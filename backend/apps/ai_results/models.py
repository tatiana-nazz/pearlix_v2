from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.ai_results.adapters.mock import (
    MOCK_ADAPTER_NAME,
    MOCK_MODEL_VERSION,
    MOCK_SCORE_SEMANTICS,
)
from apps.common.models import TimeStampedModel


def ai_overlay_upload_path(instance, filename):
    stored_name = Path(filename).name
    return f"ai-overlays/{stored_name[:2]}/{stored_name}"


class AIResult(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    xray_attachment = models.OneToOneField(
        "xrays.XrayAttachment",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ai_result",
    )
    external_xray_case = models.OneToOneField(
        "xrays.ExternalXrayCase",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ai_result",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="requested_ai_results",
    )
    result_summary = models.CharField(max_length=255, blank=True)
    overall_confidence = models.FloatField(null=True, blank=True)
    findings_json = models.JSONField(default=list)
    overlay_file = models.FileField(upload_to=ai_overlay_upload_path, null=True, blank=True)
    overlay_size_bytes = models.PositiveIntegerField(default=0)
    model_version = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(xray_attachment__isnull=False, external_xray_case__isnull=True)
                    | Q(xray_attachment__isnull=True, external_xray_case__isnull=False)
                ),
                name="ai_result_exactly_one_source",
            )
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if bool(self.xray_attachment_id) == bool(self.external_xray_case_id):
            errors["source"] = "Exactly one AI result source is required."
        if self.overall_confidence is not None and not 0 <= self.overall_confidence <= 1:
            errors["overall_confidence"] = "Overall confidence must be between 0 and 1."
        if self.status == self.Status.COMPLETED and not self.model_version:
            errors["model_version"] = "Model version is required for completed AI results."
        if self.overlay_file and Path(self.overlay_file.name).suffix.lower() != ".png":
            errors["overlay_file"] = "AI overlay file must be png."
        if self._is_production_mock_result():
            errors["model_version"] = "Synthetic AI results cannot be persisted in production."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self._is_production_mock_result():
            raise ValidationError(
                {"model_version": "Synthetic AI results cannot be persisted in production."}
            )
        return super().save(*args, **kwargs)

    def _is_production_mock_result(self) -> bool:
        if (
            str(getattr(settings, "PEARLIX_RUNTIME_ENVIRONMENT", "") or "").strip().lower()
            != "production"
        ):
            return False
        pipeline = (
            self.findings_json.get("pipeline", {})
            if isinstance(self.findings_json, dict)
            else {}
        )
        return (
            self.model_version == MOCK_MODEL_VERSION
            or pipeline.get("adapter") == MOCK_ADAPTER_NAME
            or pipeline.get("score_semantics") == MOCK_SCORE_SEMANTICS
        )

    def __str__(self) -> str:
        source_id = self.xray_attachment_id or self.external_xray_case_id
        return f"AI result for source {source_id}"


class AIExecutionState(models.Model):
    """Stable singleton row used to serialize distributed AI admission."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return "AI execution admission state"


class AIInvocationBucket(models.Model):
    """Stable fixed-window counters protected by the AI execution-state lock."""

    class Scope(models.TextChoices):
        USER = "USER", "User"
        CLINIC = "CLINIC", "Clinic"

    scope = models.CharField(max_length=20, choices=Scope.choices)
    key = models.CharField(max_length=64)
    request_count = models.PositiveIntegerField(default=0)
    window_started_at = models.DateTimeField()
    expires_at = models.DateTimeField(db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scope", "key"],
                name="ai_invocation_bucket_scope_key_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.scope}:{self.key}"
