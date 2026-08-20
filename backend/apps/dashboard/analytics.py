from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Min, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.billing.models import BillingHandoff
from apps.billing.selectors import annotate_handoff_financials
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment, WorkingShift


MEANINGFUL_PATIENT_STATUSES = {
    Appointment.Status.UPCOMING,
    Appointment.Status.CHECKED_IN,
    Appointment.Status.ACTIVE,
    Appointment.Status.COMPLETED,
}
PROBLEM_STATUSES = {Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW}
CURRENCIES = [choice for choice, _ in BillingHandoff.Currency.choices]


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


def doctor_utilization(
    clinic_date, clinic_timezone, days=30, weekly_closed_days=None
):
    first_day, start, end = _window(clinic_date, clinic_timezone, days)
    if weekly_closed_days is None:
        weekly_closed_days = ClinicSettings.get_solo().weekly_closed_days
    closed_weekdays = set(weekly_closed_days)
    shifts = list(
        WorkingShift.objects.select_related("employee")
        .filter(is_active=True, employee__role="DOCTOR")
        .order_by("employee_id", "weekday", "start_time")
    )
    doctor_by_id = {shift.employee_id: shift.employee for shift in shifts}
    available = defaultdict(int)
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        if day.weekday() in closed_weekdays:
            continue
        for shift in shifts:
            if shift.weekday == day.weekday():
                start_dt = datetime.combine(day, shift.start_time)
                end_dt = datetime.combine(day, shift.end_time)
                available[shift.employee_id] += int((end_dt - start_dt).total_seconds() // 60)

    booked = {
        row["doctor_id"]: row["minutes"] or 0
        for row in (
            Appointment.objects.filter(start_datetime__gte=start, start_datetime__lt=end)
            .exclude(status__in=[Appointment.Status.CANCELLED, Appointment.Status.NEEDS_RESCHEDULE])
            .values("doctor_id")
            .annotate(minutes=Sum("duration_minutes"))
        )
    }
    result = []
    for doctor_id, doctor in doctor_by_id.items():
        available_minutes = available[doctor_id]
        booked_minutes = int(booked.get(doctor_id, 0))
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


def appointment_problem_rate(clinic_date, clinic_timezone, weeks=8):
    last_week = _week_start(clinic_date)
    first_week = last_week - timedelta(weeks=weeks - 1)
    start, _ = _local_day_bounds(first_week, clinic_timezone)
    _, end = _local_day_bounds(last_week + timedelta(days=6), clinic_timezone)
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
        bucket = by_week[_week_start(local_day).isoformat()]
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
