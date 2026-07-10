from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class Patient(TimeStampedModel):
    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"
        UNSPECIFIED = "UNSPECIFIED", "Unspecified"

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50)
    gender = models.CharField(max_length=20, choices=Gender.choices, default=Gender.UNSPECIFIED)
    birth_date = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)
    medical_summary = models.TextField(blank=True)
    general_notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patients_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patients_updated",
    )

    class Meta:
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["full_name"]),
            models.Index(fields=["is_archived"]),
        ]
        ordering = ["full_name", "id"]

    def clean(self):
        errors = {}
        if not self.full_name or not self.full_name.strip():
            errors["full_name"] = "Full name is required."
        if not self.phone or not self.phone.strip():
            errors["phone"] = "Phone is required."
        if self.birth_date and self.birth_date > timezone.localdate():
            errors["birth_date"] = "Birth date cannot be in the future."
        if errors:
            raise ValidationError(errors)

    @property
    def age(self):
        if not self.birth_date:
            return None
        today = timezone.localdate()
        age = today.year - self.birth_date.year
        if (today.month, today.day) < (self.birth_date.month, self.birth_date.day):
            age -= 1
        return age

    def __str__(self) -> str:
        return self.full_name
