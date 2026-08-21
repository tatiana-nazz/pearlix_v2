from copy import copy

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    NEEDS_RESCHEDULE_SOURCE_STATUSES,
)
from apps.scheduling.exception_services import (
    RescheduleProvenance,
    apply_reschedule_provenance,
    current_reschedule_provenance,
)
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.scheduling.time_utils import clinic_localtime


User = get_user_model()


def _lock_operating_week_dependencies(*, current_time):
    """Lock recurring scheduling dependencies before any appointment row locks."""
    doctor_ids = list(
        Appointment.objects.filter(
            status__in=[
                *NEEDS_RESCHEDULE_SOURCE_STATUSES,
                Appointment.Status.NEEDS_RESCHEDULE,
            ],
            start_datetime__gte=current_time,
        )
        .exclude(doctor_id=None)
        .values_list("doctor_id", flat=True)
        .distinct()
    )
    if not doctor_ids:
        return
    doctor_ids = sorted(doctor_ids)
    list(User.objects.select_for_update().filter(pk__in=doctor_ids).order_by("pk"))
    list(
        WorkingShift.objects.select_for_update()
        .filter(employee_id__in=doctor_ids)
        .order_by("employee_id", "id")
    )
    list(
        AvailabilityException.objects.select_for_update()
        .filter(doctor_id__in=doctor_ids)
        .order_by("doctor_id", "id")
    )


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


def _timezone_confirmation_error(*, impacted, old_timezone, proposed_timezone):
    return AppointmentRuleError(
        "CLINIC_TIMEZONE_CHANGE_REQUIRES_CONFIRMATION",
        "Changing the clinic timezone requires appointment rescheduling confirmation.",
        {
            "impacted_count": len(impacted),
            "appointments": [_safe_appointment_summary(item) for item in impacted],
            "old_timezone": old_timezone,
            "proposed_timezone": proposed_timezone,
        },
        status.HTTP_409_CONFLICT,
    )


def _future_timezone_rule_impacts(
    *,
    old_clinic_settings,
    proposed_clinic_settings,
    current_time,
):
    if old_clinic_settings.timezone == proposed_clinic_settings.timezone:
        return []
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
        old_provenance = current_reschedule_provenance(
            appointment,
            settings=old_clinic_settings,
            current_time=current_time,
        )
        proposed_provenance = current_reschedule_provenance(
            appointment,
            settings=proposed_clinic_settings,
            current_time=current_time,
        )
        if old_provenance is None and proposed_provenance is not None:
            impacted.append(appointment)
    return impacted


def _mark_current_rule_impacts(*, appointments, clinic_settings, actor, request, current_time):
    marked = []
    for appointment in appointments:
        provenance = current_reschedule_provenance(
            appointment,
            settings=clinic_settings,
            current_time=current_time,
        )
        if provenance is None or appointment.status not in NEEDS_RESCHEDULE_SOURCE_STATUSES:
            continue
        appointment.reschedule_previous_status = appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        apply_reschedule_provenance(appointment, provenance)
        appointment.version += 1
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_previous_status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
                "reschedule_source_kind",
                "version",
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
                "doctor_id": appointment.doctor_id,
                "reschedule_source_type": provenance.kind,
                "trigger": "CLINIC_TIMEZONE_CHANGE",
            },
            raise_on_error=True,
        )
    return marked


def _reconcile_timezone_schedule_sources(
    *,
    proposed_clinic_settings,
    actor,
    request,
    current_time,
):
    candidates = (
        Appointment.objects.select_for_update()
        .select_related("doctor")
        .filter(
            Q(
                reschedule_source_kind=(
                    Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
                )
            )
            | Q(
                reschedule_source_kind__isnull=True,
                reschedule_source_working_shift__isnull=False,
            ),
            status=Appointment.Status.NEEDS_RESCHEDULE,
            start_datetime__gte=current_time,
        )
        .order_by("start_datetime", "id")
    )
    restored = []
    still_blocked = []
    for appointment in candidates:
        previous_kind = appointment.reschedule_source_kind
        previous_signature = (
            appointment.reschedule_source_kind,
            appointment.reschedule_source_exception_id,
            appointment.reschedule_source_working_shift_id,
            appointment.reschedule_source_clinic_weekday,
        )
        provenance = current_reschedule_provenance(
            appointment,
            settings=proposed_clinic_settings,
            current_time=current_time,
        )
        previous_status = appointment.reschedule_previous_status
        if provenance is None and previous_status in NEEDS_RESCHEDULE_SOURCE_STATUSES:
            appointment.status = previous_status
            appointment.reschedule_previous_status = None
            apply_reschedule_provenance(appointment, None)
            appointment.version += 1
            appointment.updated_by = actor
            appointment.save(
                update_fields=[
                    "status",
                    "reschedule_previous_status",
                    "reschedule_source_exception",
                    "reschedule_source_working_shift",
                    "reschedule_source_clinic_weekday",
                    "reschedule_source_kind",
                    "version",
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
                    "reschedule_source_type": "WORKING_SCHEDULE_CHANGE",
                    "trigger": "CLINIC_TIMEZONE_CHANGE",
                },
                raise_on_error=True,
            )
            continue
        if provenance is None:
            provenance = RescheduleProvenance(
                Appointment.RescheduleSourceKind.SCHEDULING_RULE_CONFLICT,
            )
        apply_reschedule_provenance(appointment, provenance)
        current_signature = (
            appointment.reschedule_source_kind,
            appointment.reschedule_source_exception_id,
            appointment.reschedule_source_working_shift_id,
            appointment.reschedule_source_clinic_weekday,
        )
        if current_signature != previous_signature:
            appointment.version += 1
            appointment.updated_by = actor
            appointment.save(
                update_fields=[
                    "reschedule_source_exception",
                    "reschedule_source_working_shift",
                    "reschedule_source_clinic_weekday",
                    "reschedule_source_kind",
                    "version",
                    "updated_by",
                    "updated_at",
                ]
            )
            log_activity(
                request=request,
                actor=actor,
                action="appointment_reschedule_provenance_reconciled",
                entity_type="appointment",
                entity_id=appointment.id,
                metadata={
                    "appointment_id": appointment.id,
                    "previous_source_kind": previous_kind,
                    "current_source_kind": provenance.kind,
                    "trigger": "CLINIC_TIMEZONE_CHANGE",
                },
                raise_on_error=True,
            )
        still_blocked.append(appointment)
    return restored, still_blocked


def _mark_clinic_closure_impacts(*, appointments, clinic_settings, actor, request):
    for appointment in appointments:
        weekday = clinic_localtime(appointment.start_datetime, clinic_settings).weekday()
        appointment.reschedule_previous_status = appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_source_exception = None
        appointment.reschedule_source_working_shift = None
        appointment.reschedule_source_clinic_weekday = weekday
        appointment.reschedule_source_kind = Appointment.RescheduleSourceKind.CLINIC_WEEKLY_CLOSURE
        appointment.version += 1
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_previous_status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
                "reschedule_source_kind",
                "version",
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
        ):
            continue
        provenance = current_reschedule_provenance(
            appointment,
            settings=proposed_clinic_settings,
            current_time=current_time,
        )
        if provenance is not None:
            apply_reschedule_provenance(appointment, provenance)
            appointment.version += 1
            appointment.updated_by = actor
            appointment.save(
                update_fields=[
                    "reschedule_source_exception",
                    "reschedule_source_working_shift",
                    "reschedule_source_clinic_weekday",
                    "reschedule_source_kind",
                    "version",
                    "updated_by",
                    "updated_at",
                ]
            )
            log_activity(
                request=request,
                actor=actor,
                action="appointment_reschedule_provenance_reconciled",
                entity_type="appointment",
                entity_id=appointment.id,
                metadata={
                    "appointment_id": appointment.id,
                    "previous_source_kind": "CLINIC_WEEKLY_CLOSURE",
                    "current_source_kind": provenance.kind,
                },
                raise_on_error=True,
            )
            still_blocked.append(appointment)
            continue
        if previous_status not in NEEDS_RESCHEDULE_SOURCE_STATUSES:
            apply_reschedule_provenance(
                appointment,
                RescheduleProvenance(
                    Appointment.RescheduleSourceKind.SCHEDULING_RULE_CONFLICT,
                ),
            )
            appointment.version += 1
            appointment.updated_by = actor
            appointment.save(
                update_fields=[
                    "reschedule_source_exception",
                    "reschedule_source_working_shift",
                    "reschedule_source_clinic_weekday",
                    "reschedule_source_kind",
                    "version",
                    "updated_by",
                    "updated_at",
                ]
            )
            still_blocked.append(appointment)
            continue
        appointment.status = previous_status
        appointment.reschedule_previous_status = None
        appointment.reschedule_source_exception = None
        appointment.reschedule_source_working_shift = None
        appointment.reschedule_source_clinic_weekday = None
        appointment.reschedule_source_kind = None
        appointment.version += 1
        appointment.updated_by = actor
        appointment.save(
            update_fields=[
                "status",
                "reschedule_previous_status",
                "reschedule_source_exception",
                "reschedule_source_working_shift",
                "reschedule_source_clinic_weekday",
                "reschedule_source_kind",
                "version",
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
        timezone_changed = old_clinic_settings.timezone != locked.timezone
        if operating_week_changed:
            _lock_operating_week_dependencies(current_time=now)
        closure_impacted = _future_appointments_newly_closed(
            old_clinic_settings=old_clinic_settings,
            proposed_clinic_settings=locked,
            current_time=now,
        ) if operating_week_changed else []
        timezone_impacted = _future_timezone_rule_impacts(
            old_clinic_settings=old_clinic_settings,
            proposed_clinic_settings=locked,
            current_time=now,
        ) if timezone_changed else []
        impacted_by_id = {
            appointment.id: appointment
            for appointment in [*closure_impacted, *timezone_impacted]
        }
        impacted = list(impacted_by_id.values())
        if impacted and not confirmed:
            if closure_impacted:
                raise _confirmation_error(
                    impacted=impacted,
                    proposed_weekly_closed_days=proposed_weekly_closed_days,
                )
            raise _timezone_confirmation_error(
                impacted=impacted,
                old_timezone=old_clinic_settings.timezone,
                proposed_timezone=locked.timezone,
            )

        locked.save()
        _mark_clinic_closure_impacts(
            appointments=closure_impacted,
            clinic_settings=locked,
            actor=actor,
            request=request,
        )
        closure_impacted_ids = {appointment.id for appointment in closure_impacted}
        timezone_only_impacted = [
            appointment
            for appointment in timezone_impacted
            if appointment.id not in closure_impacted_ids
        ]
        _mark_current_rule_impacts(
            appointments=timezone_only_impacted,
            clinic_settings=locked,
            actor=actor,
            request=request,
            current_time=now,
        )
        restored, still_blocked = _restore_reopened_appointments(
            old_clinic_settings=old_clinic_settings,
            proposed_clinic_settings=locked,
            actor=actor,
            request=request,
            current_time=now,
        ) if operating_week_changed else ([], [])
        if timezone_changed:
            timezone_restored, timezone_blocked = _reconcile_timezone_schedule_sources(
                proposed_clinic_settings=locked,
                actor=actor,
                request=request,
                current_time=now,
            )
            restored_by_id = {
                appointment.id: appointment
                for appointment in [*restored, *timezone_restored]
            }
            blocked_by_id = {
                appointment.id: appointment
                for appointment in [*still_blocked, *timezone_blocked]
                if appointment.id not in restored_by_id
            }
            restored = list(restored_by_id.values())
            still_blocked = list(blocked_by_id.values())
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
