from __future__ import annotations

from dataclasses import dataclass

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
    require_version,
    validate_appointment_slot,
)
from apps.scheduling.models import Appointment, AvailabilityException
from apps.scheduling.time_utils import clinic_localtime


User = get_user_model()


@dataclass(frozen=True)
class RescheduleProvenance:
    kind: str
    availability_exception: AvailabilityException | None = None
    working_shift_id: int | None = None
    clinic_weekday: int | None = None


@dataclass(frozen=True)
class ExceptionState:
    doctor_id: int | None
    exception_type: str
    start_datetime: object
    end_datetime: object
    is_cancelled: bool

    @classmethod
    def from_instance(cls, instance):
        return cls(
            doctor_id=instance.doctor_id,
            exception_type=instance.type,
            start_datetime=instance.start_datetime,
            end_datetime=instance.end_datetime,
            is_cancelled=instance.is_cancelled,
        )

    @property
    def is_active_doctor_override(self):
        return (
            self.doctor_id is not None
            and self.exception_type == AvailabilityException.Type.AVAILABLE_OVERRIDE
            and not self.is_cancelled
        )


def _lock_clinic_settings():
    settings = ClinicSettings.get_solo()
    return ClinicSettings.objects.select_for_update().get(pk=settings.pk)


def _lock_users(*user_ids):
    ids = sorted({user_id for user_id in user_ids if user_id})
    if ids:
        rows = list(User.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
        return {row.pk: row for row in rows}
    return {}


def _validate_exception_targets(doctor, staff):
    if bool(doctor) == bool(staff):
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"target": ["Exactly one of doctor_id or staff_id must be set."]},
        )
    if doctor and doctor.role != User.Role.DOCTOR:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"doctor_id": ["Doctor target must have DOCTOR role."]},
        )
    if staff and staff.role != User.Role.STAFF:
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"staff_id": ["Staff target must have STAFF role."]},
        )
    return doctor, staff


def _exception_target_ids(instance, data=None):
    data = data or {}
    doctor = data.get("doctor", instance.doctor)
    staff = data.get("staff", instance.staff)
    return {
        instance.doctor_id,
        instance.staff_id,
        getattr(doctor, "pk", None),
        getattr(staff, "pk", None),
    }


def current_reschedule_provenance(
    appointment,
    *,
    settings,
    current_time=None,
):
    """Return the first truthful current blocker in the scheduling hierarchy."""
    try:
        validate_appointment_slot(
            appointment.doctor,
            appointment.start_datetime,
            appointment.duration_minutes,
            exclude_id=appointment.id,
            settings=settings,
            current_time=current_time,
        )
    except AppointmentRuleError as exc:
        if exc.code == "CLINIC_CLOSED_DAY":
            return RescheduleProvenance(
                Appointment.RescheduleSourceKind.CLINIC_WEEKLY_CLOSURE,
                clinic_weekday=clinic_localtime(
                    appointment.start_datetime,
                    settings,
                ).weekday(),
            )
        if exc.code == "OUTSIDE_WORKING_HOURS":
            return RescheduleProvenance(
                Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
            )
        if exc.code == "DOCTOR_UNAVAILABLE":
            blocking_exception = (
                AvailabilityException.objects.filter(
                    doctor=appointment.doctor,
                    type=AvailabilityException.Type.UNAVAILABLE,
                    is_cancelled=False,
                    start_datetime__lt=appointment.end_datetime,
                    end_datetime__gt=appointment.start_datetime,
                )
                .order_by("start_datetime", "id")
                .first()
            )
            if blocking_exception:
                return RescheduleProvenance(
                    Appointment.RescheduleSourceKind.LEAVE,
                    availability_exception=blocking_exception,
                )
        return RescheduleProvenance(
            Appointment.RescheduleSourceKind.SCHEDULING_RULE_CONFLICT,
        )
    return None


def apply_reschedule_provenance(appointment, provenance):
    appointment.reschedule_source_exception = None
    appointment.reschedule_source_working_shift = None
    appointment.reschedule_source_clinic_weekday = None
    appointment.reschedule_source_kind = provenance.kind if provenance else None
    if provenance:
        appointment.reschedule_source_exception = provenance.availability_exception
        appointment.reschedule_source_working_shift_id = provenance.working_shift_id
        appointment.reschedule_source_clinic_weekday = provenance.clinic_weekday


def _provenance_signature(appointment):
    return (
        appointment.reschedule_source_kind,
        appointment.reschedule_source_exception_id,
        appointment.reschedule_source_working_shift_id,
        appointment.reschedule_source_clinic_weekday,
    )


def _save_reschedule_fields(appointment, actor):
    appointment.version += 1
    appointment.updated_by = actor
    appointment.save(
        update_fields=[
            "status",
            "reschedule_source_exception",
            "reschedule_source_working_shift",
            "reschedule_source_clinic_weekday",
            "reschedule_source_kind",
            "reschedule_previous_status",
            "version",
            "updated_by",
            "updated_at",
        ]
    )


def _is_working_schedule_source(appointment):
    return (
        appointment.reschedule_source_kind
        == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
        or (
            appointment.reschedule_source_kind is None
            and appointment.reschedule_source_working_shift_id is not None
        )
    )


def _reconcile_available_override_lifecycle(
    *,
    old_state,
    new_state,
    settings,
    actor,
    request,
    current_time,
):
    """Reconcile appointments whose validity can change with an availability override."""
    states = [
        state
        for state in (old_state, new_state)
        if state is not None and state.is_active_doctor_override
    ]
    if not states:
        return [], [], []

    windows = Q(pk__in=[])
    for state in states:
        windows |= Q(
            doctor_id=state.doctor_id,
            start_datetime__lt=state.end_datetime,
            end_datetime__gt=state.start_datetime,
        )
    appointments = (
        Appointment.objects.select_for_update()
        .select_related("doctor")
        .filter(windows)
        .filter(
            status__in=[
                *NEEDS_RESCHEDULE_SOURCE_STATUSES,
                Appointment.Status.NEEDS_RESCHEDULE,
            ],
            start_datetime__gte=current_time,
        )
        .order_by("id")
    )

    marked = []
    restored = []
    still_blocked = []
    for appointment in appointments:
        provenance = current_reschedule_provenance(
            appointment,
            settings=settings,
            current_time=current_time,
        )
        if appointment.status in NEEDS_RESCHEDULE_SOURCE_STATUSES:
            if provenance is None:
                continue
            previous_status = appointment.status
            appointment.status = Appointment.Status.NEEDS_RESCHEDULE
            appointment.reschedule_previous_status = previous_status
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
                    "doctor_id": appointment.doctor_id,
                    "reschedule_source_type": provenance.kind,
                    "trigger": "AVAILABLE_OVERRIDE_RECONCILIATION",
                },
            )
            continue

        if not _is_working_schedule_source(appointment):
            continue
        previous_signature = _provenance_signature(appointment)
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
                    "trigger": "AVAILABLE_OVERRIDE_RECONCILIATION",
                },
            )
            continue

        if provenance is None:
            provenance = RescheduleProvenance(
                Appointment.RescheduleSourceKind.SCHEDULING_RULE_CONFLICT,
            )
        apply_reschedule_provenance(appointment, provenance)
        if _provenance_signature(appointment) != previous_signature:
            _save_reschedule_fields(appointment, actor)
            log_activity(
                request=request,
                actor=actor,
                action="appointment_reschedule_provenance_reconciled",
                entity_type="appointment",
                entity_id=appointment.id,
                metadata={
                    "appointment_id": appointment.id,
                    "previous_source_kind": previous_signature[0],
                    "current_source_kind": provenance.kind,
                    "trigger": "AVAILABLE_OVERRIDE_RECONCILIATION",
                },
            )
        still_blocked.append(appointment)
    return marked, restored, still_blocked


def _mark_appointment_for_leave(
    appointment,
    availability_exception,
    *,
    actor,
    request,
):
    previous = appointment.reschedule_previous_status or appointment.status
    appointment.status = Appointment.Status.NEEDS_RESCHEDULE
    appointment.reschedule_previous_status = previous
    apply_reschedule_provenance(
        appointment,
        RescheduleProvenance(
            Appointment.RescheduleSourceKind.LEAVE,
            availability_exception=availability_exception,
        ),
    )
    _save_reschedule_fields(appointment, actor)
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
            "reschedule_source_type": "LEAVE",
        },
    )


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
    appointments = (
        Appointment.objects.select_for_update()
        .filter(
            doctor=availability_exception.doctor,
            status__in=NEEDS_RESCHEDULE_SOURCE_STATUSES,
            start_datetime__gte=current_time or timezone.now(),
            start_datetime__lt=availability_exception.end_datetime,
            end_datetime__gt=availability_exception.start_datetime,
        )
        .order_by("id")
    )
    marked = []
    for appointment in appointments:
        _mark_appointment_for_leave(
            appointment,
            availability_exception,
            actor=actor,
            request=request,
        )
        marked.append(appointment)
    return marked


def _reconcile_exception_source_appointments(
    *,
    availability_exception,
    settings,
    actor,
    request,
    current_time,
):
    appointments = (
        Appointment.objects.select_for_update()
        .select_related("doctor")
        .filter(
            reschedule_source_exception=availability_exception,
            status=Appointment.Status.NEEDS_RESCHEDULE,
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
                    "availability_exception_id": availability_exception.id,
                    "reschedule_source_type": "LEAVE",
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
                    "availability_exception_id": availability_exception.id,
                    "previous_source_kind": previous_provenance[0],
                    "current_source_kind": provenance.kind,
                },
            )
    return restored, still_blocked


def save_availability_exception(*, serializer, user, request=None):
    with transaction.atomic():
        settings = _lock_clinic_settings()
        data = serializer.validated_data
        target = data.get("doctor") or data.get("staff")
        locked_users = _lock_users(getattr(target, "pk", None))
        doctor = locked_users.get(data.get("doctor").pk) if data.get("doctor") else None
        staff = locked_users.get(data.get("staff").pk) if data.get("staff") else None
        doctor, staff = _validate_exception_targets(doctor, staff)
        instance = serializer.save(
            doctor=doctor,
            staff=staff,
            created_by=user,
            updated_by=user,
        )
        instance.full_clean()
        now = timezone.now()
        override_marked, _, _ = _reconcile_available_override_lifecycle(
            old_state=None,
            new_state=ExceptionState.from_instance(instance),
            settings=settings,
            actor=user,
            request=request,
            current_time=now,
        )
        leave_marked = mark_overlapping_appointments_needs_reschedule(
            availability_exception=instance,
            request=request,
            actor=user,
            current_time=now,
        )
        return instance, [*override_marked, *leave_marked]


def update_availability_exception(*, instance, serializer, user, request=None):
    with transaction.atomic():
        settings = _lock_clinic_settings()
        data = serializer.validated_data
        locked_users = _lock_users(*_exception_target_ids(instance, data))
        locked = AvailabilityException.objects.select_for_update().get(pk=instance.pk)
        require_version(locked, data.get("version"))
        if locked.is_cancelled:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Cancelled availability exceptions cannot be edited.",
                status_code=status.HTTP_409_CONFLICT,
            )
        old_state = ExceptionState.from_instance(locked)
        submitted_doctor = data.get("doctor", locked.doctor)
        submitted_staff = data.get("staff", locked.staff)
        doctor = locked_users.get(submitted_doctor.pk) if submitted_doctor else None
        staff = locked_users.get(submitted_staff.pk) if submitted_staff else None
        doctor, staff = _validate_exception_targets(doctor, staff)
        for field, value in data.items():
            if field in {"doctor", "staff", "version"}:
                continue
            setattr(locked, field, value)
        locked.doctor = doctor
        locked.staff = staff
        locked.version += 1
        locked.updated_by = user
        locked.full_clean()
        locked.save()
        now = timezone.now()
        restored, still_blocked = _reconcile_exception_source_appointments(
            availability_exception=locked,
            settings=settings,
            actor=user,
            request=request,
            current_time=now,
        )
        override_marked, override_restored, override_blocked = (
            _reconcile_available_override_lifecycle(
                old_state=old_state,
                new_state=ExceptionState.from_instance(locked),
                settings=settings,
                actor=user,
                request=request,
                current_time=now,
            )
        )
        leave_marked = mark_overlapping_appointments_needs_reschedule(
            availability_exception=locked,
            request=request,
            actor=user,
            current_time=now,
        )
        marked = [*override_marked, *leave_marked]
        restored = [*restored, *override_restored]
        still_blocked = [*still_blocked, *override_blocked]
        log_activity(
            request=request,
            actor=user,
            action="availability_exception_appointments_reconciled",
            entity_type="availability_exception",
            entity_id=locked.id,
            metadata={
                "marked_needs_reschedule_count": len(marked),
                "restored_appointments_count": len(restored),
                "still_blocked_appointments_count": len(still_blocked),
            },
        )
        return locked, marked


def cancel_availability_exception(*, availability_exception, user, version, request=None):
    with transaction.atomic():
        settings = _lock_clinic_settings()
        _lock_users(availability_exception.doctor_id, availability_exception.staff_id)
        instance = AvailabilityException.objects.select_for_update().get(
            pk=availability_exception.pk,
        )
        require_version(instance, version)
        if instance.is_cancelled:
            raise AppointmentRuleError(
                "INVALID_STATUS_TRANSITION",
                "Availability exception is already cancelled.",
                status_code=status.HTTP_409_CONFLICT,
            )
        old_state = ExceptionState.from_instance(instance)
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
        restored, still_blocked = _reconcile_exception_source_appointments(
            availability_exception=instance,
            settings=settings,
            actor=user,
            request=request,
            current_time=instance.cancelled_at,
        )
        marked, override_restored, override_blocked = _reconcile_available_override_lifecycle(
            old_state=old_state,
            new_state=ExceptionState.from_instance(instance),
            settings=settings,
            actor=user,
            request=request,
            current_time=instance.cancelled_at,
        )
        return (
            instance,
            [*restored, *override_restored],
            [*still_blocked, *override_blocked, *marked],
        )
