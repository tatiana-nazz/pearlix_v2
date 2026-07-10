from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


User = get_user_model()


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


class UserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    temporary_password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

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
        )
        read_only_fields = ("id", "must_change_password", "password_changed_at", "created_at", "updated_at")

    def validate(self, attrs):
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
        password = validated_data.pop("temporary_password", None) or validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_user_password(password, must_change_password=True, mark_changed=False)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context["request"].user
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
