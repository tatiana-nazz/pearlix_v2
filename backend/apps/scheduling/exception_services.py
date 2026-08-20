from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    NEEDS_RESCHEDULE_SOURCE_STATUSES,
    require_version,
    validate_appointment_slot,
)
from apps.scheduling.models import Appointment, AvailabilityException


def mark_overlapping_appointments_needs_reschedule(
    *,
    availability_exception,
    request=None,
    actor=None,
    current_time=None,
):
    if (
        availability_exception.type != AvailabilityException.Type.UNAVAILABLE
        or not availability_exception.doctor_id
        or availability_exception.is_cancelled
    ):
        return []
    appointments = Appointment.objects.select_for_update().filter(
        doctor=availability_exception.doctor,
        status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES,
        start_datetime__gte=current_time or timezone.now(),
        start_datetime__lt=availability_exception.end_datetime,
        end_datetime__gt=availability_exception.start_datetime,
    )
    marked = []
    for appointment in appointments:
        previous = appointment.reschedule_previous_status or appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_source_exception = availability_exception
        appointment.reschedule_source_working_shift = None
        appointment.reschedule_source_clinic_weekday = None
        appointment.reschedule_previous_status = previous
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
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
                "doctor_id": appointment.doctor_id,
            },
        )
    return marked


def save_availability_exception(*, serializer, user, request=None):
    with transaction.atomic():
        instance = serializer.save(created_by=user, updated_by=user)
        return instance, mark_overlapping_appointments_needs_reschedule(
            availability_exception=instance,
            request=request,
            actor=user,
        )


def update_availability_exception(*, instance, serializer, user, request=None):
    with transaction.atomic():
        locked = AvailabilityException.objects.select_for_update().get(pk=instance.pk)
        require_version(locked, serializer.validated_data.get("version"))
        for field, value in serializer.validated_data.items():
            setattr(locked, field, value)
        locked.version += 1
        locked.updated_by = user
        locked.save()
        return locked, mark_overlapping_appointments_needs_reschedule(
            availability_exception=locked,
            request=request,
            actor=user,
        )


def cancel_availability_exception(*, availability_exception, user, version, request=None):
    with transaction.atomic():
        instance = AvailabilityException.objects.select_for_update().get(pk=availability_exception.pk)
        require_version(instance, version)
        if instance.is_cancelled:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Availability exception is already cancelled.",
                status_code=status.HTTP_409_CONFLICT,
            )
        instance.is_cancelled = True
        instance.cancelled_at = timezone.now()
        instance.cancelled_by = user
        instance.updated_by = user
        instance.version += 1
        instance.save(
            update_fields=[
                "is_cancelled",
                "cancelled_at",
                "cancelled_by",
                "updated_by",
                "version",
                "updated_at",
            ]
        )
        restored = []
        still_blocked = []
        if instance.doctor_id:
            appointments = Appointment.objects.select_for_update().filter(
                reschedule_source_exception=instance,
                status=Appointment.Status.NEEDS_RESCHEDULE,
            )
            for appointment in appointments:
                try:
                    validate_appointment_slot(
                        appointment.doctor,
                        appointment.start_datetime,
                        appointment.duration_minutes,
                        exclude_id=appointment.id,
                        ignore_exception_id=instance.id,
                    )
                except AppointmentRuleError:
                    still_blocked.append(appointment)
                    continue
                appointment.status = appointment.reschedule_previous_status or Appointment.Status.UPCOMING
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
                        "availability_exception_id": instance.id,
                    },
                )
        return instance, restored, still_blocked
