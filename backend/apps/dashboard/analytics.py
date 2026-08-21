from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Min
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.billing.models import BillingHandoff
from apps.billing.selectors import annotate_handoff_financials
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift


MEANINGFUL_PATIENT_STATUSES = {
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
    Appointment.Status.ACTIVE,
    Appointment.Status.COMPLETED,
}
CURRENCIES = [choice for choice, _ in BillingHandoff.Currency.choices]
HISTORICAL_SCHEDULE_ACCURACY = "CURRENT_TEMPLATE_APPROXIMATION"

# NO_SHOW consumed a reserved clinical slot and therefore counts as booked
# utilization. CANCELLED and NEEDS_RESCHEDULE do not consume booked minutes.
UTILIZATION_BOOKED_STATUSES = {
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
    Appointment.Status.ACTIVE,
    Appointment.Status.COMPLETED,
    Appointment.Status.NO_SHOW,
}


def _local_day_bounds(day, clinic_timezone):
    start = timezone.make_aware(datetime.combine(day, time.min), clinic_timezone)
    end = timezone.make_aware(datetime.combine(day + timedelta(days=1), time.min), clinic_timezone)
    return start, end


def _window(clinic_date, clinic_timezone, days):
    first_day = clinic_date - timedelta(days=days - 1)
    start, _ = _local_day_bounds(first_day, clinic_timezone)
    _, end = _local_day_bounds(clinic_date, clinic_timezone)
    return first_day, start, end


def _week_start(day):
    return day - timedelta(days=day.weekday())


def _decimal_string(value):
    return format(value or Decimal("0.00"), ".2f")


def appointment_daily_activity(clinic_date, clinic_timezone, days=30):
    first_day, start, end = _window(clinic_date, clinic_timezone, days)
    statuses = [status for status, _ in Appointment.Status.choices]
    activity = {
        (first_day + timedelta(days=offset)).isoformat(): {status: 0 for status in statuses}
        for offset in range(days)
    }
    rows = (
        Appointment.objects.filter(start_datetime__gte=start, start_datetime__lt=end)
        .annotate(day=TruncDate("start_datetime", tzinfo=clinic_timezone))
        .values("day", "status")
        .annotate(total=Count("id"))
    )
    for row in rows:
        activity[row["day"].isoformat()][row["status"]] = row["total"]
    return [{"date": day, **counts} for day, counts in activity.items()]


def _merge_intervals(intervals):
    merged = []
    for interval_start, interval_end in sorted(intervals):
        if interval_start >= interval_end:
            continue
        if not merged or interval_start > merged[-1][1]:
            merged.append([interval_start, interval_end])
        else:
            merged[-1][1] = max(merged[-1][1], interval_end)
    return [(interval_start, interval_end) for interval_start, interval_end in merged]


def _clip_interval(interval_start, interval_end, window_start, window_end):
    clipped_start = max(interval_start, window_start)
    clipped_end = min(interval_end, window_end)
    return (clipped_start, clipped_end) if clipped_start < clipped_end else None


def _subtract_intervals(base_intervals, blocked_intervals):
    remaining = []
    blockers = _merge_intervals(blocked_intervals)
    for base_start, base_end in _merge_intervals(base_intervals):
        cursor = base_start
        for blocked_start, blocked_end in blockers:
            if blocked_end <= cursor:
                continue
            if blocked_start >= base_end:
                break
            if blocked_start > cursor:
                remaining.append((cursor, min(blocked_start, base_end)))
            cursor = max(cursor, blocked_end)
            if cursor >= base_end:
                break
        if cursor < base_end:
            remaining.append((cursor, base_end))
    return remaining


def _interval_minutes(intervals):
    return int(sum((end - start).total_seconds() for start, end in intervals) // 60)


def _analysis_days(window_start, window_end, clinic_timezone):
    first_day = timezone.localtime(window_start, clinic_timezone).date()
    final_instant = window_end - timedelta(microseconds=1)
    last_day = timezone.localtime(final_instant, clinic_timezone).date()
    return [first_day + timedelta(days=offset) for offset in range((last_day - first_day).days + 1)]


def doctor_utilization(
    clinic_date,
    clinic_timezone,
    days=30,
    weekly_closed_days=None,
    *,
    window_start=None,
    window_end=None,
):
    """Return booked/effective-available minutes for every active Doctor.

    Availability uses the current recurring WorkingShift templates projected
    onto the requested window. Pearlix does not preserve effective-dated shift
    history, so historical denominators are explicitly a current-template
    approximation even though closure, override, leave, clipping, and interval
    union/subtraction math is exact for the stored inputs.
    """
    if (window_start is None and window_end is None):
        _, start, end = _window(clinic_date, clinic_timezone, days)
    elif window_start is not None and window_end is not None and window_start < window_end:
        start, end = window_start, window_end
    else:
        raise ValueError("window_start and window_end must define one positive analysis interval")
    if weekly_closed_days is None:
        weekly_closed_days = ClinicSettings.get_solo().weekly_closed_days
    closed_weekdays = set(weekly_closed_days)
    doctors = list(
        User.objects.filter(role=User.Role.DOCTOR, is_active=True).order_by("full_name", "id")
    )
    doctor_by_id = {doctor.id: doctor for doctor in doctors}
    doctor_ids = list(doctor_by_id)
    shifts = list(
        WorkingShift.objects.filter(
            is_active=True,
            employee_id__in=doctor_ids,
        ).order_by("employee_id", "weekday", "start_time")
    )
    shifts_by_doctor_weekday = defaultdict(list)
    for shift in shifts:
        shifts_by_doctor_weekday[(shift.employee_id, shift.weekday)].append(shift)

    exceptions_by_doctor = defaultdict(list)
    for exception in AvailabilityException.objects.filter(
        doctor_id__in=doctor_ids,
        is_cancelled=False,
        start_datetime__lt=end,
        end_datetime__gt=start,
    ).order_by("doctor_id", "start_datetime", "id"):
        exceptions_by_doctor[exception.doctor_id].append(exception)

    availability_intervals = defaultdict(list)
    unavailable_intervals = defaultdict(list)
    for day in _analysis_days(start, end, clinic_timezone):
        if day.weekday() in closed_weekdays:
            continue
        day_start, day_end = _local_day_bounds(day, clinic_timezone)
        clipped_day = _clip_interval(day_start, day_end, start, end)
        if not clipped_day:
            continue
        for doctor_id in doctor_ids:
            for shift in shifts_by_doctor_weekday[(doctor_id, day.weekday())]:
                shift_interval = _clip_interval(
                    timezone.make_aware(datetime.combine(day, shift.start_time), clinic_timezone),
                    timezone.make_aware(datetime.combine(day, shift.end_time), clinic_timezone),
                    *clipped_day,
                )
                if shift_interval:
                    availability_intervals[doctor_id].append(shift_interval)
            for exception in exceptions_by_doctor[doctor_id]:
                exception_interval = _clip_interval(
                    exception.start_datetime,
                    exception.end_datetime,
                    *clipped_day,
                )
                if not exception_interval:
                    continue
                if exception.type == AvailabilityException.Type.AVAILABLE_OVERRIDE:
                    availability_intervals[doctor_id].append(exception_interval)
                else:
                    unavailable_intervals[doctor_id].append(exception_interval)

    available = {
        doctor_id: _interval_minutes(
            _subtract_intervals(
                availability_intervals[doctor_id],
                unavailable_intervals[doctor_id],
            )
        )
        for doctor_id in doctor_ids
    }
    booked_intervals = defaultdict(list)
    for appointment in Appointment.objects.filter(
        doctor_id__in=doctor_ids,
        status__in=UTILIZATION_BOOKED_STATUSES,
        start_datetime__lt=end,
        end_datetime__gt=start,
    ).only("doctor_id", "start_datetime", "end_datetime"):
        appointment_interval = _clip_interval(
            appointment.start_datetime,
            appointment.end_datetime,
            start,
            end,
        )
        if appointment_interval:
            booked_intervals[appointment.doctor_id].append(appointment_interval)

    result = []
    for doctor_id, doctor in doctor_by_id.items():
        available_minutes = available[doctor_id]
        booked_minutes = _interval_minutes(_merge_intervals(booked_intervals[doctor_id]))
        utilization = round((booked_minutes / available_minutes) * 100, 1) if available_minutes else 0.0
        result.append(
            {
                "doctor": {"id": doctor.id, "full_name": doctor.full_name},
                "booked_minutes": booked_minutes,
                "available_minutes": available_minutes,
                "utilization_percent": utilization,
            }
        )
    return sorted(result, key=lambda row: (-row["utilization_percent"], row["doctor"]["full_name"]))


def patient_mix(clinic_date, clinic_timezone, weeks=8):
    last_week = _week_start(clinic_date)
    first_week = last_week - timedelta(weeks=weeks - 1)
    start, _ = _local_day_bounds(first_week, clinic_timezone)
    _, end = _local_day_bounds(last_week + timedelta(days=6), clinic_timezone)
    meaningful = Appointment.objects.filter(status__in=MEANINGFUL_PATIENT_STATUSES)
    first_appointments = {
        row["patient_id"]: row["first_at"]
        for row in meaningful.values("patient_id").annotate(first_at=Min("start_datetime"))
    }
    by_week = {
        (first_week + timedelta(weeks=offset)).isoformat(): {"new": set(), "returning": set()}
        for offset in range(weeks)
    }
    rows = meaningful.filter(start_datetime__gte=start, start_datetime__lt=end).values("patient_id", "start_datetime")
    for row in rows:
        local_day = timezone.localtime(row["start_datetime"], clinic_timezone).date()
        week_key = _week_start(local_day).isoformat()
        first_at = first_appointments[row["patient_id"]]
        first_day = timezone.localtime(first_at, clinic_timezone).date()
        bucket = "new" if _week_start(first_day).isoformat() == week_key else "returning"
        by_week[week_key][bucket].add(row["patient_id"])
    return [
        {"week_start": week, "new": len(values["new"]), "returning": len(values["returning"])}
        for week, values in by_week.items()
    ]


def appointment_problem_rate(clinic_date, clinic_timezone, weeks=8, *, as_of=None):
    """Return weekly outcome loss using appointments whose start has been reached.

    Numerator: CANCELLED + NO_SHOW. Denominator: all scheduled states except
    NEEDS_RESCHEDULE with start_datetime at or before the bucket's as-of bound.
    Historical completed weeks use the full week; the current partial week is
    clipped to clinic_now; wholly future weeks remain zero.
    """
    last_week = _week_start(clinic_date)
    first_week = last_week - timedelta(weeks=weeks - 1)
    start, _ = _local_day_bounds(first_week, clinic_timezone)
    _, end = _local_day_bounds(last_week + timedelta(days=6), clinic_timezone)
    as_of = timezone.localtime(as_of or timezone.now(), clinic_timezone)
    by_week = {
        (first_week + timedelta(weeks=offset)).isoformat(): {"scheduled": 0, "cancelled": 0, "no_show": 0}
        for offset in range(weeks)
    }
    rows = (
        Appointment.objects.filter(start_datetime__gte=start, start_datetime__lt=end)
        .exclude(status=Appointment.Status.NEEDS_RESCHEDULE)
        .values("start_datetime", "status")
    )
    for row in rows:
        local_day = timezone.localtime(row["start_datetime"], clinic_timezone).date()
        week_start = _week_start(local_day)
        week_start_at, _ = _local_day_bounds(week_start, clinic_timezone)
        _, week_end_at = _local_day_bounds(week_start + timedelta(days=6), clinic_timezone)
        if week_start_at > as_of:
            continue
        if as_of < week_end_at and row["start_datetime"] > as_of:
            continue
        bucket = by_week[week_start.isoformat()]
        bucket["scheduled"] += 1
        if row["status"] == Appointment.Status.CANCELLED:
            bucket["cancelled"] += 1
        elif row["status"] == Appointment.Status.NO_SHOW:
            bucket["no_show"] += 1
    return [
        {
            "week_start": week,
            **values,
            "rate_percent": round(((values["cancelled"] + values["no_show"]) / values["scheduled"]) * 100, 1)
            if values["scheduled"]
            else 0.0,
        }
        for week, values in by_week.items()
    ]


def receivables_aging(clinic_date, clinic_timezone):
    buckets = [
        ("0_7", 0, 7),
        ("8_30", 8, 30),
        ("31_60", 31, 60),
        ("60_plus", 61, None),
    ]
    result = {
        key: {currency: "0.00" for currency in CURRENCIES}
        for key, _, _ in buckets
    }
    totals = {key: {currency: Decimal("0.00") for currency in CURRENCIES} for key, _, _ in buckets}
    handoffs = annotate_handoff_financials(
        BillingHandoff.objects.filter(status__in=[BillingHandoff.Status.OPEN, BillingHandoff.Status.PARTIALLY_PAID])
    )
    for handoff in handoffs:
        remaining = max(Decimal("0.00"), handoff.total_amount - handoff.financial_paid_amount)
        created_day = timezone.localtime(handoff.created_at, clinic_timezone).date()
        age_days = max(0, (clinic_date - created_day).days)
        for key, minimum, maximum in buckets:
            if age_days >= minimum and (maximum is None or age_days <= maximum):
                totals[key][handoff.currency] += remaining
                break
    for key, _, _ in buckets:
        for currency in CURRENCIES:
            result[key][currency] = _decimal_string(totals[key][currency])
    return [{"bucket": key, **result[key]} for key, _, _ in buckets]
