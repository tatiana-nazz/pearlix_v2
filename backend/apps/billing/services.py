from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status

from apps.audit.services import log_activity
from apps.billing.models import BillingHandoff, Invoice, InvoiceSequence
from apps.billing.selectors import annotate_handoff_financials
from apps.common.errors import error_response
from apps.visits.models import Visit


ZERO = Decimal("0.00")


class BillingRuleError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        details: dict | None = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def _invalid_transition(message: str) -> BillingRuleError:
    return BillingRuleError("INVALID_STATUS_TRANSITION", message, status_code=status.HTTP_409_CONFLICT)


def _validation(details: dict) -> BillingRuleError:
    return BillingRuleError("VALIDATION_ERROR", "Some fields are invalid.", details)


def _validate_positive_amount(value, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except Exception as exc:
        raise _validation({field: ["Enter a valid amount."]}) from exc
    if amount <= ZERO:
        raise _validation({field: ["Amount must be positive."]})
    return amount


def _validate_currency(value, field: str = "currency") -> str:
    if value not in BillingHandoff.Currency.values:
        raise _validation({field: ["Currency must be SYP or USD."]})
    return value


def _validate_description(value) -> str:
    description = str(value or "").strip()
    if not description:
        raise _validation({"description": ["This field is required."]})
    return description


def calculate_handoff_paid_amount(handoff: BillingHandoff) -> Decimal:
    total = handoff.invoices.aggregate(total=Sum("amount"))["total"]
    return total or ZERO


def calculate_handoff_remaining_amount(handoff: BillingHandoff) -> Decimal:
    return max(handoff.total_amount - calculate_handoff_paid_amount(handoff), ZERO)


def refresh_handoff_status(handoff: BillingHandoff) -> BillingHandoff:
    if handoff.status == BillingHandoff.Status.CANCELLED:
        return handoff
    paid = calculate_handoff_paid_amount(handoff)
    if paid == ZERO:
        next_status = BillingHandoff.Status.OPEN
    elif paid < handoff.total_amount:
        next_status = BillingHandoff.Status.PARTIALLY_PAID
    else:
        next_status = BillingHandoff.Status.PAID
    if handoff.status != next_status:
        handoff.status = next_status
        handoff.save(update_fields=["status", "updated_at"])
    return handoff


def _invoice_scope_and_prefix():
    today = timezone.localdate().strftime("%Y%m%d")
    return today, f"INV-{today}-"


def _max_existing_invoice_sequence(prefix: str) -> int:
    maximum = 0
    for number in Invoice.objects.filter(invoice_number__startswith=prefix).values_list("invoice_number", flat=True):
        suffix = number.removeprefix(prefix)
        if suffix.isdigit():
            maximum = max(maximum, int(suffix))
    return maximum


def _locked_invoice_sequence(scope: str, prefix: str) -> InvoiceSequence:
    try:
        sequence, _ = InvoiceSequence.objects.select_for_update().get_or_create(
            scope=scope,
            defaults={"last_number": _max_existing_invoice_sequence(prefix)},
        )
    except IntegrityError:
        sequence = InvoiceSequence.objects.select_for_update().get(scope=scope)
    return sequence


def generate_invoice_number() -> str:
    scope, prefix = _invoice_scope_and_prefix()
    sequence = _locked_invoice_sequence(scope, prefix)
    while True:
        sequence.last_number += 1
        candidate = f"{prefix}{sequence.last_number:06d}"
        if not Invoice.objects.filter(invoice_number=candidate).exists():
            sequence.save(update_fields=["last_number", "updated_at"])
            return candidate


def _create_invoice_with_sequence(**kwargs) -> Invoice:
    for _ in range(3):
        try:
            with transaction.atomic():
                return Invoice.objects.create(invoice_number=generate_invoice_number(), **kwargs)
        except IntegrityError:
            continue
    raise BillingRuleError(
        "INVOICE_NUMBER_GENERATION_FAILED",
        "Invoice number could not be generated safely. Please retry.",
        status_code=status.HTTP_409_CONFLICT,
    )


def create_visit_completion_handoff(*, visit: Visit, user, data: dict) -> BillingHandoff:
    if user.role != "DOCTOR":
        raise BillingRuleError(
            "PERMISSION_DENIED",
            "You do not have permission to perform this action.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    description = _validate_description(data.get("description"))
    total_amount = _validate_positive_amount(data.get("total_amount"), "total_amount")
    currency = _validate_currency(data.get("currency"))

    visit = Visit.objects.select_for_update().select_related("patient", "doctor").get(pk=visit.pk)
    if visit.doctor_id != user.id:
        raise BillingRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)
    if visit.status != Visit.Status.COMPLETED:
        raise _invalid_transition("Bill creation requires a completed visit.")
    if BillingHandoff.objects.select_for_update().filter(visit=visit).exists():
        raise BillingRuleError(
            "VISIT_HANDOFF_EXISTS",
            "A bill already exists for this visit.",
            status_code=status.HTTP_409_CONFLICT,
        )
    try:
        return BillingHandoff.objects.create(
            patient=visit.patient,
            visit=visit,
            doctor=visit.doctor,
            description=description,
            total_amount=total_amount,
            currency=currency,
            note=data.get("note", ""),
            status=BillingHandoff.Status.OPEN,
            origin=BillingHandoff.Origin.VISIT_COMPLETION,
            created_by=user,
            updated_by=user,
        )
    except IntegrityError as exc:
        raise BillingRuleError(
            "VISIT_HANDOFF_EXISTS",
            "A bill already exists for this visit.",
            status_code=status.HTTP_409_CONFLICT,
        ) from exc


def issue_invoice(*, handoff: BillingHandoff, user, data: dict, request=None) -> tuple[Invoice, BillingHandoff]:
    if user.role != "STAFF":
        raise BillingRuleError(
            "PERMISSION_DENIED",
            "You do not have permission to perform this action.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    amount = _validate_positive_amount(data.get("amount"), "amount")
    with transaction.atomic():
        # Keep the row lock on the bill itself. Joining nullable Visit here makes
        # PostgreSQL reject FOR UPDATE on the nullable side of the outer join.
        handoff = BillingHandoff.objects.select_for_update().get(pk=handoff.pk)
        refresh_handoff_status(handoff)
        if handoff.status == BillingHandoff.Status.CANCELLED:
            raise _invalid_transition("Cancelled bills cannot receive payments.")
        remaining = calculate_handoff_remaining_amount(handoff)
        if remaining == ZERO:
            raise _invalid_transition("This bill is already fully paid.")
        if amount > remaining:
            raise BillingRuleError(
                "OVERPAYMENT_NOT_ALLOWED",
                "Payment amount exceeds the bill remaining amount.",
                {"amount": ["Payment amount exceeds the bill remaining amount."]},
            )
        invoice = _create_invoice_with_sequence(
            billing_handoff=handoff,
            amount=amount,
            issued_at=data.get("issued_at") or timezone.now(),
            notes=data.get("notes", ""),
            created_by=user,
        )
        refresh_handoff_status(handoff)
        log_activity(
            request=request,
            actor=user,
            action="invoice_issued",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={
                "invoice_id": invoice.id,
                "billing_handoff_id": handoff.id,
                "patient_id": handoff.patient_id,
                "amount": str(invoice.amount),
                "currency": handoff.currency,
            },
            raise_on_error=True,
        )
        return invoice, handoff


def invoice_print_data(invoice: Invoice) -> dict:
    from apps.clinic.models import ClinicSettings

    handoff = annotate_handoff_financials(
        BillingHandoff.objects.select_related("patient", "visit", "visit__appointment")
    ).get(pk=invoice.billing_handoff_id)
    clinic = ClinicSettings.get_solo()
    return {
        "clinic": {
            "clinic_name": clinic.clinic_name,
            "address": clinic.address,
            "phone": clinic.phone,
            "email": clinic.email,
            "timezone": clinic.timezone,
        },
        "invoice": {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "issued_at": invoice.issued_at,
            "amount": invoice.amount,
            "notes": invoice.notes,
            "issued_by": invoice.created_by.full_name if invoice.created_by_id else None,
        },
        "patient": {
            "id": handoff.patient_id,
            "full_name": handoff.patient.full_name,
            "phone_number": handoff.patient.phone_number,
            "email": handoff.patient.email,
        },
        "handoff": {
            "id": handoff.id,
            "description": handoff.description,
            "total_amount": handoff.total_amount,
            "paid_amount": handoff.paid_amount,
            "remaining_amount": handoff.remaining_amount,
            "currency": handoff.currency,
            "status": handoff.status,
        },
        "visit": {"id": handoff.visit_id, "status": handoff.visit.status} if handoff.visit_id else None,
        "appointment": {
            "id": handoff.visit.appointment_id,
            "status": handoff.visit.appointment.status,
        }
        if handoff.visit_id
        else None,
    }
