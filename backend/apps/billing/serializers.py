from __future__ import annotations

from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.patients.models import Patient
from apps.patients.serializers import PatientListSerializer
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.visits.serializers import VisitAppointmentSummarySerializer


class BillingVisitSummarySerializer(serializers.ModelSerializer):
    appointment = VisitAppointmentSummarySerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ("id", "status", "started_at", "completed_at", "appointment")
        read_only_fields = fields


class InvoiceSummarySerializer(serializers.ModelSerializer):
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "invoice_number",
            "description",
            "origin",
            "currency",
            "total_amount",
            "paid_amount",
            "remaining_amount",
            "status",
        )
        read_only_fields = fields


class BillingHandoffSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    visit = BillingVisitSummarySerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)
    converted_invoice = InvoiceSummarySerializer(read_only=True)

    class Meta:
        model = BillingHandoff
        fields = (
            "id",
            "patient",
            "visit",
            "doctor",
            "description",
            "note",
            "suggested_amount",
            "currency",
            "status",
            "converted_invoice",
            "dismissed_reason",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingHandoffCreateSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True)
    suggested_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    currency = serializers.ChoiceField(choices=BillingHandoff.Currency.choices, required=False, allow_null=True, allow_blank=True)

    def validate(self, attrs):
        suggested_amount = attrs.get("suggested_amount")
        currency = attrs.get("currency")
        if suggested_amount is not None and suggested_amount <= 0:
            raise serializers.ValidationError({"suggested_amount": ["Suggested amount must be positive."]})
        if suggested_amount is not None and not currency:
            raise serializers.ValidationError({"currency": ["This field is required when suggested_amount is set."]})
        if suggested_amount is None and currency:
            raise serializers.ValidationError({"currency": ["Currency requires suggested_amount."]})
        return attrs


class HandoffConversionSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    currency = serializers.ChoiceField(choices=Invoice.Currency.choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Total amount must be positive.")
        return value


class AppointmentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ("id", "start_datetime", "end_datetime", "duration_minutes", "status", "reason")
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = Payment
        fields = ("id", "invoice", "amount", "currency", "payment_date", "notes", "created_by", "created_at", "updated_at")
        read_only_fields = fields


class PaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.ChoiceField(choices=Payment.Currency.choices)
    payment_date = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive.")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    appointment = AppointmentSummarySerializer(read_only=True)
    visit = BillingVisitSummarySerializer(read_only=True)
    billing_handoff = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payment_count = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "invoice_number",
            "patient",
            "appointment",
            "visit",
            "billing_handoff",
            "created_by",
            "origin",
            "description",
            "currency",
            "total_amount",
            "paid_amount",
            "remaining_amount",
            "payment_count",
            "notes",
            "status",
            "cancelled_at",
            "cancelled_reason",
            "payments",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_payment_count(self, obj):
        return obj.payments.count()


class InvoiceCreateUpdateSerializer(serializers.Serializer):
    patient_id = serializers.PrimaryKeyRelatedField(source="patient", queryset=Patient.objects.all(), required=False)
    visit_id = serializers.PrimaryKeyRelatedField(source="visit", queryset=Visit.objects.all(), required=False, allow_null=True)
    appointment_id = serializers.PrimaryKeyRelatedField(
        source="appointment",
        queryset=Appointment.objects.all(),
        required=False,
        allow_null=True,
    )
    description = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    currency = serializers.ChoiceField(choices=Invoice.Currency.choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Total amount must be positive.")
        return value


class InvoicePaymentResponseSerializer(serializers.Serializer):
    payment = PaymentSerializer()
    invoice = InvoiceSummarySerializer()


class InvoiceQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Invoice.Status.choices, required=False)
    currency = serializers.ChoiceField(choices=Invoice.Currency.choices, required=False)
    patient_id = serializers.IntegerField(min_value=1, required=False)
    visit_id = serializers.IntegerField(min_value=1, required=False)
    appointment_id = serializers.IntegerField(min_value=1, required=False)
    search = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    created_from = serializers.DateTimeField(required=False)
    created_to = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")
        if date_from and date_to and date_from > date_to:
            raise serializers.ValidationError({"date_to": ["Must be on or after date_from."]})

        created_from = attrs.get("created_from")
        created_to = attrs.get("created_to")
        if created_from and created_to and created_from > created_to:
            raise serializers.ValidationError({"created_to": ["Must be on or after created_from."]})
        return attrs
