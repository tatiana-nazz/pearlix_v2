from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.patients.serializers import PatientListSerializer
from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour


User = get_user_model()


class DoctorListSerializer(serializers.ModelSerializer):
    doctor_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role", "is_active", "doctor_profile")
        read_only_fields = fields

    def get_doctor_profile(self, obj):
        profile = getattr(obj, "doctor_profile", None)
        if not profile:
            return None
        return {
            "id": profile.id,
            "specialty": profile.specialty,
            "phone": profile.phone,
            "bio": profile.bio,
            "is_active": profile.is_active,
        }


class WorkingHourSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkingHour
        fields = ("id", "weekday", "start_time", "end_time", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({"end_time": ["End time must be after start time."]})
        return attrs


class WorkingHourReplaceSerializer(serializers.Serializer):
    working_hours = WorkingHourSerializer(many=True)

    def validate_working_hours(self, value):
        active_by_weekday = {}
        for item in value:
            if not item.get("is_active", True):
                continue
            bucket = active_by_weekday.setdefault(item["weekday"], [])
            for existing in bucket:
                if item["start_time"] < existing["end_time"] and item["end_time"] > existing["start_time"]:
                    raise serializers.ValidationError("Active working hours cannot overlap for the same weekday.")
            bucket.append(item)
        return value

    def save(self, *, doctor):
        with transaction.atomic():
            WorkingHour.objects.filter(doctor=doctor).delete()
            rows = [
                WorkingHour(
                    doctor=doctor,
                    weekday=item["weekday"],
                    start_time=item["start_time"],
                    end_time=item["end_time"],
                    is_active=item.get("is_active", True),
                )
                for item in self.validated_data["working_hours"]
            ]
            for row in rows:
                row.full_clean()
            WorkingHour.objects.bulk_create(rows)
        return WorkingHour.objects.filter(doctor=doctor)


class AvailabilityExceptionSerializer(serializers.ModelSerializer):
    doctor_id = serializers.PrimaryKeyRelatedField(
        source="doctor",
        queryset=User.objects.filter(role=User.Role.DOCTOR),
        required=False,
        allow_null=True,
    )
    staff_id = serializers.PrimaryKeyRelatedField(
        source="staff",
        queryset=User.objects.filter(role=User.Role.STAFF),
        required=False,
        allow_null=True,
    )
    doctor = UserSummarySerializer(read_only=True)
    staff = UserSummarySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)
    cancelled_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = AvailabilityException
        fields = (
            "id",
            "doctor_id",
            "staff_id",
            "doctor",
            "staff",
            "start_datetime",
            "end_datetime",
            "type",
            "reason",
            "is_cancelled",
            "cancelled_at",
            "cancelled_by",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "doctor",
            "staff",
            "is_cancelled",
            "cancelled_at",
            "cancelled_by",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        if self.instance and self.instance.is_cancelled:
            raise serializers.ValidationError({"is_cancelled": ["Cancelled availability exceptions cannot be updated."]})
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        staff = attrs.get("staff", getattr(self.instance, "staff", None))
        start_datetime = attrs.get("start_datetime", getattr(self.instance, "start_datetime", None))
        end_datetime = attrs.get("end_datetime", getattr(self.instance, "end_datetime", None))
        if bool(doctor) == bool(staff):
            raise serializers.ValidationError({"target": ["Exactly one of doctor_id or staff_id must be set."]})
        if start_datetime and end_datetime and start_datetime >= end_datetime:
            raise serializers.ValidationError({"end_datetime": ["End datetime must be after start datetime."]})
        return attrs


class AppointmentListSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = (
            "id",
            "patient",
            "doctor",
            "start_datetime",
            "end_datetime",
            "duration_minutes",
            "reason",
            "status",
            "reschedule_source_exception",
            "reschedule_previous_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class AppointmentDetailSerializer(serializers.ModelSerializer):
    patient_id = serializers.PrimaryKeyRelatedField(source="patient", queryset=Patient.objects.all(), write_only=True, required=False)
    doctor_id = serializers.PrimaryKeyRelatedField(
        source="doctor",
        queryset=User.objects.filter(role=User.Role.DOCTOR, is_active=True),
        write_only=True,
        required=False,
    )
    duration_minutes = serializers.IntegerField(required=False)
    patient = PatientListSerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = (
            "id",
            "patient_id",
            "doctor_id",
            "patient",
            "doctor",
            "start_datetime",
            "end_datetime",
            "duration_minutes",
            "reason",
            "notes",
            "status",
            "reschedule_source_exception",
            "reschedule_previous_status",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "patient",
            "doctor",
            "end_datetime",
            "status",
            "reschedule_source_exception",
            "reschedule_previous_status",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        if self.instance is None:
            missing = {}
            if "patient" not in attrs:
                missing["patient_id"] = ["This field is required."]
            if "doctor" not in attrs:
                missing["doctor_id"] = ["This field is required."]
            if "start_datetime" not in attrs:
                missing["start_datetime"] = ["This field is required."]
            if missing:
                raise serializers.ValidationError(missing)

        if "duration_minutes" not in attrs and self.instance is None:
            attrs["duration_minutes"] = ClinicSettings.get_solo().default_appointment_duration_minutes
        return attrs
