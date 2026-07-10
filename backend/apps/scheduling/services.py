from __future__ import annotations

from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour


ACTIVE_COUNTING_STATUSES = [
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
    Appointment.Status.ACTIVE,
]
LOCKED_EDIT_STATUSES = [
    Appointment.Status.ACTIVE,
    Appointment.Status.COMPLETED,
    Appointment.Status.CANCELLED,
    Appointment.Status.NO_SHOW,
]
NEEDS_RESCHEDULE_SOURCE_STATUSES = [
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
]
RESCHEDULE_FIELDS = {"doctor", "start_datetime", "duration_minutes"}


class AppointmentRuleError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def calculate_end_datetime(start_datetime, duration_minutes: int):
    return start_datetime + timedelta(minutes=duration_minutes)


def get_clinic_settings():
    return ClinicSettings.get_solo()


def validate_duration(duration_minutes: int):
    settings = get_clinic_settings()
    if duration_minutes not in settings.allowed_durations_minutes:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"duration_minutes": ["Duration is not allowed."]},
        )
    return settings


def validate_start_not_past(start_datetime):
    if start_datetime < timezone.now():
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"start_datetime": ["Start datetime cannot be in the past."]},
        )


def validate_working_hours(doctor, start_datetime, end_datetime):
    local_start = timezone.localtime(start_datetime)
    local_end = timezone.localtime(end_datetime)
    if local_start.date() != local_end.date():
        raise AppointmentRuleError("OUTSIDE_WORKING_HOURS", "Appointment must fit inside doctor working hours.")

    fits = WorkingHour.objects.filter(
        doctor=doctor,
        weekday=local_start.weekday(),
        is_active=True,
        start_time__lte=local_start.time(),
        end_time__gte=local_end.time(),
    ).exists()
    if not fits:
        raise AppointmentRuleError(
            "OUTSIDE_WORKING_HOURS",
            "Appointment must fit inside doctor working hours.",
            status_code=status.HTTP_409_CONFLICT,
        )


def validate_unavailable_exception(doctor, start_datetime, end_datetime, *, ignore_exception_id=None):
    blocked = AvailabilityException.objects.filter(
        doctor=doctor,
        type=AvailabilityException.Type.UNAVAILABLE,
        is_cancelled=False,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    )
    if ignore_exception_id:
        blocked = blocked.exclude(id=ignore_exception_id)
    blocked = blocked.exists()
    if blocked:
        raise AppointmentRuleError(
            "DOCTOR_UNAVAILABLE",
            "Doctor is unavailable for this time.",
            status_code=status.HTTP_409_CONFLICT,
        )


def _candidate_appointments(exclude_id=None):
    queryset = Appointment.objects.select_for_update().filter(status__in=ACTIVE_COUNTING_STATUSES)
    if exclude_id:
        queryset = queryset.exclude(id=exclude_id)
    return queryset


def validate_capacity(start_datetime, exclude_id=None):
    settings = get_clinic_settings()
    current_count = _candidate_appointments(exclude_id=exclude_id).filter(start_datetime=start_datetime).count()
    if current_count >= settings.capacity_per_slot:
        raise AppointmentRuleError(
            "CAPACITY_FULL",
            "Clinic capacity is full for this start time.",
            {"capacity": settings.capacity_per_slot, "current_count": current_count},
            status.HTTP_409_CONFLICT,
        )


def validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id=None):
    conflict = _candidate_appointments(exclude_id=exclude_id).filter(
        doctor=doctor,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    ).exists()
    if conflict:
        raise AppointmentRuleError(
            "DOCTOR_ALREADY_BOOKED",
            "Doctor already has an appointment in this time range.",
            status_code=status.HTTP_409_CONFLICT,
        )


def validate_appointment_slot(doctor, start_datetime, duration_minutes, exclude_id=None, ignore_exception_id=None):
    validate_duration(duration_minutes)
    validate_start_not_past(start_datetime)
    end_datetime = calculate_end_datetime(start_datetime, duration_minutes)
    validate_working_hours(doctor, start_datetime, end_datetime)
    validate_unavailable_exception(doctor, start_datetime, end_datetime, ignore_exception_id=ignore_exception_id)
    validate_capacity(start_datetime, exclude_id=exclude_id)
    validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id=exclude_id)
    return end_datetime


def create_appointment(*, serializer, user):
    with transaction.atomic():
        data = serializer.validated_data
        end_datetime = validate_appointment_slot(data["doctor"], data["start_datetime"], data["duration_minutes"])
        return serializer.save(end_datetime=end_datetime, created_by=user, updated_by=user)


def update_appointment(*, appointment, serializer, user):
    if appointment.status in LOCKED_EDIT_STATUSES:
        raise AppointmentRuleError("INVALID_STATUS_TRANSITION", "Locked appointments cannot be edited.", status_code=status.HTTP_409_CONFLICT)

    with transaction.atomic():
        data = serializer.validated_data
        doctor = data.get("doctor", appointment.doctor)
        start_datetime = data.get("start_datetime", appointment.start_datetime)
        duration_minutes = data.get("duration_minutes", appointment.duration_minutes)
        end_datetime = validate_appointment_slot(doctor, start_datetime, duration_minutes, exclude_id=appointment.id)
        if appointment.status == Appointment.Status.NEEDS_RESCHEDULE and RESCHEDULE_FIELDS.intersection(data):
            return serializer.save(
                end_datetime=end_datetime,
                status=Appointment.Status.UPCOMING,
                checked_in_at=None,
                reschedule_source_exception=None,
                reschedule_previous_status=None,
                updated_by=user,
            )
        return serializer.save(end_datetime=end_datetime, updated_by=user)


def mark_overlapping_appointments_needs_reschedule(*, availability_exception: AvailabilityException, request=None, actor=None) -> list[Appointment]:
    if availability_exception.type != AvailabilityException.Type.UNAVAILABLE or not availability_exception.doctor_id:
        return []
    if availability_exception.is_cancelled:
        return []

    now = timezone.now()
    overlapping = (
        Appointment.objects.select_for_update()
        .filter(
            doctor=availability_exception.doctor,
            status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES,
            start_datetime__gte=now,
            start_datetime__lt=availability_exception.end_datetime,
            end_datetime__gt=availability_exception.start_datetime,
        )
        .order_by("start_datetime", "id")
    )
    marked = []
    for appointment in overlapping:
        previous_status = appointment.reschedule_previous_status or appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_source_exception = availability_exception
        appointment.reschedule_previous_status = previous_status
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_source_exception",
                "reschedule_previous_status",
                "updated_by",
                "updated_at",
            ]
        )
        marked.append(appointment)
        log_activity(
            request=request,
            actor=actor,
            action="appointment_marked_needs_reschedule",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={
                "appointment_id": appointment.id,
                "availability_exception_id": availability_exception.id,
                "patient_id": appointment.patient_id,
                "doctor_id": appointment.doctor_id,
            },
        )
    return marked


def save_availability_exception(*, serializer, user, request=None):
    with transaction.atomic():
        availability_exception = serializer.save(created_by=user, updated_by=user)
        marked = mark_overlapping_appointments_needs_reschedule(
            availability_exception=availability_exception,
            request=request,
            actor=user,
        )
    return availability_exception, marked


def update_availability_exception(*, serializer, user, request=None):
    with transaction.atomic():
        availability_exception = serializer.save(updated_by=user)
        marked = mark_overlapping_appointments_needs_reschedule(
            availability_exception=availability_exception,
            request=request,
            actor=user,
        )
    return availability_exception, marked


def cancel_availability_exception(*, availability_exception: AvailabilityException, user, request=None):
    with transaction.atomic():
        availability_exception = AvailabilityException.objects.select_for_update().get(pk=availability_exception.pk)
        if availability_exception.is_cancelled:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Availability exception is already cancelled.",
                status_code=status.HTTP_409_CONFLICT,
            )

        availability_exception.is_cancelled = True
        availability_exception.cancelled_at = timezone.now()
        availability_exception.cancelled_by = user
        availability_exception.updated_by = user
        availability_exception.save(update_fields=["is_cancelled", "cancelled_at", "cancelled_by", "updated_by", "updated_at"])

        restored = []
        still_blocked = []
        if availability_exception.doctor_id:
            appointments = (
                Appointment.objects.select_for_update()
                .filter(
                    reschedule_source_exception=availability_exception,
                    status=Appointment.Status.NEEDS_RESCHEDULE,
                )
                .order_by("start_datetime", "id")
            )
            for appointment in appointments:
                try:
                    validate_appointment_slot(
                        appointment.doctor,
                        appointment.start_datetime,
                        appointment.duration_minutes,
                        exclude_id=appointment.id,
                        ignore_exception_id=availability_exception.id,
                    )
                except AppointmentRuleError:
                    still_blocked.append(appointment)
                    continue

                restored_status = appointment.reschedule_previous_status or Appointment.Status.UPCOMING
                appointment.status = restored_status
                appointment.reschedule_source_exception = None
                appointment.reschedule_previous_status = None
                appointment.updated_by = user
                appointment.save(
                    update_fields=[
                        "status",
                        "reschedule_source_exception",
                        "reschedule_previous_status",
                        "updated_by",
                        "updated_at",
                    ]
                )
                restored.append(appointment)
                log_activity(
                    request=request,
                    actor=user,
                    action="appointment_restored_from_reschedule",
                    entity_type="appointment",
                    entity_id=appointment.id,
                    metadata={
                        "appointment_id": appointment.id,
                        "availability_exception_id": availability_exception.id,
                        "restored_status": restored_status,
                    },
                )

        return availability_exception, restored, still_blocked


def appointment_count_at(start_datetime):
    return Appointment.objects.filter(status__in=ACTIVE_COUNTING_STATUSES, start_datetime=start_datetime).count()


def has_doctor_conflict(doctor, start_datetime, end_datetime):
    return Appointment.objects.filter(
        doctor=doctor,
        status__in=ACTIVE_COUNTING_STATUSES,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    ).exists()


def has_unavailable_exception(doctor, start_datetime, end_datetime):
    return AvailabilityException.objects.filter(
        doctor=doctor,
        type=AvailabilityException.Type.UNAVAILABLE,
        is_cancelled=False,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    ).exists()


def build_availability_slots(*, doctor, date_value, duration_minutes):
    settings = validate_duration(duration_minutes)
    tz = timezone.get_current_timezone()
    slots = []
    step = timedelta(minutes=15)
    duration = timedelta(minutes=duration_minutes)

    for block in WorkingHour.objects.filter(doctor=doctor, weekday=date_value.weekday(), is_active=True).order_by("start_time"):
        cursor = timezone.make_aware(datetime.combine(date_value, block.start_time), tz)
        block_end = timezone.make_aware(datetime.combine(date_value, block.end_time), tz)
        while cursor + duration <= block_end:
            end_datetime = cursor + duration
            current_count = appointment_count_at(cursor)
            if (
                current_count < settings.capacity_per_slot
                and not has_doctor_conflict(doctor, cursor, end_datetime)
                and not has_unavailable_exception(doctor, cursor, end_datetime)
            ):
                slots.append(
                    {
                        "start_datetime": cursor.isoformat(),
                        "end_datetime": end_datetime.isoformat(),
                        "current_count": current_count,
                        "capacity": settings.capacity_per_slot,
                    }
                )
            cursor += step
    return slots
