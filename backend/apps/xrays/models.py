from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


def xray_upload_path(instance, filename):
    stored_name = instance.stored_file_name or Path(filename).name
    return f"xrays/{stored_name[:2]}/{stored_name}"


class XrayAttachment(TimeStampedModel):
    class Source(models.TextChoices):
        ACTIVE_VISIT = "ACTIVE_VISIT", "Active visit"
        PATIENT_PROFILE = "PATIENT_PROFILE", "Patient profile"
        EXTERNAL_WORKSPACE = "EXTERNAL_WORKSPACE", "External workspace"

    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="xrays")
    visit = models.ForeignKey("visits.Visit", null=True, blank=True, on_delete=models.PROTECT, related_name="xrays")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_xrays")
    source = models.CharField(max_length=30, choices=Source.choices, default=Source.ACTIVE_VISIT)
    original_file = models.FileField(upload_to=xray_upload_path)
    stored_file_name = models.CharField(max_length=255)
    original_file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["visit", "created_at"]),
            models.Index(fields=["uploaded_by", "created_at"]),
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if self.uploaded_by_id and self.uploaded_by.role != "DOCTOR":
            errors["uploaded_by"] = "Saved X-rays must be uploaded by a doctor."
        if self.visit_id and self.patient_id and self.visit.patient_id != self.patient_id:
            errors["visit"] = "Visit must belong to the same patient as the X-ray."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return self.title or self.original_file_name


def external_xray_upload_path(instance, filename):
    stored_name = instance.stored_file_name or Path(filename).name
    return f"external-xrays/{stored_name[:2]}/{stored_name}"


class ExternalXrayCase(TimeStampedModel):
    class Status(models.TextChoices):
        TEMPORARY = "TEMPORARY", "Temporary"
        ATTACHED_TO_PATIENT = "ATTACHED_TO_PATIENT", "Attached to patient"
        DISCARDED = "DISCARDED", "Discarded"

    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="external_xray_cases")
    original_file = models.FileField(upload_to=external_xray_upload_path, blank=True)
    stored_file_name = models.CharField(max_length=255)
    original_file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.TEMPORARY)
    attached_patient = models.ForeignKey(
        "patients.Patient",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="attached_external_xray_cases",
    )
    attached_visit = models.ForeignKey(
        "visits.Visit",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="attached_external_xray_cases",
    )
    attached_xray = models.ForeignKey(
        "xrays.XrayAttachment",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="external_cases",
    )
    discarded_at = models.DateTimeField(null=True, blank=True)
    attached_at = models.DateTimeField(null=True, blank=True)
    purge_after = models.DateTimeField(null=True, blank=True)
    purge_attempts = models.PositiveIntegerField(default=0)
    purge_last_error = models.CharField(max_length=255, blank=True)
    purge_last_attempt_at = models.DateTimeField(null=True, blank=True)
    purge_next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    artifacts_purged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["uploaded_by", "status", "created_at"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["attached_patient", "created_at"]),
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if self.uploaded_by_id and self.uploaded_by.role not in {"ADMIN", "DOCTOR"}:
            errors["uploaded_by"] = "External X-rays can only be uploaded by Admin or Doctor users."
        if self.attached_visit_id and self.attached_patient_id and self.attached_visit.patient_id != self.attached_patient_id:
            errors["attached_visit"] = "Attached visit must belong to the attached patient."
        if self.status == self.Status.ATTACHED_TO_PATIENT and not self.attached_patient_id:
            errors["attached_patient"] = "Attached patient is required after attachment."
        if self.status == self.Status.DISCARDED and not self.discarded_at:
            errors["discarded_at"] = "Discarded timestamp is required after discard."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return self.title or self.original_file_name


class XrayStorageState(models.Model):
    """Stable singleton row used to serialize cumulative storage admission."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return "X-ray storage admission state"


class ImagingDeletionTask(TimeStampedModel):
    storage_name = models.CharField(max_length=1024, unique=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    uploader_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    patient_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.CharField(max_length=255, blank=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return self.storage_name
