from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


User = get_user_model()


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
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        appointment = Appointment.objects.select_for_update().select_related("patient", "doctor").get(pk=appointment.pk)

        if (
            appointment.doctor_id != locked_user.id
            or locked_user.role != User.Role.DOCTOR
            or not locked_user.is_active
        ):
            raise VisitRuleError("NOT_FOUND", "Visit target was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if Visit.objects.select_for_update().filter(appointment=appointment).exists():
            raise _invalid_status("Appointment already has a visit.")
        if appointment.status != Appointment.Status.CHECKED_IN:
            raise _invalid_status()
        if Visit.objects.select_for_update().filter(doctor=locked_user, status=Visit.Status.ACTIVE).exists():
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
                doctor=locked_user,
                status=Visit.Status.ACTIVE,
                started_at=now,
                created_by=locked_user,
                updated_by=locked_user,
            )
        except IntegrityError as exc:
            raise VisitRuleError(
                "ACTIVE_VISIT_EXISTS",
                "Doctor already has an active visit.",
                status_code=status.HTTP_409_CONFLICT,
            ) from exc

        appointment.status = Appointment.Status.ACTIVE
        appointment.updated_by = locked_user
        appointment.version += 1
        appointment.save(update_fields=["status", "updated_by", "version", "updated_at"])
        return visit


def complete_visit(*, visit: Visit, user, expected_updated_at, notes: dict, billing: dict, request=None):
    from apps.billing.models import BillingHandoff
    from apps.billing.services import BillingRuleError, create_visit_completion_handoff

    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        appointment_id = Visit.objects.only("appointment_id").get(pk=visit.pk).appointment_id
        appointment = Appointment.objects.select_for_update().get(pk=appointment_id)
        visit = Visit.objects.select_for_update().select_related("appointment").get(pk=visit.pk)
        if (
            visit.doctor_id != locked_user.id
            or locked_user.role != User.Role.DOCTOR
            or not locked_user.is_active
        ):
            raise VisitRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if visit.status != Visit.Status.ACTIVE:
            raise VisitRuleError(
                "INVALID_STATUS_TRANSITION",
                "Only active visits can be completed.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if appointment.status != Appointment.Status.ACTIVE or visit.appointment_id != appointment.id:
            raise VisitRuleError(
                "INVALID_STATUS_TRANSITION",
                "Only an active appointment can be completed.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if visit.updated_at != expected_updated_at:
            raise VisitRuleError(
                "VERSION_CONFLICT",
                "This visit was updated elsewhere. Refresh before completing it.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if BillingHandoff.objects.select_for_update().filter(visit=visit).exists():
            raise VisitRuleError(
                "VISIT_BILLING_EXISTS",
                "Billing already exists for this visit.",
                status_code=status.HTTP_409_CONFLICT,
            )

        update_clinical_notes(visit=visit, data=notes, user=locked_user)

        now = timezone.now()
        visit.status = Visit.Status.COMPLETED
        visit.completed_at = now
        visit.updated_by = locked_user
        visit.save(update_fields=["status", "completed_at", "updated_by", "updated_at"])

        appointment.status = Appointment.Status.COMPLETED
        appointment.updated_by = locked_user
        appointment.version += 1
        appointment.save(update_fields=["status", "updated_by", "version", "updated_at"])
        try:
            handoff = create_visit_completion_handoff(visit=visit, user=locked_user, data=billing)
        except BillingRuleError as exc:
            raise VisitRuleError(exc.code, exc.message, exc.details, exc.status_code) from exc
        audit_metadata = {
            "visit_id": visit.id,
            "appointment_id": visit.appointment_id,
            "patient_id": visit.patient_id,
            "doctor_id": visit.doctor_id,
            "billing_handoff_id": handoff.id,
        }
        log_activity(
            request=request,
            actor=locked_user,
            action="visit_completed",
            entity_type="visit",
            entity_id=visit.id,
            metadata=audit_metadata,
            raise_on_error=True,
        )
        log_activity(
            request=request,
            actor=locked_user,
            action="billing_handoff_created",
            entity_type="billing_handoff",
            entity_id=handoff.id,
            metadata={
                **audit_metadata,
                "status": handoff.status,
                "origin": handoff.origin,
            },
            raise_on_error=True,
        )
        return visit, handoff


def update_clinical_notes(*, visit: Visit, data: dict, user):
    fields = ("symptoms", "diagnosis", "treatment", "clinical_notes", "follow_up_notes")
    for field in fields:
        if field in data:
            setattr(visit, field, data[field])
    visit.updated_by = user
    visit.save(update_fields=[field for field in fields if field in data] + ["updated_by", "updated_at"])
    return visit
