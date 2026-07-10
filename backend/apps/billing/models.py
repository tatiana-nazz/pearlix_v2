from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum

from apps.common.models import TimeStampedModel


class BillingHandoff(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONVERTED_TO_INVOICE = "CONVERTED_TO_INVOICE", "Converted to invoice"
        DISMISSED = "DISMISSED", "Dismissed"

    class Currency(models.TextChoices):
        SYP = "SYP", "Syrian Pound"
        USD = "USD", "US Dollar"

    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="billing_handoffs")
    visit = models.ForeignKey("visits.Visit", on_delete=models.PROTECT, related_name="billing_handoffs")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="billing_handoffs")
    note = models.TextField(blank=True)
    suggested_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, null=True, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    converted_invoice = models.OneToOneField(
        "billing.Invoice",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="converted_handoff",
    )
    dismissed_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="billing_handoffs_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="billing_handoffs_updated",
    )

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["doctor", "status"]),
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["visit"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["visit"],
                condition=Q(status="PENDING"),
                name="unique_pending_billing_handoff_per_visit",
            ),
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if self.doctor_id and self.doctor.role != "DOCTOR":
            errors["doctor"] = "Billing handoff doctor must have DOCTOR role."
        if self.visit_id:
            if self.patient_id and self.visit.patient_id != self.patient_id:
                errors["patient"] = "Billing handoff patient must match visit patient."
            if self.doctor_id and self.visit.doctor_id != self.doctor_id:
                errors["doctor"] = "Billing handoff doctor must match visit doctor."
        if self.suggested_amount is not None and self.suggested_amount <= Decimal("0"):
            errors["suggested_amount"] = "Suggested amount must be positive."
        if self.suggested_amount is not None and not self.currency:
            errors["currency"] = "Currency is required when suggested amount is set."
        if self.suggested_amount is None and self.currency:
            errors["currency"] = "Currency requires suggested amount."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"Billing handoff {self.id} for visit {self.visit_id}"


class Invoice(TimeStampedModel):
    class Status(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    class Currency(models.TextChoices):
        SYP = "SYP", "Syrian Pound"
        USD = "USD", "US Dollar"

    invoice_number = models.CharField(max_length=40, unique=True)
    patient = models.ForeignKey("patients.Patient", on_delete=models.PROTECT, related_name="invoices")
    appointment = models.ForeignKey(
        "scheduling.Appointment",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    visit = models.ForeignKey("visits.Visit", null=True, blank=True, on_delete=models.PROTECT, related_name="invoices")
    billing_handoff = models.OneToOneField(
        "billing.BillingHandoff",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="invoice",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invoices_created",
    )
    currency = models.CharField(max_length=3, choices=Currency.choices)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.UNPAID)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["invoice_number"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["visit"]),
            models.Index(fields=["appointment"]),
            models.Index(fields=["currency"]),
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if self.created_by_id and self.created_by.role != "STAFF":
            errors["created_by"] = "Invoice creator must be a STAFF user."
        if self.total_amount is not None and self.total_amount <= Decimal("0"):
            errors["total_amount"] = "Total amount must be positive."
        if self.visit_id and self.patient_id and self.visit.patient_id != self.patient_id:
            errors["visit"] = "Visit must belong to invoice patient."
        if self.appointment_id and self.patient_id and self.appointment.patient_id != self.patient_id:
            errors["appointment"] = "Appointment must belong to invoice patient."
        if self.billing_handoff_id:
            if self.patient_id and self.billing_handoff.patient_id != self.patient_id:
                errors["billing_handoff"] = "Billing handoff must belong to invoice patient."
            if self.visit_id and self.billing_handoff.visit_id != self.visit_id:
                errors["billing_handoff"] = "Billing handoff must belong to invoice visit."
        if self.status == self.Status.CANCELLED and not self.cancelled_at:
            errors["cancelled_at"] = "Cancelled invoices require cancelled_at."
        if errors:
            raise ValidationError(errors)

    @property
    def paid_amount(self) -> Decimal:
        total = self.payments.aggregate(total=Sum("amount"))["total"]
        return total or Decimal("0.00")

    @property
    def remaining_amount(self) -> Decimal:
        remaining = self.total_amount - self.paid_amount
        return remaining if remaining > Decimal("0.00") else Decimal("0.00")

    def __str__(self) -> str:
        return self.invoice_number


class InvoiceSequence(TimeStampedModel):
    scope = models.CharField(max_length=20, unique=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["scope"]),
        ]
        ordering = ["scope"]

    def __str__(self) -> str:
        return f"{self.scope}: {self.last_number}"


class Payment(TimeStampedModel):
    class Currency(models.TextChoices):
        SYP = "SYP", "Syrian Pound"
        USD = "USD", "US Dollar"

    invoice = models.ForeignKey("billing.Invoice", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    payment_date = models.DateTimeField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payments_created",
    )

    class Meta:
        indexes = [
            models.Index(fields=["invoice", "payment_date"]),
            models.Index(fields=["created_by", "created_at"]),
            models.Index(fields=["currency"]),
        ]
        ordering = ["-payment_date", "-id"]

    def clean(self):
        errors = {}
        if self.created_by_id and self.created_by.role != "STAFF":
            errors["created_by"] = "Payment creator must be a STAFF user."
        if self.amount is not None and self.amount <= Decimal("0"):
            errors["amount"] = "Payment amount must be positive."
        if self.invoice_id and self.currency and self.currency != self.invoice.currency:
            errors["currency"] = "Payment currency must match invoice currency."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"Payment {self.id} for {self.invoice_id}"
