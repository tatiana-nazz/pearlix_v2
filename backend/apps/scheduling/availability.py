from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.scheduling.appointment_services import ACTIVE_COUNTING_STATUSES, validate_duration
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.scheduling.time_utils import clinic_now, get_clinic_timezone


def _overlaps(row, start_datetime, end_datetime):
    return row["start_datetime"] < end_datetime and row["end_datetime"] > start_datetime


def build_availability_slots(*, doctor, date_value, duration_minutes):
    settings = validate_duration(duration_minutes)
    if settings.is_weekday_closed(date_value.weekday()):
        return []
    clinic_timezone = get_clinic_timezone(settings)
    slots = []
    step = timedelta(minutes=15)
    duration = timedelta(minutes=duration_minutes)
    day_start = timezone.make_aware(datetime.combine(date_value, time.min), clinic_timezone)
    day_end = day_start + timedelta(days=1)

    blocks = [
        (
            timezone.make_aware(datetime.combine(date_value, shift.start_time), clinic_timezone),
            timezone.make_aware(datetime.combine(date_value, shift.end_time), clinic_timezone),
        )
        for shift in WorkingShift.objects.filter(
            employee=doctor,
            weekday=date_value.weekday(),
            is_active=True,
        ).order_by("start_time")
    ]
    exception_rows = list(
        AvailabilityException.objects.filter(
            doctor=doctor,
            is_cancelled=False,
            start_datetime__lt=day_end,
            end_datetime__gt=day_start,
        ).values("type", "start_datetime", "end_datetime")
    )
    for override in exception_rows:
        if override["type"] == AvailabilityException.Type.AVAILABLE_OVERRIDE:
            blocks.append(
                (
                    max(override["start_datetime"].astimezone(clinic_timezone), day_start),
                    min(override["end_datetime"].astimezone(clinic_timezone), day_end),
                )
            )
    unavailable_rows = [
        row for row in exception_rows if row["type"] == AvailabilityException.Type.UNAVAILABLE
    ]
    appointment_rows = list(
        Appointment.objects.filter(
            status__in=ACTIVE_COUNTING_STATUSES,
            start_datetime__lt=day_end,
            end_datetime__gt=day_start,
        ).values("doctor_id", "start_datetime", "end_datetime")
    )

    seen = set()
    for block_start, block_end in blocks:
        cursor = block_start
        while cursor + duration <= block_end:
            end = cursor + duration
            overlapping_appointments = [
                row for row in appointment_rows if _overlaps(row, cursor, end)
            ]
            count = len(overlapping_appointments)
            doctor_conflict = any(row["doctor_id"] == doctor.id for row in overlapping_appointments)
            unavailable = any(_overlaps(row, cursor, end) for row in unavailable_rows)
            if (
                cursor not in seen
                and (date_value != clinic_now(settings).date() or cursor > clinic_now(settings))
                and count < settings.capacity_per_slot
                and not doctor_conflict
                and not unavailable
            ):
                slots.append(
                    {
                        "start_datetime": cursor.isoformat(),
                        "end_datetime": end.isoformat(),
                        "current_count": count,
                        "capacity": settings.capacity_per_slot,
                    }
                )
                seen.add(cursor)
            cursor += step
    return slots
