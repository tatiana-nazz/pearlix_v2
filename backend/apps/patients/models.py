from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class Patient(TimeStampedModel):
    class Gender(models.TextChoices):
        MALE = "Male", "Male"
        FEMALE = "Female", "Female"

    class BloodGroup(models.TextChoices):
        A_POSITIVE = "A+", "A+"
        A_NEGATIVE = "A-", "A-"
        B_POSITIVE = "B+", "B+"
        B_NEGATIVE = "B-", "B-"
        AB_POSITIVE = "AB+", "AB+"
        AB_NEGATIVE = "AB-", "AB-"
        O_POSITIVE = "O+", "O+"
        O_NEGATIVE = "O-", "O-"

    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices)
    date_of_birth = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    national_id_or_passport = models.CharField(max_length=100, null=True, blank=True, unique=True)
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    blood_group = models.CharField(max_length=3, choices=BloodGroup.choices, blank=True)
    medical_conditions_history = models.TextField(blank=True)
    insurance_info = models.TextField(blank=True)
    general_notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
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
            models.Index(fields=["first_name", "last_name"]),
            models.Index(fields=["phone_number"]),
            models.Index(fields=["email"]),
            models.Index(fields=["national_id_or_passport"]),
            models.Index(fields=["is_archived"]),
        ]
        ordering = ["first_name", "last_name", "id"]

    @property
    def full_name(self):
        return " ".join(part for part in [self.first_name.strip(), self.last_name.strip()] if part).strip()

    def clean(self):
        errors = {}
        if not self.first_name or not self.first_name.strip():
            errors["first_name"] = "First name is required."
        if not self.last_name or not self.last_name.strip():
            errors["last_name"] = "Last name is required."
        if self.date_of_birth and self.date_of_birth > timezone.localdate():
            errors["date_of_birth"] = "Date of birth cannot be in the future."
        if errors:
            raise ValidationError(errors)

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = timezone.localdate()
        if self.date_of_birth > today:
            return None
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age

    def save(self, *args, **kwargs):
        self.first_name = self.first_name.strip()
        self.last_name = self.last_name.strip()
        self.phone_number = self.phone_number.strip()
        self.email = self.email.strip()
        self.emergency_contact = self.emergency_contact.strip()
        if self.national_id_or_passport is not None:
            normalized_identity = self.national_id_or_passport.strip()
            self.national_id_or_passport = normalized_identity or None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.full_name
