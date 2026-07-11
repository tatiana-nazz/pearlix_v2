from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.patients.serializers import PatientListSerializer
from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, Weekday, WorkingShift


User = get_user_model()


class DoctorListSerializer(serializers.ModelSerializer):
    doctor_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role", "is_active", "doctor_profile")
        read_only_fields = fields

    def get_doctor_profile(self, obj):
        profile = getattr(obj, "doctor_profile", None)
        return None if not profile else {"id": profile.id, "specialty": profile.specialty, "phone": profile.phone, "bio": profile.bio, "is_active": profile.is_active}


class VersionedSerializer(serializers.ModelSerializer):
    def validate_version(self, value):
        if value < 1:
            raise serializers.ValidationError("Version must be positive.")
        return value


class ClinicDefaultShiftSerializer(VersionedSerializer):
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = ClinicDefaultShift
        fields = ("id", "name", "weekday", "weekday_label", "start_time", "end_time", "is_active", "version", "created_by", "updated_by", "created_at", "updated_at")
        read_only_fields = ("id", "weekday_label", "is_active", "created_by", "updated_by", "created_at", "updated_at")

    def validate(self, attrs):
        if "name" in attrs:
            attrs["name"] = attrs["name"].strip()
        if not attrs.get("name", getattr(self.instance, "name", "")):
            raise serializers.ValidationError({"name": ["Shift name is required."]})
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": ["End time must be after start time."]})
        return attrs


class WorkingShiftSerializer(VersionedSerializer):
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=User.objects.filter(role__in=[User.Role.DOCTOR, User.Role.STAFF]), write_only=True, required=True)
    employee = UserSummarySerializer(read_only=True)
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)
    source_default_shift = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = WorkingShift
        fields = ("id", "employee_id", "employee", "name", "weekday", "weekday_label", "start_time", "end_time", "is_active", "source_default_shift", "version", "created_by", "updated_by", "created_at", "updated_at")
        read_only_fields = ("id", "employee", "weekday_label", "is_active", "source_default_shift", "created_by", "updated_by", "created_at", "updated_at")

    def validate(self, attrs):
        if "name" in attrs:
            attrs["name"] = attrs["name"].strip()
        if not attrs.get("name", getattr(self.instance, "name", "")):
            raise serializers.ValidationError({"name": ["Shift name is required."]})
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        if employee and employee.role not in {User.Role.DOCTOR, User.Role.STAFF}:
            raise serializers.ValidationError({"employee_id": ["Employee must have DOCTOR or STAFF role."]})
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": ["End time must be after start time."]})
        return attrs


class AvailabilityExceptionSerializer(VersionedSerializer):
    doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", queryset=User.objects.filter(role=User.Role.DOCTOR), required=False, allow_null=True)
    staff_id = serializers.PrimaryKeyRelatedField(source="staff", queryset=User.objects.filter(role=User.Role.STAFF), required=False, allow_null=True)
    doctor = UserSummarySerializer(read_only=True)
    staff = UserSummarySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)
    cancelled_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = AvailabilityException
        fields = ("id", "doctor_id", "staff_id", "doctor", "staff", "start_datetime", "end_datetime", "type", "reason", "is_cancelled", "cancelled_at", "cancelled_by", "version", "created_by", "updated_by", "created_at", "updated_at")
        read_only_fields = ("id", "doctor", "staff", "is_cancelled", "cancelled_at", "cancelled_by", "created_by", "updated_by", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.is_cancelled:
            raise serializers.ValidationError({"is_cancelled": ["Cancelled availability exceptions cannot be updated."]})
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        staff = attrs.get("staff", getattr(self.instance, "staff", None))
        start = attrs.get("start_datetime", getattr(self.instance, "start_datetime", None))
        end = attrs.get("end_datetime", getattr(self.instance, "end_datetime", None))
        if bool(doctor) == bool(staff):
            raise serializers.ValidationError({"target": ["Exactly one of doctor_id or staff_id must be set."]})
        if start and end and start >= end:
            raise serializers.ValidationError({"end_datetime": ["End datetime must be after start datetime."]})
        return attrs


class LegacyWorkingHoursReplaceSerializer(serializers.Serializer):
    working_hours = serializers.ListField(child=serializers.DictField())
    confirm_appointment_impact = serializers.BooleanField(required=False, default=False)

    def validate_working_hours(self, value):
        rows = []
        for item in value:
            row = {"name": item.get("name", "Existing Shift"), "weekday": item.get("weekday"), "start_time": item.get("start_time"), "end_time": item.get("end_time"), "is_active": item.get("is_active", True)}
            serializer = WorkingShiftSerializer(data={**row, "employee_id": self.context["doctor"].id})
            serializer.is_valid(raise_exception=True)
            rows.append(serializer.validated_data)
        active_by_weekday = {}
        for row in rows:
            if not row.get("is_active", True):
                continue
            for other in active_by_weekday.setdefault(row["weekday"], []):
                if row["start_time"] < other["end_time"] and row["end_time"] > other["start_time"]:
                    raise serializers.ValidationError("Active working hours cannot overlap for the same weekday.")
            active_by_weekday[row["weekday"]].append(row)
        return rows


class AppointmentListSerializer(serializers.ModelSerializer):
    patient = PatientListSerializer(read_only=True)
    doctor = UserSummarySerializer(read_only=True)
    reschedule_source_type = serializers.SerializerMethodField()
    reschedule_source_label = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ("id", "patient", "doctor", "start_datetime", "end_datetime", "duration_minutes", "reason", "status", "reschedule_source_exception", "reschedule_source_working_shift", "reschedule_source_type", "reschedule_source_label", "reschedule_previous_status", "created_at", "updated_at")
        read_only_fields = fields

    def get_reschedule_source_type(self, obj):
        if obj.reschedule_source_working_shift_id:
            return "SHIFT_CHANGE"
        if obj.reschedule_source_exception_id:
            return "LEAVE"
        return None

    def get_reschedule_source_label(self, obj):
        if obj.reschedule_source_working_shift_id:
            return obj.reschedule_source_working_shift.name
        if obj.reschedule_source_exception_id:
            return obj.reschedule_source_exception.reason or "Unavailable period"
        return None


class AppointmentDetailSerializer(AppointmentListSerializer):
    patient_id = serializers.PrimaryKeyRelatedField(source="patient", queryset=Patient.objects.all(), write_only=True, required=False)
    doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", queryset=User.objects.filter(role=User.Role.DOCTOR, is_active=True), write_only=True, required=False)
    duration_minutes = serializers.IntegerField(required=False)
    created_by = UserSummarySerializer(read_only=True)
    updated_by = UserSummarySerializer(read_only=True)

    class Meta(AppointmentListSerializer.Meta):
        fields = AppointmentListSerializer.Meta.fields + ("patient_id", "doctor_id", "notes", "created_by", "updated_by")
        read_only_fields = tuple(field for field in fields if field not in {"patient_id", "doctor_id", "start_datetime", "duration_minutes", "reason", "notes"})

    def validate(self, attrs):
        if self.instance is None:
            missing = {key: ["This field is required."] for key, source in (("patient_id", "patient"), ("doctor_id", "doctor"), ("start_datetime", "start_datetime")) if source not in attrs}
            if missing:
                raise serializers.ValidationError(missing)
        if "duration_minutes" not in attrs and self.instance is None:
            attrs["duration_minutes"] = ClinicSettings.get_solo().default_appointment_duration_minutes
        return attrs
