from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from typing import Mapping

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
    has_available_override,
    require_version,
)
from apps.scheduling.exception_services import (
    RescheduleProvenance,
    apply_reschedule_provenance,
    current_reschedule_provenance,
)
from apps.scheduling.models import Appointment, ClinicDefaultShift, WorkingShift
from apps.scheduling.time_utils import clinic_localtime


User = get_user_model()


@dataclass(frozen=True)
class ShiftSpec:
    name: str
    weekday: int
    start_time: time
    end_time: time
    is_active: bool = True
    source_default_shift: ClinicDefaultShift | None = None


def _lock_clinic_settings():
    settings = ClinicSettings.get_solo()
    return ClinicSettings.objects.select_for_update().get(pk=settings.pk)


def _lock_employees(*employee_ids):
    ids = sorted({employee_id for employee_id in employee_ids if employee_id})
    if ids:
        rows = list(User.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
        return {row.pk: row for row in rows}
    return {}


def _require_schedulable_employee(employee):
    if employee.role not in {User.Role.DOCTOR, User.Role.STAFF}:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"employee_id": ["Employee must have DOCTOR or STAFF role."]},
        )
    return employee


def _lock_working_shifts(employee):
    return list(
        WorkingShift.objects.select_for_update()
        .filter(employee=employee)
        .order_by("id")
    )


def _lock_default_shifts():
    return list(ClinicDefaultShift.objects.select_for_update().order_by("id"))


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
        ) and not has_available_override(
            employee,
            appointment.start_datetime,
            appointment.end_datetime,
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


def _save_reschedule_fields(appointment, actor):
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


def _provenance_signature(appointment):
    return (
        appointment.reschedule_source_kind,
        appointment.reschedule_source_exception_id,
        appointment.reschedule_source_working_shift_id,
        appointment.reschedule_source_clinic_weekday,
    )


def _mark_shift_impacts(
    impacted,
    source_shift,
    actor,
    *,
    settings,
    request=None,
    current_time=None,
):
    marked = []
    for appointment in impacted:
        provenance = current_reschedule_provenance(
            appointment,
            settings=settings,
            current_time=current_time,
        )
        if provenance is None:
            continue
        previous_status = appointment.reschedule_previous_status or appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE
        appointment.reschedule_previous_status = previous_status
        if (
            provenance.kind
            == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
            and source_shift is not None
        ):
            provenance = RescheduleProvenance(
                Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
                working_shift_id=source_shift.id,
            )
        apply_reschedule_provenance(appointment, provenance)
        _save_reschedule_fields(appointment, actor)
        marked.append(appointment)
        log_activity(
            request=request,
            actor=actor,
            action="appointment_marked_needs_reschedule",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={
                "appointment_id": appointment.id,
                "working_shift_id": getattr(source_shift, "id", None),
                "doctor_id": appointment.doctor_id,
                "reschedule_source_type": provenance.kind,
            },
        )
    return marked


def _reconcile_schedule_source_appointments(
    *,
    employee,
    settings,
    actor,
    request,
    current_time=None,
):
    if employee.role != "DOCTOR":
        return [], []
    appointments = (
        Appointment.objects.select_for_update()
        .select_related("doctor")
        .filter(doctor=employee, status=Appointment.Status.NEEDS_RESCHEDULE)
        .filter(
            Q(
                reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
            )
            | Q(
                reschedule_source_kind__isnull=True,
                reschedule_source_working_shift__isnull=False,
            )
        )
        .order_by("id")
    )
    restored = []
    still_blocked = []
    for appointment in appointments:
        previous_provenance = _provenance_signature(appointment)
        provenance = current_reschedule_provenance(
            appointment,
            settings=settings,
            current_time=current_time,
        )
        previous_status = appointment.reschedule_previous_status
        if provenance is None and previous_status in NEEDS_RESCHEDULE_SOURCE_STATUSES:
            appointment.status = previous_status
            appointment.reschedule_previous_status = None
            apply_reschedule_provenance(appointment, None)
            _save_reschedule_fields(appointment, actor)
            restored.append(appointment)
            log_activity(
                request=request,
                actor=actor,
                action="appointment_restored_from_reschedule",
                entity_type="appointment",
                entity_id=appointment.id,
                metadata={
                    "appointment_id": appointment.id,
                    "doctor_id": appointment.doctor_id,
                    "reschedule_source_type": "WORKING_SCHEDULE_CHANGE",
                },
            )
            continue
        if provenance is None:
            provenance = RescheduleProvenance(
                Appointment.RescheduleSourceKind.SCHEDULING_RULE_CONFLICT,
            )
        apply_reschedule_provenance(appointment, provenance)
        _save_reschedule_fields(appointment, actor)
        still_blocked.append(appointment)
        if _provenance_signature(appointment) != previous_provenance:
            log_activity(
                request=request,
                actor=actor,
                action="appointment_reschedule_provenance_reconciled",
                entity_type="appointment",
                entity_id=appointment.id,
                metadata={
                    "appointment_id": appointment.id,
                    "doctor_id": appointment.doctor_id,
                    "previous_source_kind": previous_provenance[0],
                    "current_source_kind": provenance.kind,
                },
            )
    return restored, still_blocked


def save_default_shift(*, serializer, user):
    with transaction.atomic():
        _lock_clinic_settings()
        _lock_default_shifts()
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
        _lock_clinic_settings()
        _lock_default_shifts()
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
        _lock_clinic_settings()
        _lock_default_shifts()
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
    with transaction.atomic():
        settings = _lock_clinic_settings()
        data = serializer.validated_data
        submitted_employee = data["employee"]
        employee = _require_schedulable_employee(
            _lock_employees(submitted_employee.id)[submitted_employee.id]
        )
        _lock_working_shifts(employee)
        validate_shift_overlap(
            model=WorkingShift,
            employee=employee,
            weekday=data["weekday"],
            start_time=data["start_time"],
            end_time=data["end_time"],
            is_active=True,
        )
        instance = serializer.save(employee=employee, created_by=user, updated_by=user)
        _reconcile_schedule_source_appointments(
            employee=employee,
            settings=settings,
            actor=user,
            request=None,
            current_time=timezone.now(),
        )
        return instance


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
        settings = _lock_clinic_settings()
        proposed_employee = data.get("employee", instance.employee)
        if proposed_employee.pk != instance.employee_id:
            raise AppointmentRuleError(
                "VALIDATION_ERROR",
                "Some fields are invalid.",
                {"employee_id": ["A working shift cannot be moved to another employee."]},
            )
        employee = _require_schedulable_employee(
            _lock_employees(instance.employee_id)[instance.employee_id]
        )
        _lock_working_shifts(employee)
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
        now = current_time or timezone.now()
        impacted = _impacted_appointments(locked.employee, rows, now)
        _require_impact_confirmation(locked.employee, impacted, rows, confirm_appointment_impact)
        for field, value in data.items():
            if field == "employee":
                value = employee
            setattr(locked, field, value)
        locked.version += 1
        locked.updated_by = user
        locked.full_clean()
        locked.save()
        _reconcile_schedule_source_appointments(
            employee=locked.employee,
            settings=settings,
            actor=user,
            request=request,
            current_time=now,
        )
        marked = []
        if impacted:
            marked = _mark_shift_impacts(
                impacted,
                locked,
                user,
                settings=settings,
                request=request,
                current_time=now,
            )
        return locked, len(marked)


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


def _validate_schedule_specs(incoming):
    ordered = sorted(incoming, key=lambda row: (row.weekday, row.start_time, row.end_time))
    previous_by_weekday = {}
    for row in ordered:
        previous = previous_by_weekday.get(row.weekday)
        if previous and row.start_time < previous.end_time:
            raise AppointmentRuleError(
                "SHIFT_OVERLAP",
                "Active shifts cannot overlap on the same weekday.",
                {"weekday": ["Shift overlaps another proposed active shift."]},
                status.HTTP_409_CONFLICT,
            )
        previous_by_weekday[row.weekday] = row


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


def _snapshot_default_shift_specs(rows):
    return [
        ShiftSpec(
            name=row.name,
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            is_active=row.is_active,
            source_default_shift=row,
        )
        for row in rows
        if row.is_active
    ]


def _snapshot_working_shift_specs(rows):
    return [
        ShiftSpec(
            name=row.name,
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            is_active=row.is_active,
        )
        for row in rows
        if row.is_active
    ]


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
        created_shift = WorkingShift.objects.create(
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
        active.append(created_shift)
        created += 1
    return {
        "created_count": created,
        "deactivated_count": 0,
        "skipped_count": skipped,
        "impacted_appointments_count": 0,
    }


def _replace_schedule(*, employee, incoming, active, user):
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
    return {
        "created_count": len(created_rows),
        "deactivated_count": deactivated,
        "skipped_count": 0,
    }, created_rows


def _validate_schedule_mode(mode):
    if mode not in {"MISSING_ONLY", "REPLACE_ALL"}:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"mode": ["Use MISSING_ONLY or REPLACE_ALL."]},
        )


def _apply_schedule_under_locks(
    *,
    employee,
    templates,
    mode,
    user,
    confirm_appointment_impact,
    settings,
    existing,
    request=None,
    source_default=False,
):
    active = [shift for shift in existing if shift.is_active]
    incoming = [
        spec
        for spec in (
            _shift_spec(template, source_default=source_default)
            for template in templates
        )
        if spec.is_active
    ]
    if mode == "MISSING_ONLY":
        result = _apply_missing_schedule(
            employee=employee,
            incoming=incoming,
            active=active,
            user=user,
        )
        _reconcile_schedule_source_appointments(
            employee=employee,
            settings=settings,
            actor=user,
            request=request,
            current_time=timezone.now(),
        )
        return result
    _validate_schedule_specs(incoming)
    proposed = _schedule_rows(incoming)
    now = timezone.now()
    impacted = _impacted_appointments(employee, proposed, now)
    _require_impact_confirmation(employee, impacted, proposed, confirm_appointment_impact)
    result, _created_rows = _replace_schedule(
        employee=employee,
        incoming=incoming,
        active=active,
        user=user,
    )
    _reconcile_schedule_source_appointments(
        employee=employee,
        settings=settings,
        actor=user,
        request=request,
        current_time=now,
    )
    marked = []
    if impacted:
        marked = _mark_shift_impacts(
            impacted,
            None,
            user,
            settings=settings,
            request=request,
            current_time=now,
        )
    return {
        **result,
        "impacted_appointments_count": len(marked),
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
    _validate_schedule_mode(mode)
    with transaction.atomic():
        settings = _lock_clinic_settings()
        locked_employees = _lock_employees(employee.id)
        employee = _require_schedulable_employee(locked_employees[employee.id])
        existing = _lock_working_shifts(employee)
        return _apply_schedule_under_locks(
            employee=employee,
            templates=templates,
            mode=mode,
            user=user,
            confirm_appointment_impact=confirm_appointment_impact,
            settings=settings,
            existing=existing,
            request=request,
            source_default=source_default,
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
    _validate_schedule_mode(mode)
    with transaction.atomic():
        settings = _lock_clinic_settings()
        locked_employees = _lock_employees(employee.id)
        employee = _require_schedulable_employee(locked_employees[employee.id])
        default_rows = _lock_default_shifts()
        existing = _lock_working_shifts(employee)
        templates = _snapshot_default_shift_specs(default_rows)
        return _apply_schedule_under_locks(
            employee=employee,
            templates=templates,
            mode=mode,
            user=user,
            confirm_appointment_impact=confirm_appointment_impact,
            settings=settings,
            existing=existing,
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
    _validate_schedule_mode(mode)
    with transaction.atomic():
        settings = _lock_clinic_settings()
        locked_employees = _lock_employees(source.id, target.id)
        source = _require_schedulable_employee(locked_employees[source.id])
        target = _require_schedulable_employee(locked_employees[target.id])
        shifts_by_employee = {
            employee_id: _lock_working_shifts(locked_employees[employee_id])
            for employee_id in sorted(locked_employees)
        }
        templates = _snapshot_working_shift_specs(shifts_by_employee[source.id])
        return _apply_schedule_under_locks(
            employee=target,
            templates=templates,
            mode=mode,
            user=user,
            confirm_appointment_impact=confirm_appointment_impact,
            settings=settings,
            existing=shifts_by_employee[target.id],
            request=request,
        )
