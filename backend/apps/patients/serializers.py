from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.patients.models import Patient


class PatientListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    last_visit_with_me_at = serializers.DateTimeField(read_only=True, required=False)
    last_visit_at = serializers.DateTimeField(read_only=True, required=False)
    next_appointment_at = serializers.DateTimeField(read_only=True, required=False)

    class Meta:
        model = Patient
        fields = (
            "id",
            "first_name",
            "last_name",
            "full_name",
            "gender",
            "date_of_birth",
            "age",
            "phone_number",
            "email",
            "national_id_or_passport",
            "blood_group",
            "is_archived",
            "version",
            "last_visit_with_me_at",
            "last_visit_at",
            "next_appointment_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "full_name",
            "age",
            "is_archived",
            "version",
            "created_at",
            "updated_at",
            "last_visit_with_me_at",
            "last_visit_at",
            "next_appointment_at",
        )


class PatientDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = Patient
        fields = (
            "id",
            "first_name",
            "last_name",
            "full_name",
            "gender",
            "date_of_birth",
            "age",
            "phone_number",
            "email",
            "national_id_or_passport",
            "address",
            "emergency_contact",
            "blood_group",
            "medical_conditions_history",
            "insurance_info",
            "general_notes",
            "is_archived",
            "version",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = ("id", "full_name", "age", "is_archived", "created_at", "updated_at", "created_by", "updated_by")

    def validate_first_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("First name is required.")
        return value.strip()

    def validate_last_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Last name is required.")
        return value.strip()

    def validate_phone_number(self, value):
        return value.strip()

    def validate_email(self, value):
        return value.strip()

    def validate_national_id_or_passport(self, value):
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        queryset = Patient.objects.filter(national_id_or_passport=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A patient with this national ID or passport already exists.")
        return normalized

    def validate_date_of_birth(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        initial_data = getattr(self, "initial_data", {})

        if self.instance is None:
            forbidden_create_fields = {"full_name", "age", "is_archived", "version", "created_at", "updated_at", "created_by", "updated_by"}
            forbidden_supplied = sorted(field for field in forbidden_create_fields if field in initial_data)
            if forbidden_supplied:
                raise serializers.ValidationError({field: ["This field is read-only."] for field in forbidden_supplied})
            if not attrs.get("first_name", "").strip():
                raise serializers.ValidationError({"first_name": ["First name is required."]})
            if not attrs.get("last_name", "").strip():
                raise serializers.ValidationError({"last_name": ["Last name is required."]})
            if "gender" not in attrs:
                raise serializers.ValidationError({"gender": ["Gender is required."]})
            return attrs

        if "is_archived" in initial_data:
            raise serializers.ValidationError({"is_archived": ["Use the archive or unarchive action instead."]})

        first_name = attrs.get("first_name", self.instance.first_name)
        last_name = attrs.get("last_name", self.instance.last_name)
        if not first_name or not first_name.strip():
            raise serializers.ValidationError({"first_name": ["First name is required."]})
        if not last_name or not last_name.strip():
            raise serializers.ValidationError({"last_name": ["Last name is required."]})
        return attrs
