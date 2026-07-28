from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status

from apps.common.errors import error_response
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.billing.models import BillingHandoff, Invoice, InvoiceSequence, Payment


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


def _decimal(value, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise _validation({field: ["Enter a valid amount."]}) from exc


def _validate_positive_amount(value, field: str) -> Decimal:
    amount = _decimal(value, field)
    if amount <= Decimal("0"):
        raise _validation({field: ["Amount must be positive."]})
    return amount


def _validate_currency(currency: str | None, *, field: str = "currency") -> str:
    if currency not in Invoice.Currency.values:
        raise _validation({field: ["Currency must be SYP or USD."]})
    return currency


def calculate_paid_amount(invoice: Invoice) -> Decimal:
    total = invoice.payments.aggregate(total=Sum("amount"))["total"]
    return total or Decimal("0.00")


def calculate_remaining_amount(invoice: Invoice) -> Decimal:
    remaining = invoice.total_amount - calculate_paid_amount(invoice)
    return remaining if remaining > Decimal("0.00") else Decimal("0.00")


def _invoice_scope_and_prefix():
    today = timezone.localdate().strftime("%Y%m%d")
    return today, f"INV-{today}-"


def _max_existing_invoice_sequence(prefix: str) -> int:
    max_number = 0
    for invoice_number in Invoice.objects.filter(invoice_number__startswith=prefix).values_list("invoice_number", flat=True):
        suffix = invoice_number.removeprefix(prefix)
        if suffix.isdigit():
            max_number = max(max_number, int(suffix))
    return max_number


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


def refresh_invoice_payment_status(invoice: Invoice) -> Invoice:
    if invoice.status == Invoice.Status.CANCELLED:
        return invoice
    paid_amount = calculate_paid_amount(invoice)
    if paid_amount == Decimal("0.00"):
        status_value = Invoice.Status.UNPAID
    elif paid_amount < invoice.total_amount:
        status_value = Invoice.Status.PARTIALLY_PAID
    else:
        status_value = Invoice.Status.PAID
    if invoice.status != status_value:
        invoice.status = status_value
        invoice.save(update_fields=["status", "updated_at"])
    return invoice


def create_billing_handoff(*, visit: Visit, user, data: dict) -> BillingHandoff:
    if user.role != "DOCTOR":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    if visit.doctor_id != user.id:
        raise BillingRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)
    if visit.status != Visit.Status.COMPLETED:
        raise _invalid_transition("Billing handoff can only be created for completed visits.")

    suggested_amount = data.get("suggested_amount")
    currency = data.get("currency")
    if suggested_amount in ("", None):
        suggested_amount = None
    else:
        suggested_amount = _validate_positive_amount(suggested_amount, "suggested_amount")
        currency = _validate_currency(currency)

    if suggested_amount is None:
        if currency in ("", None):
            currency = None
        else:
            raise _validation({"currency": ["Currency requires suggested_amount."]})

    with transaction.atomic():
        if BillingHandoff.objects.select_for_update().filter(visit=visit, status=BillingHandoff.Status.PENDING).exists():
            raise _invalid_transition("A pending billing handoff already exists for this visit.")
        try:
            handoff = BillingHandoff.objects.create(
                patient=visit.patient,
                visit=visit,
                doctor=visit.doctor,
                note=data.get("note", ""),
                suggested_amount=suggested_amount,
                currency=currency,
                status=BillingHandoff.Status.PENDING,
                created_by=user,
                updated_by=user,
            )
        except IntegrityError as exc:
            raise _invalid_transition("A pending billing handoff already exists for this visit.") from exc
        return handoff


def dismiss_handoff(*, handoff: BillingHandoff, user, data: dict | None = None) -> BillingHandoff:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        handoff = BillingHandoff.objects.select_for_update().get(pk=handoff.pk)
        if handoff.status != BillingHandoff.Status.PENDING:
            raise _invalid_transition("Only pending billing handoffs can be dismissed.")
        handoff.status = BillingHandoff.Status.DISMISSED
        handoff.dismissed_reason = (data or {}).get("dismissed_reason", "")
        handoff.updated_by = user
        handoff.save(update_fields=["status", "dismissed_reason", "updated_by", "updated_at"])
        return handoff


def convert_handoff_to_invoice(*, handoff: BillingHandoff, user, data: dict) -> Invoice:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        handoff = BillingHandoff.objects.select_for_update().select_related("patient", "visit", "visit__appointment").get(pk=handoff.pk)
        if handoff.status == BillingHandoff.Status.CONVERTED_TO_INVOICE or handoff.converted_invoice_id:
            raise BillingRuleError(
                "BILLING_HANDOFF_ALREADY_CONVERTED",
                "Billing handoff has already been converted to an invoice.",
                status_code=status.HTTP_409_CONFLICT,
            )
        if handoff.status != BillingHandoff.Status.PENDING:
            raise _invalid_transition("Only pending billing handoffs can be converted.")

        total_amount = data.get("total_amount")
        if total_amount in ("", None):
            if handoff.suggested_amount is None:
                raise _validation({"total_amount": ["This field is required."]})
            total_amount = handoff.suggested_amount
        else:
            total_amount = _validate_positive_amount(total_amount, "total_amount")

        currency = data.get("currency") or handoff.currency
        currency = _validate_currency(currency)

        invoice = _create_invoice_with_sequence(
            patient=handoff.patient,
            appointment=handoff.visit.appointment,
            visit=handoff.visit,
            billing_handoff=handoff,
            created_by=user,
            currency=currency,
            total_amount=total_amount,
            notes=data.get("notes", ""),
            status=Invoice.Status.UNPAID,
        )
        handoff.status = BillingHandoff.Status.CONVERTED_TO_INVOICE
        handoff.converted_invoice = invoice
        handoff.updated_by = user
        handoff.save(update_fields=["status", "converted_invoice", "updated_by", "updated_at"])
        return invoice


def create_invoice_from_doctor_final_charge(*, visit: Visit, user, data: dict) -> Invoice:
    """Create the official invoice as one transaction; pending handoffs are legacy-only."""
    if user.role != "DOCTOR":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

    total_amount = _validate_positive_amount(data.get("total_amount"), "total_amount")
    currency = _validate_currency(data.get("currency"))
    with transaction.atomic():
        locked_visit = Visit.objects.select_for_update().select_related("patient", "appointment", "doctor").get(pk=visit.pk)
        if locked_visit.doctor_id != user.id:
            raise BillingRuleError("NOT_FOUND", "Visit was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if locked_visit.status != Visit.Status.COMPLETED:
            raise BillingRuleError("VISIT_NOT_COMPLETED", "Final charges can only be submitted for completed visits.", status_code=status.HTTP_409_CONFLICT)

        existing_invoice = Invoice.objects.select_for_update().filter(visit=locked_visit).first()
        if existing_invoice:
            raise BillingRuleError(
                "INVOICE_ALREADY_EXISTS",
                "An invoice already exists for this visit.",
                {"invoice_id": existing_invoice.id},
                status_code=status.HTTP_409_CONFLICT,
            )

        handoff = BillingHandoff.objects.select_for_update().filter(visit=locked_visit).first()
        if handoff and handoff.converted_invoice_id:
            raise BillingRuleError("INVOICE_ALREADY_EXISTS", "An invoice already exists for this visit.", {"invoice_id": handoff.converted_invoice_id}, status_code=status.HTTP_409_CONFLICT)
        if handoff and handoff.status == BillingHandoff.Status.PENDING:
            # A historical pending record cannot become part of a new normal workflow.
            raise BillingRuleError("LEGACY_PENDING_HANDOFF_EXISTS", "This visit has a legacy billing handoff that must be handled through the legacy workflow.", status_code=status.HTTP_409_CONFLICT)
        if handoff is None:
            handoff = BillingHandoff.objects.create(
                patient=locked_visit.patient,
                visit=locked_visit,
                doctor=locked_visit.doctor,
                note=data.get("notes", ""),
                suggested_amount=total_amount,
                currency=currency,
                status=BillingHandoff.Status.CONVERTED_TO_INVOICE,
                created_by=user,
                updated_by=user,
            )

        invoice = _create_invoice_with_sequence(
            patient=locked_visit.patient,
            appointment=locked_visit.appointment,
            visit=locked_visit,
            billing_handoff=handoff,
            created_by=user,
            currency=currency,
            total_amount=total_amount,
            notes=data.get("notes", ""),
            status=Invoice.Status.UNPAID,
        )
        handoff.status = BillingHandoff.Status.CONVERTED_TO_INVOICE
        handoff.converted_invoice = invoice
        handoff.updated_by = user
        handoff.save(update_fields=["status", "converted_invoice", "updated_by", "updated_at"])
        return invoice


def _validate_invoice_relationships(*, patient, visit=None, appointment=None):
    details = {}
    if visit is not None and visit.patient_id != patient.id:
        details["visit_id"] = ["Visit must belong to patient."]
    if appointment is not None and appointment.patient_id != patient.id:
        details["appointment_id"] = ["Appointment must belong to patient."]
    if visit is not None and appointment is not None and visit.appointment_id != appointment.id:
        details["appointment_id"] = ["Appointment must match visit."]
    if details:
        raise _validation(details)


def _related_id(value) -> int | None:
    return value.id if value is not None else None


def _immutable_invoice_update(field_names: list[str], *, after_payment: bool = False) -> BillingRuleError:
    if after_payment:
        message = "Invoice fields cannot be changed after payments exist."
    else:
        message = "Invoice fields are locked after billing handoff conversion."
    return BillingRuleError(
        "INVALID_STATUS_TRANSITION",
        message,
        {field: ["This field is immutable."] for field in field_names},
        status_code=status.HTTP_409_CONFLICT,
    )


def create_invoice(*, user, data: dict) -> Invoice:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

    patient = data.get("patient")
    if patient is None:
        raise _validation({"patient_id": ["This field is required."]})
    total_amount = _validate_positive_amount(data.get("total_amount"), "total_amount")
    currency = _validate_currency(data.get("currency"))
    visit = data.get("visit")
    appointment = data.get("appointment")
    _validate_invoice_relationships(patient=patient, visit=visit, appointment=appointment)

    with transaction.atomic():
        invoice = _create_invoice_with_sequence(
            patient=patient,
            appointment=appointment,
            visit=visit,
            created_by=user,
            currency=currency,
            total_amount=total_amount,
            notes=data.get("notes", ""),
            status=Invoice.Status.UNPAID,
        )
        return invoice


def update_invoice(*, invoice: Invoice, user, data: dict) -> Invoice:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == Invoice.Status.CANCELLED:
            raise BillingRuleError("INVOICE_CANCELLED", "Cancelled invoice is locked.", status_code=status.HTTP_409_CONFLICT)

        has_payments = Payment.objects.select_for_update().filter(invoice=invoice).exists()
        relation_fields = {
            "patient": "patient_id",
            "visit": "visit_id",
            "appointment": "appointment_id",
        }
        changed_relation_fields = [
            request_field
            for data_field, request_field in relation_fields.items()
            if data_field in data and _related_id(data[data_field]) != getattr(invoice, f"{data_field}_id")
        ]

        if invoice.billing_handoff_id and changed_relation_fields:
            raise _immutable_invoice_update(changed_relation_fields)

        payment_locked_fields = []
        if has_payments:
            for data_field, request_field in relation_fields.items():
                if data_field in data and _related_id(data[data_field]) != getattr(invoice, f"{data_field}_id"):
                    payment_locked_fields.append(request_field)
            if "currency" in data and data["currency"] != invoice.currency:
                payment_locked_fields.append("currency")
            if "total_amount" in data and _validate_positive_amount(data["total_amount"], "total_amount") != invoice.total_amount:
                payment_locked_fields.append("total_amount")
            if invoice.billing_handoff_id and "notes" in data and data["notes"] != invoice.notes:
                payment_locked_fields.append("notes")
        if payment_locked_fields:
            raise _immutable_invoice_update(payment_locked_fields, after_payment=True)

        if "patient" in data or "visit" in data or "appointment" in data:
            patient = data.get("patient", invoice.patient)
            visit = data.get("visit", invoice.visit)
            appointment = data.get("appointment", invoice.appointment)
            _validate_invoice_relationships(patient=patient, visit=visit, appointment=appointment)
            invoice.patient = patient
            invoice.visit = visit
            invoice.appointment = appointment

        if "total_amount" in data:
            invoice.total_amount = _validate_positive_amount(data["total_amount"], "total_amount")
        if "currency" in data:
            invoice.currency = _validate_currency(data["currency"])
        if "notes" in data:
            invoice.notes = data["notes"]

        invoice.save()
        refresh_invoice_payment_status(invoice)
        return invoice


def cancel_invoice(*, invoice: Invoice, user, data: dict | None = None) -> Invoice:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == Invoice.Status.CANCELLED:
            raise _invalid_transition("Invoice is already cancelled.")
        refresh_invoice_payment_status(invoice)
        if invoice.status == Invoice.Status.PAID:
            raise _invalid_transition("Paid invoices cannot be cancelled.")
        invoice.status = Invoice.Status.CANCELLED
        invoice.cancelled_at = timezone.now()
        invoice.cancelled_reason = (data or {}).get("cancelled_reason", "")
        invoice.save(update_fields=["status", "cancelled_at", "cancelled_reason", "updated_at"])
        return invoice


def record_payment(*, invoice: Invoice, user, data: dict) -> Payment:
    if user.role != "STAFF":
        raise BillingRuleError("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

    amount = _validate_positive_amount(data.get("amount"), "amount")
    currency = _validate_currency(data.get("currency"))

    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == Invoice.Status.CANCELLED:
            raise BillingRuleError("INVOICE_CANCELLED", "Cancelled invoice cannot receive payments.", status_code=status.HTTP_409_CONFLICT)
        if currency != invoice.currency:
            raise BillingRuleError(
                "PAYMENT_CURRENCY_MISMATCH",
                "Payment currency must match invoice currency.",
                {"currency": ["Payment currency must match invoice currency."]},
            )
        paid_amount = calculate_paid_amount(invoice)
        if paid_amount + amount > invoice.total_amount:
            raise BillingRuleError(
                "OVERPAYMENT_NOT_ALLOWED",
                "Payment amount exceeds invoice remaining amount.",
                {"amount": ["Payment amount exceeds invoice remaining amount."]},
            )
        payment = Payment.objects.create(
            invoice=invoice,
            amount=amount,
            currency=currency,
            payment_date=data.get("payment_date") or timezone.now(),
            notes=data.get("notes", ""),
            created_by=user,
        )
        refresh_invoice_payment_status(invoice)
        return payment


def invoice_print_data(invoice: Invoice) -> dict:
    from apps.billing.serializers import PaymentSerializer
    from apps.clinic.models import ClinicSettings

    clinic = ClinicSettings.get_solo()
    paid_amount = calculate_paid_amount(invoice)
    remaining_amount = invoice.total_amount - paid_amount
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
            "created_at": invoice.created_at,
        },
        "patient": {
            "id": invoice.patient_id,
            "full_name": invoice.patient.full_name,
            "phone_number": invoice.patient.phone_number,
        },
        "visit": {
            "id": invoice.visit_id,
            "status": invoice.visit.status,
            "started_at": invoice.visit.started_at,
            "completed_at": invoice.visit.completed_at,
        }
        if invoice.visit_id
        else None,
        "appointment": {
            "id": invoice.appointment_id,
            "start_datetime": invoice.appointment.start_datetime,
            "end_datetime": invoice.appointment.end_datetime,
            "status": invoice.appointment.status,
        }
        if invoice.appointment_id
        else None,
        "currency": invoice.currency,
        "total_amount": invoice.total_amount,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount if remaining_amount > Decimal("0.00") else Decimal("0.00"),
        "status": invoice.status,
        "payments": PaymentSerializer(invoice.payments.all(), many=True).data,
        "notes": invoice.notes,
        "created_at": invoice.created_at,
    }
