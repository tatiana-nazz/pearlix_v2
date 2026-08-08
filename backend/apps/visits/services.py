from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


class VisitRuleError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def _invalid_status(message: str = "Invalid appointment status transition."):
    return VisitRuleError("INVALID_STATUS_TRANSITION", message, status_code=status.HTTP_409_CONFLICT)


def start_visit_from_appointment(*, appointment: Appointment, user):
    with transaction.atomic():
        appointment = Appointment.objects.select_for_update().select_related("patient", "doctor").get(pk=appointment.pk)

        if appointment.doctor_id != user.id:
            raise VisitRuleError("NOT_FOUND", "Visit target was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if Visit.objects.select_for_update().filter(appointment=appointment).exists():
            raise _invalid_status("Appointment already has a visit.")
        if appointment.status != Appointment.Status.CHECKED_IN:
            raise _invalid_status()
        if Visit.objects.select_for_update().filter(doctor=user, status=Visit.Status.ACTIVE).exists():
            raise VisitRuleError(
                "ACTIVE_VISIT_EXISTS",
                "Doctor already has an active visit.",
                status_code=status.HTTP_409_CONFLICT,
            )

        now = timezone.now()
        try:
            visit = Visit.objects.create(
                appointment=appointment,
                patient=appointment.patient,
                doctor=appointment.doctor,
                status=Visit.Status.ACTIVE,
                started_at=now,
                created_by=user,
                updated_by=user,
            )
        except IntegrityError as exc:
            raise VisitRuleError(
                "ACTIVE_VISIT_EXISTS",
                "Doctor already has an active visit.",
                status_code=status.HTTP_409_CONFLICT,
            ) from exc

        appointment.status = Appointment.Status.ACTIVE
        appointment.updated_by = user
        appointment.save(update_fields=["status", "updated_by", "updated_at"])
        return visit


def complete_visit(*, visit: Visit, user, expected_updated_at, notes: dict, billing: dict, request=None):
    from apps.billing.models import BillingHandoff, Invoice
    from apps.billing.services import BillingRuleError, create_visit_completion_invoice

    with transaction.atomic():
        visit = Visit.objects.select_for_update().select_related("appointment").get(pk=visit.pk)
        if visit.doctor_id != user.id:
            raise VisitRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if visit.status != Visit.Status.ACTIVE:
            raise VisitRuleError(
                "INVALID_STATUS_TRANSITION",
                "Only active visits can be completed.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if visit.updated_at != expected_updated_at:
            raise VisitRuleError(
                "VERSION_CONFLICT",
                "This visit was updated elsewhere. Refresh before completing it.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if BillingHandoff.objects.select_for_update().filter(visit=visit).exists() or Invoice.objects.select_for_update().filter(visit=visit).exists():
            raise VisitRuleError(
                "VISIT_BILLING_EXISTS",
                "Billing already exists for this visit.",
                status_code=status.HTTP_409_CONFLICT,
            )

        update_clinical_notes(visit=visit, data=notes, user=user)

        now = timezone.now()
        visit.status = Visit.Status.COMPLETED
        visit.completed_at = now
        visit.updated_by = user
        visit.save(update_fields=["status", "completed_at", "updated_by", "updated_at"])

        appointment = visit.appointment
        appointment.status = Appointment.Status.COMPLETED
        appointment.updated_by = user
        appointment.save(update_fields=["status", "updated_by", "updated_at"])
        try:
            invoice, handoff = create_visit_completion_invoice(visit=visit, user=user, data=billing)
        except BillingRuleError as exc:
            raise VisitRuleError(exc.code, exc.message, exc.details, exc.status_code) from exc
        audit_metadata = {
            "visit_id": visit.id,
            "appointment_id": visit.appointment_id,
            "patient_id": visit.patient_id,
            "doctor_id": visit.doctor_id,
            "invoice_id": invoice.id,
        }
        log_activity(
            request=request,
            actor=user,
            action="visit_completed",
            entity_type="visit",
            entity_id=visit.id,
            metadata=audit_metadata,
            raise_on_error=True,
        )
        log_activity(
            request=request,
            actor=user,
            action="invoice_created",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={
                **audit_metadata,
                "billing_handoff_id": handoff.id,
                "origin": invoice.origin,
            },
            raise_on_error=True,
        )
        return visit, invoice, handoff


def update_clinical_notes(*, visit: Visit, data: dict, user):
    fields = ("symptoms", "diagnosis", "treatment", "clinical_notes", "follow_up_notes")
    for field in fields:
        if field in data:
            setattr(visit, field, data[field])
    visit.updated_by = user
    visit.save(update_fields=[field for field in fields if field in data] + ["updated_by", "updated_at"])
    return visit
