from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.patients.serializers import PatientListSerializer
from apps.visits.models import Visit


class VisitAppointmentSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    doctor = UserSummarySerializer(read_only=True)
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
