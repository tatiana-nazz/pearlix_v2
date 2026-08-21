from zoneinfo import ZoneInfo

from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.patients.serializers import PatientListSerializer
from apps.visits.models import Visit
from apps.visits.serializers import VisitAppointmentSummarySerializer


class BillingVisitSummarySerializer(serializers.ModelSerializer):
    appointment = VisitAppointmentSummarySerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ("id", "status", "started_at", "completed_at", "appointment")
        read_only_fields = fields


class InvoiceReceiptSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)
    patient = PatientListSerializer(source="billing_handoff.patient", read_only=True)
    billing_handoff_id = serializers.IntegerField(read_only=True)
    currency = serializers.CharField(source="billing_handoff.currency", read_only=True)
    description = serializers.CharField(source="billing_handoff.description", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "invoice_number",
            "billing_handoff_id",
            "patient",
            "description",
            "amount",
            "currency",
            "issued_at",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingHandoffSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    visit = BillingVisitSummarySerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    invoice_count = serializers.IntegerField(read_only=True)
    invoices = InvoiceReceiptSerializer(many=True, read_only=True)

    class Meta:
        model = BillingHandoff
        fields = (
            "id",
            "patient",
            "visit",
            "doctor",
            "description",
            "total_amount",
            "paid_amount",
            "remaining_amount",
            "invoice_count",
            "currency",
            "note",
            "status",
            "origin",
            "legacy_reference",
            "cancelled_at",
            "cancelled_reason",
            "invoices",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ClinicDateTimeField(serializers.DateTimeField):
    def default_timezone(self):
        return ZoneInfo(ClinicSettings.get_solo().timezone)


class InvoiceIssueSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    issued_at = ClinicDateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class HandoffInvoiceResponseSerializer(serializers.Serializer):
    invoice = InvoiceReceiptSerializer()
    handoff = BillingHandoffSerializer()


class BillingHandoffQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=BillingHandoff.Status.choices, required=False)
    currency = serializers.ChoiceField(choices=BillingHandoff.Currency.choices, required=False)
    patient_id = serializers.IntegerField(min_value=1, required=False)
    doctor_id = serializers.IntegerField(min_value=1, required=False)
    visit_id = serializers.IntegerField(min_value=1, required=False)
    search = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": ["Must be on or after date_from."]})
        return attrs


class InvoiceQuerySerializer(serializers.Serializer):
    currency = serializers.ChoiceField(choices=BillingHandoff.Currency.choices, required=False)
    patient_id = serializers.IntegerField(min_value=1, required=False)
    handoff_id = serializers.IntegerField(min_value=1, required=False)
    visit_id = serializers.IntegerField(min_value=1, required=False)
    appointment_id = serializers.IntegerField(min_value=1, required=False)
    search = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": ["Must be on or after date_from."]})
        return attrs
