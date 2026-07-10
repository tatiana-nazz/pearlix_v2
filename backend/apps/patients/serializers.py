from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.patients.models import Patient
from apps.patients.selectors import ARCHIVE_BLOCKING_APPOINTMENT_STATUSES, patient_has_archive_blocking_appointments


class PatientListSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    last_visit_with_me_at = serializers.DateTimeField(read_only=True, required=False)

    class Meta:
        model = Patient
        fields = (
            "id",
            "full_name",
            "phone",
            "gender",
            "birth_date",
            "age",
            "is_archived",
            "last_visit_with_me_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "age", "created_at", "updated_at")


class PatientDetailSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = Patient
        fields = (
            "id",
            "full_name",
            "phone",
            "gender",
            "birth_date",
            "age",
            "address",
            "medical_summary",
            "general_notes",
            "is_archived",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = ("id", "age", "created_at", "updated_at", "created_by", "updated_by")

    def validate_full_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Full name is required.")
        return value.strip()

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Phone is required.")
        return value.strip()

    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Birth date cannot be in the future.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "is_archived" not in attrs:
            return attrs

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or user.role != "STAFF":
            raise serializers.ValidationError({"is_archived": ["You do not have permission to archive patients."]})

        is_archived = attrs["is_archived"]
        if self.instance and is_archived and not self.instance.is_archived and patient_has_archive_blocking_appointments(self.instance):
            blocked = ", ".join(ARCHIVE_BLOCKING_APPOINTMENT_STATUSES)
            raise serializers.ValidationError(
                {"is_archived": [f"Patient cannot be archived while appointments are in these statuses: {blocked}."]}
            )
        return attrs
