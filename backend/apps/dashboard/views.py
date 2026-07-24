from django.db.models import Q
from django.utils import timezone
from zoneinfo import ZoneInfo
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
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
    now = timezone.localtime(timezone.now(), ZoneInfo(settings.timezone))
    return settings, now


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


def _working_hour_summary(working_hour):
    return {
        "id": working_hour.id,
        "weekday": working_hour.weekday,
        "start_time": working_hour.start_time,
        "end_time": working_hour.end_time,
        "is_active": working_hour.is_active,
    }


def _availability_exception_summary(exception):
    return {
        "id": exception.id,
        "doctor": _user_summary(exception.doctor) if exception.doctor_id else None,
        "staff": _user_summary(exception.staff) if exception.staff_id else None,
        "start_datetime": exception.start_datetime,
        "end_datetime": exception.end_datetime,
        "type": exception.type,
        "reason": exception.reason,
        "is_cancelled": exception.is_cancelled,
        "cancelled_at": exception.cancelled_at,
    }


def _visit_summary(visit):
    return {
        "id": visit.id,
        "patient": _patient_summary(visit.patient),
        "appointment_id": visit.appointment_id,
        "status": visit.status,
        "started_at": visit.started_at,
        "completed_at": visit.completed_at,
    }


def _handoff_summary(handoff):
    return {
        "id": handoff.id,
        "patient": _patient_summary(handoff.patient),
        "visit_id": handoff.visit_id,
        "doctor": _user_summary(handoff.doctor),
        "suggested_amount": handoff.suggested_amount,
        "currency": handoff.currency,
        "status": handoff.status,
        "created_at": handoff.created_at,
    }


def _invoice_summary(invoice):
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "patient": _patient_summary(invoice.patient),
        "currency": invoice.currency,
        "total_amount": invoice.total_amount,
        "paid_amount": invoice.paid_amount,
        "remaining_amount": invoice.remaining_amount,
        "status": invoice.status,
        "created_at": invoice.created_at,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    denied = _role_required(request, "ADMIN")
    if denied:
        return denied

    settings, now = _clinic_context()
    today = now.date()
    recent_appointments = Appointment.objects.select_related("patient", "doctor").order_by("-start_datetime", "-id")[:5]
    recent_invoices = Invoice.objects.select_related("patient").order_by("-created_at", "-id")[:5]
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "total_active_patients": Patient.objects.filter(is_archived=False).count(),
            "today_appointments_count": Appointment.objects.filter(start_datetime__date=today).count(),
            "checked_in_appointments_count": Appointment.objects.filter(status=Appointment.Status.CHECKED_IN).count(),
            "needs_reschedule_appointments_count": Appointment.objects.filter(status=Appointment.Status.NEEDS_RESCHEDULE).count(),
            "active_visits_count": Visit.objects.filter(status=Visit.Status.ACTIVE).count(),
            "pending_billing_handoffs_count": BillingHandoff.objects.filter(status=BillingHandoff.Status.PENDING).count(),
            "unpaid_invoices_count": Invoice.objects.filter(status=Invoice.Status.UNPAID).count(),
            "recent_appointments": [_appointment_summary(item) for item in recent_appointments],
            "recent_invoices": [_invoice_summary(item) for item in recent_invoices],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_dashboard(request):
    denied = _role_required(request, "STAFF")
    if denied:
        return denied

    settings, now = _clinic_context()
    today = now.date()
    upcoming_today = Appointment.objects.select_related("patient", "doctor").filter(
        start_datetime__date=today,
        status=Appointment.Status.UPCOMING,
    )[:10]
    checked_in = Appointment.objects.select_related("patient", "doctor").filter(status=Appointment.Status.CHECKED_IN)[:10]
    needs_reschedule = Appointment.objects.select_related("patient", "doctor").filter(status=Appointment.Status.NEEDS_RESCHEDULE)[:10]
    pending_handoffs = BillingHandoff.objects.select_related("patient", "doctor", "visit").filter(status=BillingHandoff.Status.PENDING)[:10]
    due_invoices = Invoice.objects.select_related("patient").filter(
        status__in=[Invoice.Status.UNPAID, Invoice.Status.PARTIALLY_PAID]
    )[:10]
    recent_patients = Patient.objects.filter(is_archived=False).order_by("-created_at", "-id")[:10]
    own_leave = AvailabilityException.objects.select_related("staff").filter(staff=request.user).order_by("-start_datetime", "-id")[:10]
    doctor_unavailable = (
        AvailabilityException.objects.select_related("doctor")
        .filter(doctor__isnull=False, type=AvailabilityException.Type.UNAVAILABLE, is_cancelled=False)
        .order_by("start_datetime", "id")[:25]
    )
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "today_appointments_count": Appointment.objects.filter(start_datetime__date=today).count(),
            "upcoming_today_appointments": [_appointment_summary(item) for item in upcoming_today],
            "checked_in_appointments": [_appointment_summary(item) for item in checked_in],
            "needs_reschedule_appointments": [_appointment_summary(item) for item in needs_reschedule],
            "pending_billing_handoffs": [_handoff_summary(item) for item in pending_handoffs],
            "unpaid_or_partially_paid_invoices": [_invoice_summary(item) for item in due_invoices],
            "recent_patients": [_patient_summary(item) for item in recent_patients],
            "own_working_schedule": [_working_hour_summary(item) for item in WorkingShift.objects.filter(employee=request.user).order_by("weekday", "start_time", "id")],
            "own_availability_exceptions": [_availability_exception_summary(item) for item in own_leave],
            "doctor_unavailable_exceptions": [_availability_exception_summary(item) for item in doctor_unavailable],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard(request):
    denied = _role_required(request, "DOCTOR")
    if denied:
        return denied

    settings, now = _clinic_context()
    today = now.date()
    own_appointments = Appointment.objects.select_related("patient", "doctor").filter(doctor=request.user)
    active_visit = (
        Visit.objects.select_related("patient", "appointment")
        .filter(doctor=request.user, status=Visit.Status.ACTIVE)
        .order_by("-started_at", "-id")
        .first()
    )
    recent_visits = Visit.objects.select_related("patient", "appointment").filter(doctor=request.user).order_by("-started_at", "-id")[:10]
    pending_handoffs = BillingHandoff.objects.select_related("patient", "doctor", "visit").filter(
        doctor=request.user,
        status=BillingHandoff.Status.PENDING,
    )[:10]
    own_working_schedule = WorkingShift.objects.filter(employee=request.user).order_by("weekday", "start_time", "id")
    own_leave = AvailabilityException.objects.select_related("doctor").filter(doctor=request.user).order_by("-start_datetime", "-id")[:10]
    return Response(
        {
            "clinic_date": today.isoformat(),
            "clinic_timezone": settings.timezone,
            "today_own_appointments": [_appointment_summary(item) for item in own_appointments.filter(start_datetime__date=today)[:10]],
            "own_checked_in_appointments": [_appointment_summary(item) for item in own_appointments.filter(status=Appointment.Status.CHECKED_IN)[:10]],
            "own_needs_reschedule_appointments": [
                _appointment_summary(item) for item in own_appointments.filter(status=Appointment.Status.NEEDS_RESCHEDULE)[:10]
            ],
            "own_active_visit": _visit_summary(active_visit) if active_visit else None,
            "own_completed_visits_today_count": Visit.objects.filter(
                Q(completed_at__date=today),
                doctor=request.user,
                status=Visit.Status.COMPLETED,
            ).count(),
            "own_recent_visits": [_visit_summary(item) for item in recent_visits],
            "own_pending_billing_handoffs": [_handoff_summary(item) for item in pending_handoffs],
            "own_working_schedule": [_working_hour_summary(item) for item in own_working_schedule],
            "own_availability_exceptions": [_availability_exception_summary(item) for item in own_leave],
        }
    )
