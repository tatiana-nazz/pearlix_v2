from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import DoctorProfile, StaffProfile
from apps.accounts.team_services import profile_state

User = get_user_model()


class StrictInputSerializer(serializers.Serializer):
    """Reject backend-controlled and misspelled input rather than ignoring it."""

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: ["This field is not allowed."] for field in sorted(unknown)})
        return super().to_internal_value(data)


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "theme_preference",
            "language_preference",
        )
        read_only_fields = fields


class AuthUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "theme_preference",
            "language_preference",
            "must_change_password",
            "password_changed_at",
        )
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("theme_preference", "language_preference")

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        # Never let a request-scoped User snapshot rewrite credentials,
        # authority, activity, or version changed by a concurrent lifecycle
        # transaction.
        instance.save(update_fields=[*validated_data.keys(), "updated_at"])
        return instance


class UserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    temporary_password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    linked_profile_state = serializers.SerializerMethodField()
    team_member_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "theme_preference",
            "language_preference",
            "must_change_password",
            "password_changed_at",
            "password",
            "temporary_password",
            "created_at",
            "updated_at",
            "version",
            "linked_profile_state",
            "team_member_id",
        )
        read_only_fields = ("id", "must_change_password", "password_changed_at", "created_at", "updated_at", "version", "linked_profile_state", "team_member_id")

    def get_linked_profile_state(self, obj):
        return profile_state(obj)

    def get_team_member_id(self, obj):
        return obj.id if profile_state(obj) in {"DOCTOR", "STAFF"} else None

    def validate(self, attrs):
        if self.instance is None and attrs.get("role") in {User.Role.DOCTOR, User.Role.STAFF}:
            raise serializers.ValidationError({"role": ["Use /api/team-members/ to create Doctor or Staff accounts with a professional profile."]})
        if self.instance is not None:
            if "role" in attrs:
                raise serializers.ValidationError({"role": ["Use the transition-role action for professional role changes."]})
            if "is_active" in attrs:
                raise serializers.ValidationError({"is_active": ["Use the deactivate or reactivate action."]})
            password_fields = {
                field: ["Use the reset-password action."]
                for field in ("password", "temporary_password")
                if field in attrs
            }
            if password_fields:
                raise serializers.ValidationError(password_fields)
        password = attrs.get("temporary_password") or attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": ["This field is required."]})
        if password:
            user = self.instance or User(
                email=attrs.get("email", ""),
                full_name=attrs.get("full_name", ""),
                role=attrs.get("role", User.Role.STAFF),
            )
            self._validate_password(password, user=user)
        return attrs

    def _validate_password(self, password, *, user):
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

    def create(self, validated_data):
        password = validated_data.pop("temporary_password", None) or validated_data.pop("password")
        validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_user_password(password, must_change_password=True, mark_changed=False)
        user.save()
        return user

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        # Benign management writes are deliberately column-limited.  The
        # request's User instance can predate a concurrent lifecycle mutation
        # and must never write stale authority columns back.
        instance.save(update_fields=[*validated_data.keys(), "updated_at"])
        return instance


class TeamAccountSerializer(StrictInputSerializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    temporary_password = serializers.CharField(trim_whitespace=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate(self, attrs):
        try:
            validate_password(attrs["temporary_password"], user=User(email=attrs.get("email", ""), full_name=attrs.get("full_name", "")))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"temporary_password": list(exc.messages)}) from exc
        return attrs


class DoctorProfileInputSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: ["This field is not allowed."] for field in sorted(unknown)})
        return super().to_internal_value(data)

    class Meta:
        model = DoctorProfile
        fields = ("specialty", "phone", "bio")


class StaffProfileInputSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: ["This field is not allowed."] for field in sorted(unknown)})
        return super().to_internal_value(data)

    class Meta:
        model = StaffProfile
        fields = ("position", "phone")


class TeamMemberCreateSerializer(StrictInputSerializer):
    account = TeamAccountSerializer()
    role = serializers.ChoiceField(choices=[User.Role.DOCTOR, User.Role.STAFF])
    doctor_profile = DoctorProfileInputSerializer(required=False)
    staff_profile = StaffProfileInputSerializer(required=False)

    def validate(self, attrs):
        doctor, staff = attrs.get("doctor_profile"), attrs.get("staff_profile")
        if bool(doctor) == bool(staff):
            raise serializers.ValidationError({"profile": ["Provide exactly one matching professional profile."]})
        if attrs["role"] == User.Role.DOCTOR and not doctor:
            raise serializers.ValidationError({"doctor_profile": ["This field is required for a Doctor."]})
        if attrs["role"] == User.Role.STAFF and not staff:
            raise serializers.ValidationError({"staff_profile": ["This field is required for Staff."]})
        return attrs


class TeamMemberUpdateSerializer(StrictInputSerializer):
    version = serializers.IntegerField(required=True, min_value=1)
    specialty = serializers.CharField(max_length=255, required=False)
    phone = serializers.CharField(max_length=50, required=False)
    bio = serializers.CharField(required=False, allow_blank=True)
    position = serializers.CharField(max_length=255, required=False)

    def validate(self, attrs):
        user = self.context["user"]
        allowed = {"version", "specialty", "phone", "bio"} if user.role == User.Role.DOCTOR else {"version", "position", "phone"}
        invalid = sorted(set(self.initial_data) - allowed)
        if invalid:
            raise serializers.ValidationError({field: ["This professional field is not supported for this team member."] for field in invalid})
        if not (set(attrs) - {"version"}):
            raise serializers.ValidationError({"non_field_errors": ["At least one professional field is required."]})
        return attrs


class ProfessionalStatusSerializer(StrictInputSerializer):
    is_active = serializers.BooleanField()
    version = serializers.IntegerField(required=True, min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class RoleTransitionSerializer(StrictInputSerializer):
    target_role = serializers.ChoiceField(choices=User.Role.choices)
    mode = serializers.ChoiceField(choices=["PREVIEW", "CONFIRM"])
    confirmation_token = serializers.CharField(required=False, write_only=True)
    profile = serializers.DictField(required=False, default=dict, write_only=True)
    version = serializers.IntegerField(required=False, min_value=1, write_only=True)

    def validate(self, attrs):
        if attrs["mode"] == "CONFIRM":
            missing = {key: ["This field is required."] for key in ("confirmation_token", "version") if key not in attrs}
            if missing:
                raise serializers.ValidationError(missing)
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def _user(self):
        return self.context.get("user", self.context["request"].user)

    def validate_current_password(self, value):
        user = self._user()
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self._user()
        if user.check_password(value):
            raise serializers.ValidationError("New password must be different from the current password.")
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class AdminResetPasswordSerializer(serializers.Serializer):
    temporary_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_temporary_password(self, value):
        user = self.context["target_user"]
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value
