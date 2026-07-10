from rest_framework import serializers

from apps.clinic.models import ClinicSettings


class ClinicSettingsSerializer(serializers.ModelSerializer):
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
            "default_currency",
            "supported_currencies",
            "default_language",
            "ai_mode",
            "ai_service_url",
        )

    def validate(self, attrs):
        instance = self.instance or ClinicSettings()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except Exception as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise
        return attrs


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
            "default_currency",
            "supported_currencies",
            "default_language",
        )
        read_only_fields = fields
