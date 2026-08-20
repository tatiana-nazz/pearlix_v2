from copy import copy

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    NEEDS_RESCHEDULE_SOURCE_STATUSES,
    validate_appointment_slot,
)
from apps.scheduling.models import Appointment
from apps.scheduling.time_utils import clinic_localtime


def _safe_appointment_summary(appointment):
    return {
        "id": appointment.id,
        "patient_name": appointment.patient.full_name,
        "start_datetime": appointment.start_datetime.isoformat(),
        "end_datetime": appointment.end_datetime.isoformat(),
        "status": appointment.status,
    }


def _future_appointments_newly_closed(
    *,
    old_clinic_settings,
    proposed_clinic_settings,
    current_time,
):
    candidates = (
        Appointment.objects.select_for_update()
        .select_related("patient", "doctor")
        .filter(
            status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES,
            start_datetime__gte=current_time,
        )
        .order_by("start_datetime", "id")
    )
    impacted = []
    for appointment in candidates:
        old_weekday = clinic_localtime(
            appointment.start_datetime,
            old_clinic_settings,
        ).weekday()
        proposed_weekday = clinic_localtime(
            appointment.start_datetime,
            proposed_clinic_settings,
        ).weekday()
        if (
            not old_clinic_settings.is_weekday_closed(old_weekday)
            and proposed_clinic_settings.is_weekday_closed(proposed_weekday)
        ):
            impacted.append(appointment)
    return impacted


def _confirmation_error(*, impacted, proposed_weekly_closed_days):
    return AppointmentRuleError(
        "CLINIC_CLOSURE_REQUIRES_CONFIRMATION",
        "Closing this clinic weekday requires appointment rescheduling confirmation.",
        {
            "impacted_count": len(impacted),
            "appointments": [_safe_appointment_summary(item) for item in impacted],
            "proposed_weekly_closed_days": proposed_weekly_closed_days,
        },
        status.HTTP_409_CONFLICT,
    )


def _mark_clinic_closure_impacts(*, appointments, clinic_settings, actor, request):
    for appointment in appointments:
        weekday = clinic_localtime(appointment.start_datetime, clinic_settings).weekday()
        appointment.reschedule_previous_status = appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_source_exception = None
        appointment.reschedule_source_working_shift = None
        appointment.reschedule_source_clinic_weekday = weekday
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_previous_status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
                "updated_by",
                "updated_at",
            ]
        )
        log_activity(
            request=request,
            actor=actor,
            action="appointment_marked_needs_reschedule",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={
                "appointment_id": appointment.id,
                "doctor_id": appointment.doctor_id,
                "clinic_weekday": weekday,
                "reschedule_source_type": "CLINIC_WEEKLY_CLOSURE",
            },
            raise_on_error=True,
        )


def _restore_reopened_appointments(
    *,
    old_clinic_settings,
    proposed_clinic_settings,
    actor,
    request,
    current_time,
):
    candidates = (
        Appointment.objects.select_for_update()
        .select_related("doctor")
        .filter(
            status=Appointment.Status.NEEDS_RESCHEDULE,
            reschedule_source_clinic_weekday__isnull=False,
        )
        .order_by("start_datetime", "id")
    )
    restored = []
    still_blocked = []
    for appointment in candidates:
        source_weekday = appointment.reschedule_source_clinic_weekday
        old_weekday = clinic_localtime(
            appointment.start_datetime,
            old_clinic_settings,
        ).weekday()
        proposed_weekday = clinic_localtime(
            appointment.start_datetime,
            proposed_clinic_settings,
        ).weekday()
        previous_status = appointment.reschedule_previous_status
        if (
            not old_clinic_settings.is_weekday_closed(old_weekday)
            or proposed_clinic_settings.is_weekday_closed(proposed_weekday)
            or previous_status not in NEEDS_RESCHEDULE_SOURCE_STATUSES
        ):
            continue
        try:
            validate_appointment_slot(
                appointment.doctor,
                appointment.start_datetime,
                appointment.duration_minutes,
                exclude_id=appointment.id,
                settings=proposed_clinic_settings,
                current_time=current_time,
            )
        except AppointmentRuleError:
            still_blocked.append(appointment)
            continue
        appointment.status = previous_status
        appointment.reschedule_previous_status = None
        appointment.reschedule_source_exception = None
        appointment.reschedule_source_working_shift = None
        appointment.reschedule_source_clinic_weekday = None
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_previous_status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
                "updated_by",
                "updated_at",
            ]
        )
        restored.append(appointment)
        log_activity(
            request=request,
            actor=actor,
            action="appointment_restored_from_reschedule",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={
                "appointment_id": appointment.id,
                "clinic_weekday": source_weekday,
                "reschedule_source_type": "CLINIC_WEEKLY_CLOSURE",
            },
            raise_on_error=True,
        )
    return restored, still_blocked


def update_clinic_settings(
    *,
    settings,
    validated_data,
    actor,
    request=None,
    current_time=None,
):
    data = dict(validated_data)
    confirmed = data.pop("confirm_appointment_impact", False)
    now = current_time or timezone.now()

    with transaction.atomic():
        locked = ClinicSettings.objects.select_for_update().get(pk=settings.pk)
        old_clinic_settings = copy(locked)
        old_weekly_closed_days = list(locked.weekly_closed_days)
        old_clinic_settings.weekly_closed_days = old_weekly_closed_days
        for field, value in data.items():
            setattr(locked, field, value)
        locked.full_clean()
        proposed_weekly_closed_days = list(locked.weekly_closed_days)

        operating_week_changed = (
            old_weekly_closed_days != proposed_weekly_closed_days
            or old_clinic_settings.timezone != locked.timezone
        )
        impacted = _future_appointments_newly_closed(
            old_clinic_settings=old_clinic_settings,
            proposed_clinic_settings=locked,
            current_time=now,
        ) if operating_week_changed else []
        if impacted and not confirmed:
            raise _confirmation_error(
                impacted=impacted,
                proposed_weekly_closed_days=proposed_weekly_closed_days,
            )

        locked.save()
        _mark_clinic_closure_impacts(
            appointments=impacted,
            clinic_settings=locked,
            actor=actor,
            request=request,
        )
        restored, still_blocked = _restore_reopened_appointments(
            old_clinic_settings=old_clinic_settings,
            proposed_clinic_settings=locked,
            actor=actor,
            request=request,
            current_time=now,
        ) if operating_week_changed else ([], [])
        log_activity(
            request=request,
            actor=actor,
            action="clinic_settings_updated",
            entity_type="clinic_settings",
            entity_id=locked.id,
            metadata={
                "updated_fields": sorted(data),
                "old_weekly_closed_days": old_weekly_closed_days,
                "new_weekly_closed_days": proposed_weekly_closed_days,
                "old_timezone": old_clinic_settings.timezone,
                "new_timezone": locked.timezone,
                "affected_appointment_count": len(impacted),
                "restored_appointment_count": len(restored),
                "still_blocked_appointment_count": len(still_blocked),
            },
            raise_on_error=True,
        )

    return locked, {
        "affected_appointments_count": len(impacted),
        "restored_appointments_count": len(restored),
        "still_blocked_appointments_count": len(still_blocked),
    }
