from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from zoneinfo import ZoneInfo
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.billing.models import BillingHandoff, Invoice
from apps.billing.selectors import annotate_handoff_financials
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


def _role_required(request, role):
    if request.user.role != role:
        return error_response(
            "PERMISSION_DENIED",
            "You do not have permission to perform this action.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    return None


def _clinic_context():
    settings = ClinicSettings.get_solo()
    clinic_timezone = ZoneInfo(settings.timezone)
    now = timezone.localtime(timezone.now(), clinic_timezone)
    return settings, clinic_timezone, now


def _local_day_bounds(day, clinic_timezone):
    start = timezone.make_aware(datetime.combine(day, time.min), clinic_timezone)
    end = timezone.make_aware(datetime.combine(day + timedelta(days=1), time.min), clinic_timezone)
    return start, end


def _clinic_window(clinic_date, clinic_timezone, days):
    first_day = clinic_date - timedelta(days=days - 1)
    start, _ = _local_day_bounds(first_day, clinic_timezone)
    _, end = _local_day_bounds(clinic_date, clinic_timezone)
    return first_day, start, end


def _decimal_string(value):
    return format(value or Decimal("0.00"), ".2f")


def _appointment_status_activity(clinic_date, clinic_timezone):
    _, start, end = _clinic_window(clinic_date, clinic_timezone, 7)
    totals = {status: 0 for status, _ in Appointment.Status.choices}
    rows = (
        Appointment.objects.filter(start_datetime__gte=start, start_datetime__lt=end)
        .values("status")
        .annotate(total=Count("id"))
    )
    for row in rows:
        totals[row["status"]] = row["total"]
    return totals


def _billing_activity(clinic_date, clinic_timezone):
    first_day, start, end = _clinic_window(clinic_date, clinic_timezone, 30)
    activity = {
        (first_day + timedelta(days=offset)).isoformat(): {
            currency: {"billed": "0.00", "collected": "0.00"}
            for currency, _ in BillingHandoff.Currency.choices
        }
        for offset in range(30)
    }
    handoff_rows = (
        BillingHandoff.objects.filter(created_at__gte=start, created_at__lt=end)
        .exclude(status=BillingHandoff.Status.CANCELLED)
        .annotate(day=TruncDate("created_at", tzinfo=clinic_timezone))
        .values("day", "currency")
        .annotate(total=Sum("total_amount"))
    )
    invoice_rows = (
        Invoice.objects.filter(issued_at__gte=start, issued_at__lt=end)
        .annotate(day=TruncDate("issued_at", tzinfo=clinic_timezone))
        .values("day", "billing_handoff__currency")
        .annotate(total=Sum("amount"))
    )
    for row in handoff_rows:
        activity[row["day"].isoformat()][row["currency"]]["billed"] = _decimal_string(row["total"])
    for row in invoice_rows:
        currency = row["billing_handoff__currency"]
        activity[row["day"].isoformat()][currency]["collected"] = _decimal_string(row["total"])
    return [{"date": day, **values} for day, values in activity.items()]


def _patient_summary(patient):
    return {"id": patient.id, "full_name": patient.full_name, "phone_number": patient.phone_number}


def _user_summary(user):
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}


def _appointment_summary(appointment):
    return {
        "id": appointment.id,
        "patient": _patient_summary(appointment.patient),
        "doctor": _user_summary(appointment.doctor),
        "start_datetime": appointment.start_datetime,
        "end_datetime": appointment.end_datetime,
        "duration_minutes": appointment.duration_minutes,
        "status": appointment.status,
        "reason": appointment.reason,
    }


def _visit_summary(visit):
    return {
        "id": visit.id,
        "patient": _patient_summary(visit.patient),
        "appointment_id": visit.appointment_id,
        "appointment_reason": visit.appointment.reason,
        "appointment_start_datetime": visit.appointment.start_datetime,
        "status": visit.status,
        "started_at": visit.started_at,
        "completed_at": visit.completed_at,
    }


def _handoff_summary(handoff):
    return {
        "id": handoff.id,
        "patient": _patient_summary(handoff.patient),
        "description": handoff.description,
        "currency": handoff.currency,
        "total_amount": handoff.total_amount,
        "paid_amount": handoff.paid_amount,
        "remaining_amount": handoff.remaining_amount,
        "status": handoff.status,
        "created_at": handoff.created_at,
    }


def _collected_by_currency(start, end):
    totals = {choice: Decimal("0.00") for choice, _ in BillingHandoff.Currency.choices}
    rows = (
        Invoice.objects.filter(issued_at__gte=start, issued_at__lt=end)
        .values("billing_handoff__currency")
        .annotate(total=Sum("amount"))
    )
    for row in rows:
        totals[row["billing_handoff__currency"]] = row["total"] or Decimal("0.00")
    return totals


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    denied = _role_required(request, "ADMIN")
    if denied:
        return denied

    settings, clinic_timezone, now = _clinic_context()
    today = now.date()
    today_start, tomorrow_start = _local_day_bounds(today, clinic_timezone)
    today_appointments = (
        Appointment.objects.select_related("patient", "doctor")
        .filter(start_datetime__gte=today_start, start_datetime__lt=tomorrow_start)
        .order_by("start_datetime", "id")
    )
    recent_handoffs = annotate_handoff_financials(
        BillingHandoff.objects.select_related("patient")
    ).order_by("-created_at", "-id")[:6]
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "today_appointments_count": today_appointments.count(),
            "checked_in_appointments_count": today_appointments.filter(status=Appointment.Status.CHECKED_IN).count(),
            "needs_reschedule_appointments_count": Appointment.objects.filter(status=Appointment.Status.NEEDS_RESCHEDULE).count(),
            "active_visits_count": Visit.objects.filter(status=Visit.Status.ACTIVE).count(),
            "open_bills_count": BillingHandoff.objects.filter(status=BillingHandoff.Status.OPEN).count(),
            "partially_paid_bills_count": BillingHandoff.objects.filter(status=BillingHandoff.Status.PARTIALLY_PAID).count(),
            "today_invoices_count": Invoice.objects.filter(
                issued_at__gte=today_start,
                issued_at__lt=tomorrow_start,
            ).count(),
            "collected_today": _collected_by_currency(today_start, tomorrow_start),
            "today_appointments": [_appointment_summary(item) for item in today_appointments[:7]],
            "appointment_status_last_7_days": _appointment_status_activity(today, clinic_timezone),
            "billing_activity_last_30_days": _billing_activity(today, clinic_timezone),
            "recent_handoffs": [_handoff_summary(item) for item in recent_handoffs],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_dashboard(request):
    denied = _role_required(request, "STAFF")
    if denied:
        return denied

    settings, clinic_timezone, now = _clinic_context()
    today = now.date()
    today_start, tomorrow_start = _local_day_bounds(today, clinic_timezone)
    today_appointments = (
        Appointment.objects.select_related("patient", "doctor")
        .filter(start_datetime__gte=today_start, start_datetime__lt=tomorrow_start)
        .order_by("start_datetime", "id")
    )
    needs_reschedule_count = Appointment.objects.filter(status=Appointment.Status.NEEDS_RESCHEDULE).count()
    due_handoffs = annotate_handoff_financials(
        BillingHandoff.objects.select_related("patient").filter(
            status__in=[BillingHandoff.Status.OPEN, BillingHandoff.Status.PARTIALLY_PAID]
        )
    ).order_by("-created_at", "-id")[:6]
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "today_appointments_count": today_appointments.count(),
            "patients_ready_count": today_appointments.filter(status=Appointment.Status.CHECKED_IN).count(),
            "needs_reschedule_count": needs_reschedule_count,
            "open_bills_count": BillingHandoff.objects.filter(status=BillingHandoff.Status.OPEN).count(),
            "partially_paid_bills_count": BillingHandoff.objects.filter(status=BillingHandoff.Status.PARTIALLY_PAID).count(),
            "today_invoices_count": Invoice.objects.filter(
                issued_at__gte=today_start,
                issued_at__lt=tomorrow_start,
            ).count(),
            "collected_today": _collected_by_currency(today_start, tomorrow_start),
            "today_appointments": [_appointment_summary(item) for item in today_appointments[:12]],
            "open_handoffs": [_handoff_summary(item) for item in due_handoffs],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard(request):
    denied = _role_required(request, "DOCTOR")
    if denied:
        return denied

    settings, clinic_timezone, now = _clinic_context()
    today = now.date()
    today_start, tomorrow_start = _local_day_bounds(today, clinic_timezone)
    own_appointments = Appointment.objects.select_related("patient", "doctor").filter(doctor=request.user)
    today_appointments = own_appointments.filter(
        start_datetime__gte=today_start,
        start_datetime__lt=tomorrow_start,
    ).order_by("start_datetime", "id")
    active_visit = (
        Visit.objects.select_related("patient", "appointment")
        .filter(doctor=request.user, status=Visit.Status.ACTIVE)
        .order_by("-started_at", "-id")
        .first()
    )
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "today_appointments_count": today_appointments.count(),
            "patients_ready_count": today_appointments.filter(status=Appointment.Status.CHECKED_IN).count(),
            "needs_reschedule_count": own_appointments.filter(status=Appointment.Status.NEEDS_RESCHEDULE).count(),
            "today_appointments": [_appointment_summary(item) for item in today_appointments],
            "own_active_visit": _visit_summary(active_visit) if active_visit else None,
            "completed_today_count": Visit.objects.filter(
                completed_at__gte=today_start,
                completed_at__lt=tomorrow_start,
                doctor=request.user,
                status=Visit.Status.COMPLETED,
            ).count(),
        }
    )
