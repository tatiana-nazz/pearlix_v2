from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.common.models import TimeStampedModel


class Visit(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"

    appointment = models.OneToOneField("scheduling.Appointment", on_delete=models.PROTECT, related_name="visit")
    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="visits")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="visits")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    symptoms = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    treatment = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)
    follow_up_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="visits_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="visits_updated",
    )

    class Meta:
        indexes = [
            models.Index(fields=["doctor", "status"]),
            models.Index(fields=["patient", "started_at"]),
            models.Index(fields=["appointment"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["doctor"],
                condition=Q(status="ACTIVE"),
                name="unique_active_visit_per_doctor",
            )
        ]
        ordering = ["-started_at", "-id"]

    def clean(self):
        errors = {}
        if self.doctor_id and self.doctor.role != "DOCTOR":
            errors["doctor"] = "Visit doctor must have DOCTOR role."
        if self.appointment_id:
            if self.patient_id and self.appointment.patient_id != self.patient_id:
                errors["patient"] = "Visit patient must match appointment patient."
            if self.doctor_id and self.appointment.doctor_id != self.doctor_id:
                errors["doctor"] = "Visit doctor must match appointment doctor."
        if self.completed_at and self.started_at and self.completed_at < self.started_at:
            errors["completed_at"] = "Completed time cannot be before started time."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"Visit {self.id} for {self.patient}"
