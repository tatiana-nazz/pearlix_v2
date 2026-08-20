from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from typing import Mapping

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    NEEDS_RESCHEDULE_SOURCE_STATUSES,
    require_version,
)
from apps.scheduling.models import Appointment, ClinicDefaultShift, WorkingShift
from apps.scheduling.time_utils import clinic_localtime


@dataclass(frozen=True)
class ShiftSpec:
    name: str
    weekday: int
    start_time: time
    end_time: time
    is_active: bool = True
    source_default_shift: ClinicDefaultShift | None = None


def _overlap(queryset, weekday, start_time, end_time, exclude_id=None):
    query = queryset.filter(
        weekday=weekday,
        is_active=True,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    return query.exclude(id=exclude_id) if exclude_id else query


def validate_shift_overlap(
    *,
    model,
    weekday,
    start_time,
    end_time,
    is_active,
    employee=None,
    exclude_id=None,
):
    if start_time >= end_time:
        raise AppointmentRuleError(
            "INVALID_SHIFT_TIME",
            "Shift end time must be after start time.",
            {"end_time": ["End time must be after start time."]},
        )
    if not is_active:
        return
    queryset = model.objects.all() if model is ClinicDefaultShift else model.objects.filter(employee=employee)
    if _overlap(queryset, weekday, start_time, end_time, exclude_id).exists():
        raise AppointmentRuleError(
            "SHIFT_OVERLAP",
            "Active shifts cannot overlap on the same weekday.",
            {"weekday": ["Shift overlaps an active shift."]},
            status.HTTP_409_CONFLICT,
        )


def _safe_appointment_summary(appointment):
    return {
        "id": appointment.id,
        "patient_name": appointment.patient.full_name,
        "start_datetime": appointment.start_datetime.isoformat(),
        "end_datetime": appointment.end_datetime.isoformat(),
        "status": appointment.status,
    }


def _impacted_appointments(employee, proposed_shifts, current_time=None):
    if employee.role != "DOCTOR":
        return []
    now = current_time or timezone.now()
    impacted = []
    appointments = (
        Appointment.objects.select_for_update()
        .select_related("patient")
        .filter(
            doctor=employee,
            status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES,
            start_datetime__gte=now,
        )
        .order_by("start_datetime", "id")
    )
    for appointment in appointments:
        start = clinic_localtime(appointment.start_datetime)
        end = clinic_localtime(appointment.end_datetime)
        if not any(
            row["is_active"]
            and row["weekday"] == start.weekday()
            and row["start_time"] <= start.time()
            and row["end_time"] >= end.time()
            for row in proposed_shifts
        ):
            impacted.append(appointment)
    return impacted


def _impact_error(employee, impacted, context):
    return AppointmentRuleError(
        "SHIFT_CHANGE_REQUIRES_CONFIRMATION",
        "This shift change would require appointment rescheduling confirmation.",
        {
            "impacted_count": len(impacted),
            "appointments": [_safe_appointment_summary(item) for item in impacted],
            "employee": {"id": employee.id, "full_name": employee.full_name, "role": employee.role},
            "proposed_schedule": context,
        },
        status.HTTP_409_CONFLICT,
    )


def _require_impact_confirmation(employee, impacted, proposed_schedule, confirmed):
    if impacted and not confirmed:
        raise _impact_error(employee, impacted, proposed_schedule)


def _mark_shift_impacts(impacted, source_shift, actor, request=None):
    for appointment in impacted:
        previous_status = appointment.reschedule_previous_status or appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_previous_status = previous_status
        appointment.reschedule_source_exception = None
        appointment.reschedule_source_working_shift = source_shift
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
        log_activity(
            request=request,
            actor=actor,
            action="appointment_marked_needs_reschedule",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={
                "appointment_id": appointment.id,
                "working_shift_id": source_shift.id,
                "doctor_id": appointment.doctor_id,
            },
        )


def save_default_shift(*, serializer, user):
    data = serializer.validated_data
    validate_shift_overlap(
        model=ClinicDefaultShift,
        weekday=data["weekday"],
        start_time=data["start_time"],
        end_time=data["end_time"],
        is_active=True,
    )
    return serializer.save(created_by=user, updated_by=user)


def update_default_shift(*, instance, serializer, user):
    with transaction.atomic():
        locked = ClinicDefaultShift.objects.select_for_update().get(pk=instance.pk)
        require_version(locked, serializer.validated_data.get("version"))
        data = serializer.validated_data
        active = data.get("is_active", locked.is_active)
        validate_shift_overlap(
            model=ClinicDefaultShift,
            weekday=data.get("weekday", locked.weekday),
            start_time=data.get("start_time", locked.start_time),
            end_time=data.get("end_time", locked.end_time),
            is_active=active,
            exclude_id=locked.id,
        )
        for field, value in data.items():
            setattr(locked, field, value)
        locked.version += 1
        locked.updated_by = user
        locked.save()
        return locked


def set_default_shift_active(*, instance, version, is_active, user):
    with transaction.atomic():
        locked = ClinicDefaultShift.objects.select_for_update().get(pk=instance.pk)
        require_version(locked, version)
        validate_shift_overlap(
            model=ClinicDefaultShift,
            weekday=locked.weekday,
            start_time=locked.start_time,
            end_time=locked.end_time,
            is_active=is_active,
            exclude_id=locked.id,
        )
        locked.is_active = is_active
        locked.version += 1
        locked.updated_by = user
        locked.save(update_fields=["is_active", "version", "updated_by", "updated_at"])
        return locked


def create_working_shift(*, serializer, user):
    data = serializer.validated_data
    employee = data["employee"]
    validate_shift_overlap(
        model=WorkingShift,
        employee=employee,
        weekday=data["weekday"],
        start_time=data["start_time"],
        end_time=data["end_time"],
        is_active=True,
    )
    return serializer.save(created_by=user, updated_by=user)


def _update_working_shift(
    *,
    instance,
    data,
    user,
    confirm_appointment_impact=False,
    request=None,
    current_time=None,
):
    with transaction.atomic():
        locked = WorkingShift.objects.select_for_update().select_related("employee").get(pk=instance.pk)
        require_version(locked, data.get("version"))
        candidate = {
            "weekday": data.get("weekday", locked.weekday),
            "start_time": data.get("start_time", locked.start_time),
            "end_time": data.get("end_time", locked.end_time),
            "is_active": data.get("is_active", locked.is_active),
        }
        validate_shift_overlap(
            model=WorkingShift,
            employee=locked.employee,
            exclude_id=locked.id,
            **candidate,
        )
        rows = list(
            WorkingShift.objects.filter(employee=locked.employee, is_active=True)
            .exclude(id=locked.id)
            .values("weekday", "start_time", "end_time", "is_active")
        ) + [candidate]
        impacted = _impacted_appointments(locked.employee, rows, current_time)
        _require_impact_confirmation(locked.employee, impacted, rows, confirm_appointment_impact)
        for field, value in data.items():
            setattr(locked, field, value)
        locked.version += 1
        locked.updated_by = user
        locked.save()
        if impacted:
            _mark_shift_impacts(impacted, locked, user, request)
        return locked, len(impacted)


def update_working_shift(
    *,
    instance,
    serializer,
    user,
    confirm_appointment_impact=False,
    request=None,
    current_time=None,
):
    return _update_working_shift(
        instance=instance,
        data=serializer.validated_data,
        user=user,
        confirm_appointment_impact=confirm_appointment_impact,
        request=request,
        current_time=current_time,
    )


def set_working_shift_active(
    *,
    instance,
    version,
    is_active,
    user,
    confirm_appointment_impact=False,
    request=None,
):
    return _update_working_shift(
        instance=instance,
        data={"version": version, "is_active": is_active},
        user=user,
        confirm_appointment_impact=confirm_appointment_impact,
        request=request,
    )


def _schedule_rows(shifts):
    return [
        {
            "name": row.name,
            "weekday": row.weekday,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "is_active": row.is_active,
        }
        for row in shifts
    ]


def _shift_spec(template, *, source_default=False):
    if isinstance(template, ShiftSpec):
        return template
    if isinstance(template, Mapping):
        value = template.get
    else:
        value = lambda name, default=None: getattr(template, name, default)
    return ShiftSpec(
        name=value("name"),
        weekday=value("weekday"),
        start_time=value("start_time"),
        end_time=value("end_time"),
        is_active=value("is_active", True),
        source_default_shift=(value("source_default_shift") or template) if source_default else None,
    )


def _apply_missing_schedule(*, employee, incoming, active, user):
    created = 0
    skipped = 0
    for template in incoming:
        exact = any(
            shift.weekday == template.weekday
            and shift.start_time == template.start_time
            and shift.end_time == template.end_time
            for shift in active
        )
        overlaps = any(
            shift.weekday == template.weekday
            and shift.start_time < template.end_time
            and shift.end_time > template.start_time
            for shift in active
        )
        if exact or overlaps:
            skipped += 1
            continue
        WorkingShift.objects.create(
            employee=employee,
            name=template.name,
            weekday=template.weekday,
            start_time=template.start_time,
            end_time=template.end_time,
            is_active=True,
            source_default_shift=template.source_default_shift,
            created_by=user,
            updated_by=user,
        )
        created += 1
    return {
        "created_count": created,
        "deactivated_count": 0,
        "skipped_count": skipped,
        "impacted_appointments_count": 0,
    }


def _replace_schedule(*, employee, incoming, active, impacted, user, request):
    deactivated = 0
    for shift in active:
        shift.is_active = False
        shift.version += 1
        shift.updated_by = user
        shift.save(update_fields=["is_active", "version", "updated_by", "updated_at"])
        deactivated += 1
    created_rows = [
        WorkingShift.objects.create(
            employee=employee,
            name=template.name,
            weekday=template.weekday,
            start_time=template.start_time,
            end_time=template.end_time,
            is_active=True,
            source_default_shift=template.source_default_shift,
            created_by=user,
            updated_by=user,
        )
        for template in incoming
    ]
    if impacted:
        _mark_shift_impacts(impacted, created_rows[0] if created_rows else active[0], user, request)
    return {
        "created_count": len(created_rows),
        "deactivated_count": deactivated,
        "skipped_count": 0,
        "impacted_appointments_count": len(impacted),
    }


def _apply_schedule(
    *,
    employee,
    templates,
    mode,
    user,
    confirm_appointment_impact,
    request=None,
    source_default=False,
):
    if mode not in {"MISSING_ONLY", "REPLACE_ALL"}:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"mode": ["Use MISSING_ONLY or REPLACE_ALL."]},
        )
    with transaction.atomic():
        existing = list(WorkingShift.objects.select_for_update().filter(employee=employee).order_by("id"))
        active = [shift for shift in existing if shift.is_active]
        incoming = [
            spec
            for spec in (_shift_spec(template, source_default=source_default) for template in templates)
            if spec.is_active
        ]
        if mode == "MISSING_ONLY":
            return _apply_missing_schedule(employee=employee, incoming=incoming, active=active, user=user)
        proposed = _schedule_rows(incoming)
        impacted = _impacted_appointments(employee, proposed)
        _require_impact_confirmation(employee, impacted, proposed, confirm_appointment_impact)
        return _replace_schedule(
            employee=employee,
            incoming=incoming,
            active=active,
            impacted=impacted,
            user=user,
            request=request,
        )


def replace_employee_schedule(
    *,
    employee,
    schedule_rows,
    user,
    confirm_appointment_impact=False,
    request=None,
):
    return _apply_schedule(
        employee=employee,
        templates=schedule_rows,
        mode="REPLACE_ALL",
        user=user,
        confirm_appointment_impact=confirm_appointment_impact,
        request=request,
    )


def apply_default_schedule(
    *,
    employee,
    mode,
    user,
    confirm_appointment_impact=False,
    request=None,
):
    templates = [
        ShiftSpec(
            name=row.name,
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            is_active=row.is_active,
            source_default_shift=row,
        )
        for row in ClinicDefaultShift.objects.filter(is_active=True)
    ]
    return _apply_schedule(
        employee=employee,
        templates=templates,
        mode=mode,
        user=user,
        confirm_appointment_impact=confirm_appointment_impact,
        request=request,
    )


def copy_employee_schedule(
    *,
    source,
    target,
    mode,
    user,
    confirm_appointment_impact=False,
    request=None,
):
    if source.id == target.id:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"source_employee_id": ["Source and target must differ."]},
        )
    templates = [
        ShiftSpec(
            name=row.name,
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            is_active=row.is_active,
        )
        for row in WorkingShift.objects.filter(employee=source, is_active=True)
    ]
    return _apply_schedule(
        employee=target,
        templates=templates,
        mode=mode,
        user=user,
        confirm_appointment_impact=confirm_appointment_impact,
        request=request,
    )
