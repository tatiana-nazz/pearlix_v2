from __future__ import annotations

from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift


ACTIVE_COUNTING_STATUSES = [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN, Appointment.Status.ACTIVE]
LOCKED_EDIT_STATUSES = [Appointment.Status.ACTIVE, Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW]
NEEDS_RESCHEDULE_SOURCE_STATUSES = [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN]
RESCHEDULE_FIELDS = {"doctor", "start_datetime", "duration_minutes"}


class AppointmentRuleError(Exception):
    def __init__(self, code, message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
        self.code, self.message, self.details, self.status_code = code, message, details or {}, status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def calculate_end_datetime(start_datetime, duration_minutes): return start_datetime + timedelta(minutes=duration_minutes)
def get_clinic_settings(): return ClinicSettings.get_solo()


def require_version(instance, submitted_version):
    if submitted_version is None:
        raise AppointmentRuleError("VERSION_REQUIRED", "A version is required.", {"version": ["This field is required."]})
    if submitted_version != instance.version:
        raise AppointmentRuleError("VERSION_CONFLICT", "This record changed elsewhere.", {"submitted_version": submitted_version, "current_version": instance.version}, status.HTTP_409_CONFLICT)


def validate_duration(duration_minutes):
    settings = get_clinic_settings()
    if duration_minutes not in settings.allowed_durations_minutes:
        raise AppointmentRuleError("VALIDATION_ERROR", "Some fields are invalid.", {"duration_minutes": ["Duration is not allowed."]})
    return settings


def validate_start_not_past(start_datetime):
    if start_datetime < timezone.now():
        raise AppointmentRuleError("VALIDATION_ERROR", "Some fields are invalid.", {"start_datetime": ["Start datetime cannot be in the past."]})


def validate_working_hours(doctor, start_datetime, end_datetime):
    start, end = timezone.localtime(start_datetime), timezone.localtime(end_datetime)
    if start.date() != end.date() or not WorkingShift.objects.filter(employee=doctor, weekday=start.weekday(), is_active=True, start_time__lte=start.time(), end_time__gte=end.time()).exists():
        raise AppointmentRuleError("OUTSIDE_WORKING_HOURS", "Appointment must fit inside doctor working hours.", status_code=status.HTTP_409_CONFLICT)


def validate_unavailable_exception(doctor, start_datetime, end_datetime, *, ignore_exception_id=None):
    blocked = AvailabilityException.objects.filter(doctor=doctor, type=AvailabilityException.Type.UNAVAILABLE, is_cancelled=False, start_datetime__lt=end_datetime, end_datetime__gt=start_datetime)
    if ignore_exception_id: blocked = blocked.exclude(id=ignore_exception_id)
    if blocked.exists(): raise AppointmentRuleError("DOCTOR_UNAVAILABLE", "Doctor is unavailable for this time.", status_code=status.HTTP_409_CONFLICT)


def _candidate_appointments(exclude_id=None):
    queryset = Appointment.objects.select_for_update().filter(status__in=ACTIVE_COUNTING_STATUSES)
    return queryset.exclude(id=exclude_id) if exclude_id else queryset


def validate_capacity(start_datetime, exclude_id=None):
    settings = get_clinic_settings(); count = _candidate_appointments(exclude_id).filter(start_datetime=start_datetime).count()
    if count >= settings.capacity_per_slot: raise AppointmentRuleError("CAPACITY_FULL", "Clinic capacity is full for this start time.", {"capacity": settings.capacity_per_slot, "current_count": count}, status.HTTP_409_CONFLICT)


def validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id=None):
    if _candidate_appointments(exclude_id).filter(doctor=doctor, start_datetime__lt=end_datetime, end_datetime__gt=start_datetime).exists():
        raise AppointmentRuleError("DOCTOR_ALREADY_BOOKED", "Doctor already has an appointment in this time range.", status_code=status.HTTP_409_CONFLICT)


def validate_appointment_slot(doctor, start_datetime, duration_minutes, exclude_id=None, ignore_exception_id=None):
    validate_duration(duration_minutes); validate_start_not_past(start_datetime); end_datetime = calculate_end_datetime(start_datetime, duration_minutes)
    validate_working_hours(doctor, start_datetime, end_datetime); validate_unavailable_exception(doctor, start_datetime, end_datetime, ignore_exception_id=ignore_exception_id)
    validate_capacity(start_datetime, exclude_id); validate_doctor_conflict(doctor, start_datetime, end_datetime, exclude_id)
    return end_datetime


def create_appointment(*, serializer, user):
    with transaction.atomic():
        data = serializer.validated_data; end = validate_appointment_slot(data["doctor"], data["start_datetime"], data["duration_minutes"])
        return serializer.save(end_datetime=end, created_by=user, updated_by=user)


def update_appointment(*, appointment, serializer, user):
    if appointment.status in LOCKED_EDIT_STATUSES: raise AppointmentRuleError("INVALID_STATUS_TRANSITION", "Locked appointments cannot be edited.", status_code=status.HTTP_409_CONFLICT)
    with transaction.atomic():
        data = serializer.validated_data; doctor = data.get("doctor", appointment.doctor); start = data.get("start_datetime", appointment.start_datetime); duration = data.get("duration_minutes", appointment.duration_minutes)
        end = validate_appointment_slot(doctor, start, duration, exclude_id=appointment.id)
        if appointment.status == Appointment.Status.NEEDS_RESCHEDULE and RESCHEDULE_FIELDS.intersection(data):
            return serializer.save(end_datetime=end, status=Appointment.Status.UPCOMING, checked_in_at=None, reschedule_source_exception=None, reschedule_source_working_shift=None, reschedule_previous_status=None, updated_by=user)
        return serializer.save(end_datetime=end, updated_by=user)


def _overlap(queryset, weekday, start_time, end_time, exclude_id=None):
    query = queryset.filter(weekday=weekday, is_active=True, start_time__lt=end_time, end_time__gt=start_time)
    return query.exclude(id=exclude_id) if exclude_id else query


def validate_shift_overlap(*, model, weekday, start_time, end_time, is_active, employee=None, exclude_id=None):
    if start_time >= end_time: raise AppointmentRuleError("INVALID_SHIFT_TIME", "Shift end time must be after start time.", {"end_time": ["End time must be after start time."]})
    if not is_active: return
    queryset = model.objects.all() if model is ClinicDefaultShift else model.objects.filter(employee=employee)
    if _overlap(queryset, weekday, start_time, end_time, exclude_id).exists():
        raise AppointmentRuleError("SHIFT_OVERLAP", "Active shifts cannot overlap on the same weekday.", {"weekday": ["Shift overlaps an active shift."]}, status.HTTP_409_CONFLICT)


def _safe_appointment_summary(appointment):
    return {"id": appointment.id, "patient_name": appointment.patient.full_name, "start_datetime": appointment.start_datetime.isoformat(), "end_datetime": appointment.end_datetime.isoformat(), "status": appointment.status}


def _impacted_appointments(employee, proposed_shifts):
    if employee.role != "DOCTOR": return []
    now = timezone.now(); impacted = []
    for appointment in Appointment.objects.select_for_update().select_related("patient").filter(doctor=employee, status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES, start_datetime__gte=now).order_by("start_datetime", "id"):
        start, end = timezone.localtime(appointment.start_datetime), timezone.localtime(appointment.end_datetime)
        if not any(row["is_active"] and row["weekday"] == start.weekday() and row["start_time"] <= start.time() and row["end_time"] >= end.time() for row in proposed_shifts):
            impacted.append(appointment)
    return impacted


def _impact_error(employee, impacted, context):
    return AppointmentRuleError("SHIFT_CHANGE_REQUIRES_CONFIRMATION", "This shift change would require appointment rescheduling confirmation.", {"impacted_count": len(impacted), "appointments": [_safe_appointment_summary(item) for item in impacted], "employee": {"id": employee.id, "full_name": employee.full_name, "role": employee.role}, "proposed_schedule": context}, status.HTTP_409_CONFLICT)


def _mark_shift_impacts(impacted, source_shift, actor, request=None):
    for appointment in impacted:
        previous_status = appointment.reschedule_previous_status or appointment.status
        appointment.status = Appointment.Status.NEEDS_RESCHEDULE; appointment.reschedule_previous_status = previous_status
        appointment.reschedule_source_exception = None; appointment.reschedule_source_working_shift = source_shift; appointment.updated_by = actor
        appointment.save(update_fields=["status", "reschedule_previous_status", "reschedule_source_exception", "reschedule_source_working_shift", "updated_by", "updated_at"])
        log_activity(request=request, actor=actor, action="appointment_marked_needs_reschedule", entity_type="appointment", entity_id=appointment.id, metadata={"appointment_id": appointment.id, "working_shift_id": source_shift.id, "doctor_id": appointment.doctor_id})


def save_default_shift(*, serializer, user):
    data = serializer.validated_data
    validate_shift_overlap(model=ClinicDefaultShift, weekday=data["weekday"], start_time=data["start_time"], end_time=data["end_time"], is_active=True)
    return serializer.save(created_by=user, updated_by=user)


def update_default_shift(*, instance, serializer, user):
    with transaction.atomic():
        locked = ClinicDefaultShift.objects.select_for_update().get(pk=instance.pk); require_version(locked, serializer.validated_data.get("version"))
        data = serializer.validated_data; active = data.get("is_active", locked.is_active)
        validate_shift_overlap(model=ClinicDefaultShift, weekday=data.get("weekday", locked.weekday), start_time=data.get("start_time", locked.start_time), end_time=data.get("end_time", locked.end_time), is_active=active, exclude_id=locked.id)
        for field, value in data.items(): setattr(locked, field, value)
        locked.version += 1; locked.updated_by = user; locked.save()
        return locked


def set_default_shift_active(*, instance, version, is_active, user):
    with transaction.atomic():
        locked = ClinicDefaultShift.objects.select_for_update().get(pk=instance.pk); require_version(locked, version)
        validate_shift_overlap(model=ClinicDefaultShift, weekday=locked.weekday, start_time=locked.start_time, end_time=locked.end_time, is_active=is_active, exclude_id=locked.id)
        locked.is_active = is_active; locked.version += 1; locked.updated_by = user; locked.save(update_fields=["is_active", "version", "updated_by", "updated_at"]); return locked


def create_working_shift(*, serializer, user):
    data = serializer.validated_data; employee = data["employee"]
    validate_shift_overlap(model=WorkingShift, employee=employee, weekday=data["weekday"], start_time=data["start_time"], end_time=data["end_time"], is_active=True)
    return serializer.save(created_by=user, updated_by=user)


def update_working_shift(*, instance, serializer, user, confirm_appointment_impact=False, request=None):
    with transaction.atomic():
        locked = WorkingShift.objects.select_for_update().select_related("employee").get(pk=instance.pk); require_version(locked, serializer.validated_data.get("version"))
        data = serializer.validated_data; candidate = {"weekday": data.get("weekday", locked.weekday), "start_time": data.get("start_time", locked.start_time), "end_time": data.get("end_time", locked.end_time), "is_active": data.get("is_active", locked.is_active)}
        validate_shift_overlap(model=WorkingShift, employee=locked.employee, exclude_id=locked.id, **candidate)
        rows = list(WorkingShift.objects.filter(employee=locked.employee, is_active=True).exclude(id=locked.id).values("weekday", "start_time", "end_time", "is_active")) + [candidate]
        impacted = _impacted_appointments(locked.employee, rows)
        if impacted and not confirm_appointment_impact: raise _impact_error(locked.employee, impacted, rows)
        for field, value in data.items(): setattr(locked, field, value)
        locked.version += 1; locked.updated_by = user; locked.save()
        if impacted: _mark_shift_impacts(impacted, locked, user, request)
        return locked, len(impacted)


def set_working_shift_active(*, instance, version, is_active, user, confirm_appointment_impact=False, request=None):
    class ActionSerializer: validated_data = {"version": version, "is_active": is_active}
    return update_working_shift(instance=instance, serializer=ActionSerializer(), user=user, confirm_appointment_impact=confirm_appointment_impact, request=request)


def _schedule_rows(shifts): return [{"name": row.name, "weekday": row.weekday, "start_time": row.start_time, "end_time": row.end_time, "is_active": row.is_active} for row in shifts]


def _apply_schedule(*, employee, templates, mode, user, confirm_appointment_impact, request=None, source_default=False):
    if mode not in {"MISSING_ONLY", "REPLACE_ALL"}: raise AppointmentRuleError("VALIDATION_ERROR", "Some fields are invalid.", {"mode": ["Use MISSING_ONLY or REPLACE_ALL."]})
    with transaction.atomic():
        existing = list(WorkingShift.objects.select_for_update().filter(employee=employee).order_by("id")); active = [shift for shift in existing if shift.is_active]
        incoming = [row for row in templates if row.is_active]
        if mode == "MISSING_ONLY":
            created = skipped = 0
            for template in incoming:
                exact = any(s.weekday == template.weekday and s.start_time == template.start_time and s.end_time == template.end_time for s in active)
                overlaps = any(s.weekday == template.weekday and s.start_time < template.end_time and s.end_time > template.start_time for s in active)
                if exact or overlaps: skipped += 1; continue
                WorkingShift.objects.create(employee=employee, name=template.name, weekday=template.weekday, start_time=template.start_time, end_time=template.end_time, is_active=True, source_default_shift=template.source_default_shift if source_default else None, created_by=user, updated_by=user); created += 1
            return {"created_count": created, "deactivated_count": 0, "skipped_count": skipped, "impacted_appointments_count": 0}
        proposed = _schedule_rows(incoming)
        impacted = _impacted_appointments(employee, proposed)
        if impacted and not confirm_appointment_impact: raise _impact_error(employee, impacted, proposed)
        deactivated = 0
        for shift in active:
            shift.is_active = False; shift.version += 1; shift.updated_by = user; shift.save(update_fields=["is_active", "version", "updated_by", "updated_at"]); deactivated += 1
        created_rows = [WorkingShift.objects.create(employee=employee, name=t.name, weekday=t.weekday, start_time=t.start_time, end_time=t.end_time, is_active=True, source_default_shift=t.source_default_shift if source_default else None, created_by=user, updated_by=user) for t in incoming]
        if impacted: _mark_shift_impacts(impacted, created_rows[0] if created_rows else active[0], user, request)
        return {"created_count": len(created_rows), "deactivated_count": deactivated, "skipped_count": 0, "impacted_appointments_count": len(impacted)}


def apply_default_schedule(*, employee, mode, user, confirm_appointment_impact=False, request=None):
    templates = [type("DefaultRow", (), {"name": row.name, "weekday": row.weekday, "start_time": row.start_time, "end_time": row.end_time, "is_active": row.is_active, "source_default_shift": row}) for row in ClinicDefaultShift.objects.filter(is_active=True)]
    return _apply_schedule(employee=employee, templates=templates, mode=mode, user=user, confirm_appointment_impact=confirm_appointment_impact, request=request, source_default=True)


def copy_employee_schedule(*, source, target, mode, user, confirm_appointment_impact=False, request=None):
    if source.id == target.id: raise AppointmentRuleError("VALIDATION_ERROR", "Some fields are invalid.", {"source_employee_id": ["Source and target must differ."]})
    return _apply_schedule(employee=target, templates=list(WorkingShift.objects.filter(employee=source, is_active=True)), mode=mode, user=user, confirm_appointment_impact=confirm_appointment_impact, request=request)


def mark_overlapping_appointments_needs_reschedule(*, availability_exception, request=None, actor=None):
    if availability_exception.type != AvailabilityException.Type.UNAVAILABLE or not availability_exception.doctor_id or availability_exception.is_cancelled: return []
    appointments = Appointment.objects.select_for_update().filter(doctor=availability_exception.doctor, status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES, start_datetime__gte=timezone.now(), start_datetime__lt=availability_exception.end_datetime, end_datetime__gt=availability_exception.start_datetime)
    marked = []
    for appointment in appointments:
        previous = appointment.reschedule_previous_status or appointment.status; appointment.status = Appointment.Status.NEEDS_RESCHEDULE; appointment.reschedule_source_exception = availability_exception; appointment.reschedule_source_working_shift = None; appointment.reschedule_previous_status = previous; appointment.updated_by = actor
        appointment.save(update_fields=["status", "reschedule_source_exception", "reschedule_source_working_shift", "reschedule_previous_status", "updated_by", "updated_at"]); marked.append(appointment)
        log_activity(request=request, actor=actor, action="appointment_marked_needs_reschedule", entity_type="appointment", entity_id=appointment.id, metadata={"appointment_id": appointment.id, "availability_exception_id": availability_exception.id, "doctor_id": appointment.doctor_id})
    return marked


def save_availability_exception(*, serializer, user, request=None):
    with transaction.atomic():
        instance = serializer.save(created_by=user, updated_by=user); return instance, mark_overlapping_appointments_needs_reschedule(availability_exception=instance, request=request, actor=user)


def update_availability_exception(*, instance, serializer, user, request=None):
    with transaction.atomic():
        locked = AvailabilityException.objects.select_for_update().get(pk=instance.pk); require_version(locked, serializer.validated_data.get("version"))
        for field, value in serializer.validated_data.items(): setattr(locked, field, value)
        locked.version += 1; locked.updated_by = user; locked.save(); return locked, mark_overlapping_appointments_needs_reschedule(availability_exception=locked, request=request, actor=user)


def cancel_availability_exception(*, availability_exception, user, version, request=None):
    with transaction.atomic():
        instance = AvailabilityException.objects.select_for_update().get(pk=availability_exception.pk); require_version(instance, version)
        if instance.is_cancelled: raise AppointmentRuleError("INVALID_STATUS_TRANSITION", "Availability exception is already cancelled.", status_code=status.HTTP_409_CONFLICT)
        instance.is_cancelled = True; instance.cancelled_at = timezone.now(); instance.cancelled_by = user; instance.updated_by = user; instance.version += 1; instance.save(update_fields=["is_cancelled", "cancelled_at", "cancelled_by", "updated_by", "version", "updated_at"])
        restored = []; still_blocked = []
        if instance.doctor_id:
            for appointment in Appointment.objects.select_for_update().filter(reschedule_source_exception=instance, status=Appointment.Status.NEEDS_RESCHEDULE):
                try: validate_appointment_slot(appointment.doctor, appointment.start_datetime, appointment.duration_minutes, exclude_id=appointment.id, ignore_exception_id=instance.id)
                except AppointmentRuleError: still_blocked.append(appointment); continue
                appointment.status = appointment.reschedule_previous_status or Appointment.Status.UPCOMING; appointment.reschedule_source_exception = None; appointment.reschedule_previous_status = None; appointment.updated_by = user; appointment.save(update_fields=["status", "reschedule_source_exception", "reschedule_previous_status", "updated_by", "updated_at"]); restored.append(appointment)
                log_activity(request=request, actor=user, action="appointment_restored_from_reschedule", entity_type="appointment", entity_id=appointment.id, metadata={"appointment_id": appointment.id, "availability_exception_id": instance.id})
        return instance, restored, still_blocked


def appointment_count_at(start_datetime): return Appointment.objects.filter(status__in=ACTIVE_COUNTING_STATUSES, start_datetime=start_datetime).count()
def has_doctor_conflict(doctor, start_datetime, end_datetime): return Appointment.objects.filter(doctor=doctor, status__in=ACTIVE_COUNTING_STATUSES, start_datetime__lt=end_datetime, end_datetime__gt=start_datetime).exists()
def has_unavailable_exception(doctor, start_datetime, end_datetime): return AvailabilityException.objects.filter(doctor=doctor, type=AvailabilityException.Type.UNAVAILABLE, is_cancelled=False, start_datetime__lt=end_datetime, end_datetime__gt=start_datetime).exists()


def build_availability_slots(*, doctor, date_value, duration_minutes):
    settings = validate_duration(duration_minutes); tz = timezone.get_current_timezone(); slots = []; step = timedelta(minutes=15); duration = timedelta(minutes=duration_minutes)
    for block in WorkingShift.objects.filter(employee=doctor, weekday=date_value.weekday(), is_active=True).order_by("start_time"):
        cursor = timezone.make_aware(datetime.combine(date_value, block.start_time), tz); block_end = timezone.make_aware(datetime.combine(date_value, block.end_time), tz)
        while cursor + duration <= block_end:
            end = cursor + duration; count = appointment_count_at(cursor)
            if count < settings.capacity_per_slot and not has_doctor_conflict(doctor, cursor, end) and not has_unavailable_exception(doctor, cursor, end): slots.append({"start_datetime": cursor.isoformat(), "end_datetime": end.isoformat(), "current_count": count, "capacity": settings.capacity_per_slot})
            cursor += step
    return slots
