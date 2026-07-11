from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


class Weekday(models.IntegerChoices):
    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class ClinicDefaultShift(TimeStampedModel):
    name = models.CharField(max_length=100)
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="default_shifts_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="default_shifts_updated")

    class Meta:
        indexes = [models.Index(fields=["weekday", "is_active"])]
        ordering = ["weekday", "start_time", "id"]

    def clean(self):
        errors = {}
        self.name = self.name.strip()
        if not self.name:
            errors["name"] = "Shift name is required."
        if self.weekday not in Weekday.values:
            errors["weekday"] = "Weekday must be between 0 and 6."
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            errors["end_time"] = "End time must be after start time."
        if errors:
            raise ValidationError(errors)


class WorkingShift(TimeStampedModel):
    employee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="working_shifts")
    name = models.CharField(max_length=100)
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    source_default_shift = models.ForeignKey(ClinicDefaultShift, null=True, blank=True, on_delete=models.SET_NULL, related_name="applied_working_shifts")
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="working_shifts_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="working_shifts_updated")

    class Meta:
        indexes = [models.Index(fields=["employee", "weekday", "is_active"])]
        ordering = ["weekday", "start_time", "id"]

    def clean(self):
        errors = {}
        self.name = self.name.strip()
        if not self.name:
            errors["name"] = "Shift name is required."
        if self.employee_id and self.employee.role not in {"DOCTOR", "STAFF"}:
            errors["employee"] = "Working shifts must belong to a doctor or staff user."
        if self.weekday not in Weekday.values:
            errors["weekday"] = "Weekday must be between 0 and 6."
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            errors["end_time"] = "End time must be after start time."
        if errors:
            raise ValidationError(errors)


class AvailabilityException(TimeStampedModel):
    class Type(models.TextChoices):
        UNAVAILABLE = "UNAVAILABLE", "Unavailable"
        AVAILABLE_OVERRIDE = "AVAILABLE_OVERRIDE", "Available override"

    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="doctor_availability_exceptions")
    staff = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="staff_availability_exceptions")
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    type = models.CharField(max_length=30, choices=Type.choices, default=Type.UNAVAILABLE)
    reason = models.CharField(max_length=255, blank=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="availability_exceptions_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="availability_exceptions_updated")
    is_cancelled = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="availability_exceptions_cancelled")

    class Meta:
        indexes = [models.Index(fields=["doctor", "start_datetime"]), models.Index(fields=["staff", "start_datetime"]), models.Index(fields=["type"]), models.Index(fields=["is_cancelled"])]
        ordering = ["start_datetime", "id"]

    def clean(self):
        errors = {}
        if bool(self.doctor_id) == bool(self.staff_id):
            errors["target"] = "Exactly one of doctor or staff must be set."
        if self.doctor_id and self.doctor.role != "DOCTOR":
            errors["doctor"] = "Doctor target must have DOCTOR role."
        if self.staff_id and self.staff.role != "STAFF":
            errors["staff"] = "Staff target must have STAFF role."
        if self.start_datetime and self.end_datetime and self.start_datetime >= self.end_datetime:
            errors["end_datetime"] = "End datetime must be after start datetime."
        if errors:
            raise ValidationError(errors)


class Appointment(TimeStampedModel):
    class Status(models.TextChoices):
        UPCOMING = "UPCOMING", "Upcoming"
        CHECKED_IN = "CHECKED_IN", "Checked in"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No show"
        NEEDS_RESCHEDULE = "NEEDS_RESCHEDULE", "Needs reschedule"

    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="appointments")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="appointments")
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPCOMING)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    no_show_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="appointments_created")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="appointments_updated")
    reschedule_source_exception = models.ForeignKey("scheduling.AvailabilityException", null=True, blank=True, on_delete=models.SET_NULL, related_name="reschedule_appointments")
    reschedule_source_working_shift = models.ForeignKey("scheduling.WorkingShift", null=True, blank=True, on_delete=models.SET_NULL, related_name="reschedule_appointments")
    reschedule_previous_status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["doctor", "start_datetime"]), models.Index(fields=["start_datetime", "status"]), models.Index(fields=["patient", "start_datetime"]), models.Index(fields=["status"]), models.Index(fields=["reschedule_source_exception", "status"]), models.Index(fields=["reschedule_source_working_shift", "status"])]
        ordering = ["start_datetime", "id"]

    def clean(self):
        errors = {}
        if self.doctor_id and self.doctor.role != "DOCTOR":
            errors["doctor"] = "Appointment doctor must have DOCTOR role."
        if self.start_datetime and self.end_datetime and self.start_datetime >= self.end_datetime:
            errors["end_datetime"] = "End datetime must be after start datetime."
        if errors:
            raise ValidationError(errors)
