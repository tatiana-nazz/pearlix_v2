from django.core.exceptions import ValidationError
from django.db import models
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apps.common.models import TimeStampedModel


def default_weekly_closed_days():
    return [4]


def normalize_weekly_closed_days(value):
    if not isinstance(value, list):
        raise ValidationError("Weekly closed days must be a list.")
    if any(type(item) is not int or item < 0 or item > 6 for item in value):
        raise ValidationError("Weekly closed days must contain only integers from 0 through 6.")
    if len(value) != len(set(value)):
        raise ValidationError("Weekly closed days cannot contain duplicates.")
    if len(value) == 7:
        raise ValidationError("At least one weekday must remain open.")
    return sorted(value)


class ClinicSettings(TimeStampedModel):
    class Currency(models.TextChoices):
        SYP = "SYP", "Syrian Pound"
        USD = "USD", "US Dollar"

    class Language(models.TextChoices):
        EN = "EN", "English"
        AR = "AR", "Arabic"

    class AiMode(models.TextChoices):
        DJANGO_INTERNAL = "DJANGO_INTERNAL", "Django internal"
        SEPARATE_SERVICE = "SEPARATE_SERVICE", "Separate service"
        MOCK_ADAPTER = "MOCK_ADAPTER", "Mock adapter"

    clinic_name = models.CharField(max_length=255, default="Pearl Dental Clinic")
    address = models.CharField(max_length=255, default="Damascus, Syria")
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    timezone = models.CharField(max_length=100, default="Asia/Damascus")
    capacity_per_slot = models.PositiveIntegerField(default=3)
    default_appointment_duration_minutes = models.PositiveIntegerField(default=30)
    allowed_durations_minutes = models.JSONField(default=list)
    weekly_closed_days = models.JSONField(default=default_weekly_closed_days, blank=True)
    default_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.SYP)
    supported_currencies = models.JSONField(default=list)
    default_language = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    ai_mode = models.CharField(max_length=30, choices=AiMode.choices, default=AiMode.MOCK_ADAPTER)
    ai_service_url = models.URLField(blank=True)

    class Meta:
        verbose_name_plural = "Clinic settings"

    def clean(self):
        allowed_duration_values = {15, 30, 45, 60}
        allowed_durations = self.allowed_durations_minutes or [15, 30, 45, 60]
        supported_currencies = self.supported_currencies or ["SYP", "USD"]
        errors = {}

        if self.capacity_per_slot < 1:
            errors["capacity_per_slot"] = "Capacity per slot must be at least 1."
        if set(allowed_durations) - allowed_duration_values:
            errors["allowed_durations_minutes"] = "Allowed durations must be limited to 15, 30, 45, and 60."
        if self.default_appointment_duration_minutes not in allowed_durations:
            errors["default_appointment_duration_minutes"] = "Default duration must be in allowed durations."
        if set(supported_currencies) - {"SYP", "USD"}:
            errors["supported_currencies"] = "Supported currencies must be SYP and/or USD."
        if self.default_currency not in supported_currencies:
            errors["default_currency"] = "Default currency must be in supported currencies."
        if self.default_language not in {"EN", "AR"}:
            errors["default_language"] = "Default language must be EN or AR."
        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError:
            errors["timezone"] = "Use a valid IANA timezone identifier."
        try:
            self.weekly_closed_days = normalize_weekly_closed_days(self.weekly_closed_days)
        except ValidationError as exc:
            errors["weekly_closed_days"] = exc.messages

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.allowed_durations_minutes:
            self.allowed_durations_minutes = [15, 30, 45, 60]
        if not self.supported_currencies:
            self.supported_currencies = ["SYP", "USD"]
        self.full_clean()
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def __str__(self) -> str:
        return self.clinic_name

    def is_weekday_closed(self, weekday: int) -> bool:
        return weekday in self.weekly_closed_days


def is_clinic_weekday_closed(weekday: int, clinic_settings=None) -> bool:
    clinic_settings = clinic_settings or ClinicSettings.get_solo()
    return clinic_settings.is_weekday_closed(weekday)
