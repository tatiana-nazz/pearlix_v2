from rest_framework import serializers
from django.core.exceptions import ValidationError

from apps.clinic.models import ClinicSettings


class ClinicSettingsSerializer(serializers.ModelSerializer):
    confirm_appointment_impact = serializers.BooleanField(
        required=False,
        default=False,
        write_only=True,
    )

    class Meta:
        model = ClinicSettings
        fields = (
            "clinic_name",
            "address",
            "phone",
            "email",
            "timezone",
            "capacity_per_slot",
            "default_appointment_duration_minutes",
            "allowed_durations_minutes",
            "weekly_closed_days",
            "default_currency",
            "supported_currencies",
            "default_language",
            "ai_mode",
            "confirm_appointment_impact",
        )

    def validate(self, attrs):
        instance = self.instance or ClinicSettings()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except ValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop("confirm_appointment_impact", None)
        return super().update(instance, validated_data)


class ClinicSafeSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicSettings
        fields = (
            "clinic_name",
            "address",
            "phone",
            "email",
            "timezone",
            "capacity_per_slot",
            "default_appointment_duration_minutes",
            "allowed_durations_minutes",
            "weekly_closed_days",
            "default_currency",
            "supported_currencies",
            "default_language",
        )
        read_only_fields = fields
