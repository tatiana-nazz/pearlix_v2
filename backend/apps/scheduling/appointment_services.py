from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.patients.models import Patient
from apps.scheduling.capacity import assess_candidate_capacity
from apps.scheduling.models import Appointment, AvailabilityException, Weekday, WorkingShift
from apps.scheduling.time_utils import (
    calculate_end_datetime,
    clinic_localtime,
    clinic_now,
    get_clinic_settings,
)


ACTIVE_COUNTING_STATUSES = [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN, Appointment.Status.ACTIVE]
LOCKED_EDIT_STATUSES = [
    Appointment.Status.ACTIVE,
    Appointment.Status.COMPLETED,
    Appointment.Status.CANCELLED,
    Appointment.Status.NO_SHOW,
]
NEEDS_RESCHEDULE_SOURCE_STATUSES = [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN]
RESCHEDULE_FIELDS = {"doctor", "start_datetime", "duration_minutes"}


User = get_user_model()


class AppointmentRuleError(Exception):
    def __init__(self, code, message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
        self.code, self.message, self.details, self.status_code = code, message, details or {}, status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def require_version(instance, submitted_version):
    if submitted_version is None:
        raise AppointmentRuleError(
            "VERSION_REQUIRED",
            "A version is required.",
            {"version": ["This field is required."]},
        )
    if submitted_version != instance.version:
        raise AppointmentRuleError(
            "VERSION_CONFLICT",
            "This record changed elsewhere.",
            {"submitted_version": submitted_version, "current_version": instance.version},
            status.HTTP_409_CONFLICT,
        )


def validate_locked_doctor(doctor):
    if doctor.role != User.Role.DOCTOR or not doctor.is_active:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"doctor_id": ["Doctor must be active."]},
        )
    return doctor


def validate_locked_patient(patient):
    if patient.is_archived:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"patient_id": ["Patient must not be archived."]},
        )
    return patient


def validate_duration(duration_minutes, settings=None):
    settings = settings or get_clinic_settings()
    if duration_minutes not in settings.allowed_durations_minutes:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"duration_minutes": ["Duration is not allowed."]},
        )
    return settings


def validate_start_not_past(start_datetime, settings=None, current_time=None):
    if clinic_localtime(start_datetime, settings) < clinic_now(settings, current_time):
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"start_datetime": ["Start datetime cannot be in the past."]},
        )


def has_available_override(doctor, start_datetime, end_datetime):
    return AvailabilityException.objects.filter(
        doctor=doctor,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        is_cancelled=False,
        start_datetime__lte=start_datetime,
        end_datetime__gte=end_datetime,
    ).exists()


def validate_working_hours(doctor, start_datetime, end_datetime, settings=None):
    start = clinic_localtime(start_datetime, settings)
    end = clinic_localtime(end_datetime, settings)
    fits_shift = start.date() == end.date() and WorkingShift.objects.filter(
        employee=doctor,
        weekday=start.weekday(),
        is_active=True,
        start_time__lte=start.time(),
        end_time__gte=end.time(),
    ).exists()
    if not fits_shift and not has_available_override(doctor, start_datetime, end_datetime):
        raise AppointmentRuleError(
            "OUTSIDE_WORKING_HOURS",
            "Appointment must fit inside doctor working hours.",
            status_code=status.HTTP_409_CONFLICT,
        )


def validate_clinic_open(start_datetime, settings=None):
    settings = settings or get_clinic_settings()
    weekday = clinic_localtime(start_datetime, settings).weekday()
    if settings.is_weekday_closed(weekday):
        raise AppointmentRuleError(
            "CLINIC_CLOSED_DAY",
            "The clinic is closed on this weekday.",
            {
                "weekday": weekday,
                "weekday_label": Weekday(weekday).label,
                "weekly_closed_days": settings.weekly_closed_days,
            },
            status.HTTP_409_CONFLICT,
        )


def validate_unavailable_exception(
    doctor,
    start_datetime,
    end_datetime,
    *,
    ignore_exception_id=None,
):
    blocked = AvailabilityException.objects.filter(
        doctor=doctor,
        type=AvailabilityException.Type.UNAVAILABLE,
        is_cancelled=False,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    )
    if ignore_exception_id:
        blocked = blocked.exclude(id=ignore_exception_id)
    if blocked.exists():
        raise AppointmentRuleError(
            "DOCTOR_UNAVAILABLE",
            "Doctor is unavailable for this time.",
            status_code=status.HTTP_409_CONFLICT,
        )


def _candidate_appointments(exclude_id=None):
    queryset = Appointment.objects.select_for_update().filter(status__in=ACTIVE_COUNTING_STATUSES)
    return queryset.exclude(id=exclude_id) if exclude_id else queryset


def validate_capacity(start_datetime, end_datetime, exclude_id=None, settings=None):
    settings = settings or get_clinic_settings()
    intervals = _candidate_appointments(exclude_id).filter(
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    ).values_list("start_datetime", "end_datetime")
    assessment = assess_candidate_capacity(
        intervals,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        capacity=settings.capacity_per_slot,
    )
    if not assessment.available:
        raise AppointmentRuleError(
            "CAPACITY_FULL",
            "Clinic capacity is full for this time range.",
            {
                "capacity": settings.capacity_per_slot,
                "current_count": assessment.existing_peak,
                "projected_count": assessment.projected_peak,
            },
            status.HTTP_409_CONFLICT,
        )


def validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id=None):
    if _candidate_appointments(exclude_id).filter(
        doctor=doctor,
        start_datetime__lt=end_datetime,
        end_datetime__gt=start_datetime,
    ).exists():
        raise AppointmentRuleError(
            "DOCTOR_ALREADY_BOOKED",
            "Doctor already has an appointment in this time range.",
            status_code=status.HTTP_409_CONFLICT,
        )


def validate_appointment_slot(
    doctor,
    start_datetime,
    duration_minutes,
    exclude_id=None,
    ignore_exception_id=None,
    settings=None,
    current_time=None,
):
    settings = validate_duration(duration_minutes, settings)
    validate_start_not_past(start_datetime, settings, current_time)
    end_datetime = calculate_end_datetime(start_datetime, duration_minutes)
    validate_clinic_open(start_datetime, settings)
    validate_working_hours(doctor, start_datetime, end_datetime, settings)
    validate_unavailable_exception(
        doctor,
        start_datetime,
        end_datetime,
        ignore_exception_id=ignore_exception_id,
    )
    validate_capacity(start_datetime, end_datetime, exclude_id, settings)
    validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id)
    return end_datetime


def create_appointment(*, serializer, user):
    with transaction.atomic():
        settings = ClinicSettings.get_solo()
        settings = ClinicSettings.objects.select_for_update().get(pk=settings.pk)
        data = serializer.validated_data
        patient = validate_locked_patient(
            Patient.objects.select_for_update().get(pk=data["patient"].pk)
        )
        doctor = validate_locked_doctor(
            User.objects.select_for_update().get(pk=data["doctor"].pk)
        )
        end = validate_appointment_slot(
            doctor,
            data["start_datetime"],
            data["duration_minutes"],
            settings=settings,
        )
        return serializer.save(
            patient=patient,
            doctor=doctor,
            end_datetime=end,
            created_by=user,
            updated_by=user,
        )


def update_appointment(*, appointment, serializer, user, current_time=None):
    with transaction.atomic():
        settings = ClinicSettings.get_solo()
        settings = ClinicSettings.objects.select_for_update().get(pk=settings.pk)
        data = dict(serializer.validated_data)
        submitted_version = data.pop("version", None)
        current_patient_id, current_doctor_id = Appointment.objects.values_list(
            "patient_id",
            "doctor_id",
        ).get(pk=appointment.pk)
        requested_patient = data.get("patient")
        patient_ids = sorted(
            {
                current_patient_id,
                requested_patient.pk if requested_patient else current_patient_id,
            }
        )
        locked_patients = {
            patient.pk: patient
            for patient in Patient.objects.select_for_update()
            .filter(pk__in=patient_ids)
            .order_by("pk")
        }
        requested_doctor = data.get("doctor")
        doctor_ids = sorted({current_doctor_id, requested_doctor.pk if requested_doctor else current_doctor_id})
        locked_doctors = {
            doctor.pk: doctor
            for doctor in User.objects.select_for_update().filter(pk__in=doctor_ids).order_by("pk")
        }
        locked = Appointment.objects.select_for_update().get(pk=appointment.pk)
        require_version(locked, submitted_version)
        if locked.status in LOCKED_EDIT_STATUSES:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Locked appointments cannot be edited.",
                status_code=status.HTTP_409_CONFLICT,
            )
        selected_patient_id = data["patient"].pk if "patient" in data else locked.patient_id
        selected_doctor_id = data["doctor"].pk if "doctor" in data else locked.doctor_id
        patient = validate_locked_patient(locked_patients[selected_patient_id])
        doctor = validate_locked_doctor(locked_doctors[selected_doctor_id])
        if "patient" in data:
            data["patient"] = patient
        if "doctor" in data:
            data["doctor"] = doctor
        start = data.get("start_datetime", locked.start_datetime)
        duration = data.get("duration_minutes", locked.duration_minutes)
        end = validate_appointment_slot(
            doctor,
            start,
            duration,
            exclude_id=locked.id,
            settings=settings,
            current_time=current_time,
        )
        for field, value in data.items():
            setattr(locked, field, value)
        locked.end_datetime = end
        locked.updated_by = user
        if locked.status == Appointment.Status.NEEDS_RESCHEDULE and RESCHEDULE_FIELDS.intersection(data):
            locked.status = Appointment.Status.UPCOMING
            locked.checked_in_at = None
            locked.reschedule_source_exception = None
            locked.reschedule_source_working_shift = None
            locked.reschedule_source_clinic_weekday = None
            locked.reschedule_source_kind = None
            locked.reschedule_previous_status = None
        locked.version += 1
        locked.save()
        return locked


def transition_appointment(
    *,
    appointment,
    allowed_statuses,
    target_status,
    timestamp_field,
    audit_action,
    user,
    request=None,
):
    with transaction.atomic():
        locked = Appointment.objects.select_for_update().get(pk=appointment.pk)
        if locked.status not in allowed_statuses:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Invalid appointment status transition.",
                status_code=status.HTTP_409_CONFLICT,
            )
        locked.status = target_status
        setattr(locked, timestamp_field, timezone.now())
        locked.updated_by = user
        locked.version += 1
        locked.save(update_fields=["status", timestamp_field, "updated_by", "version", "updated_at"])
        log_activity(
            request=request,
            action=audit_action,
            entity_type="appointment",
            entity_id=locked.id,
            metadata={"appointment_id": locked.id},
        )
        return locked


def check_in_appointment(*, appointment, user, request=None):
    return transition_appointment(
        appointment=appointment,
        allowed_statuses=[Appointment.Status.UPCOMING],
        target_status=Appointment.Status.CHECKED_IN,
        timestamp_field="checked_in_at",
        audit_action="appointment_checked_in",
        user=user,
        request=request,
    )


def cancel_appointment(*, appointment, user, request=None):
    return transition_appointment(
        appointment=appointment,
        allowed_statuses=[Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN],
        target_status=Appointment.Status.CANCELLED,
        timestamp_field="cancelled_at",
        audit_action="appointment_cancelled",
        user=user,
        request=request,
    )


def mark_appointment_no_show(*, appointment, user, request=None):
    return transition_appointment(
        appointment=appointment,
        allowed_statuses=[Appointment.Status.UPCOMING],
        target_status=Appointment.Status.NO_SHOW,
        timestamp_field="no_show_at",
        audit_action="appointment_marked_no_show",
        user=user,
        request=request,
    )
