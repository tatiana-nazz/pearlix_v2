from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.billing.models import Invoice
from apps.patients.serializers import PatientListSerializer
from apps.visits.models import Visit


class VisitAppointmentSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    start_datetime = serializers.DateTimeField(read_only=True)
    end_datetime = serializers.DateTimeField(read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    reason = serializers.CharField(read_only=True)


class VisitListSerializer(serializers.ModelSerializer):
    appointment = VisitAppointmentSummarySerializer(read_only=True)
    patient = PatientListSerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)

    class Meta:
        model = Visit
        fields = (
            "id",
            "appointment",
            "patient",
            "doctor",
            "status",
            "started_at",
            "completed_at",
            "symptoms",
            "diagnosis",
            "treatment",
            "clinical_notes",
            "follow_up_notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class VisitDetailSerializer(VisitListSerializer):
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta(VisitListSerializer.Meta):
        fields = VisitListSerializer.Meta.fields + ("created_by", "updated_by")
        read_only_fields = fields


class ClinicalNotesUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visit
        fields = ("symptoms", "diagnosis", "treatment", "clinical_notes", "follow_up_notes")


class VisitCompletionBillingSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=2000, trim_whitespace=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.ChoiceField(choices=Invoice.Currency.choices)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("This field is required.")
        return value.strip()

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class LegacyVisitCompletionBillingSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=2000, trim_whitespace=True)
    suggested_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.ChoiceField(choices=Invoice.Currency.choices)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("This field is required.")
        return value.strip()

    def validate_suggested_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class VisitCompletionSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    notes = ClinicalNotesUpdateSerializer()
    billing = VisitCompletionBillingSerializer(required=False)
    billing_handoff = LegacyVisitCompletionBillingSerializer(required=False, write_only=True)

    def validate(self, attrs):
        billing = attrs.get("billing")
        legacy = attrs.get("billing_handoff")
        if billing is None and legacy is None:
            raise serializers.ValidationError({"billing": ["This field is required."]})
        if billing is not None and legacy is not None:
            raise serializers.ValidationError({"billing": ["Provide billing only once."]})
        if billing is None:
            billing = {
                "description": legacy["description"],
                "total_amount": legacy["suggested_amount"],
                "currency": legacy["currency"],
                "note": legacy.get("note", ""),
            }
        attrs["billing"] = billing
        attrs.pop("billing_handoff", None)
        return attrs
