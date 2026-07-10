from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.models import User
from apps.accounts.serializers import (
    AdminResetPasswordSerializer,
    AuthUserSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    PreferencesSerializer,
    UserManagementSerializer,
)
from apps.audit.services import log_activity
from apps.common.errors import error_payload, error_response
from apps.common.permissions import IsAdminRole


def _token_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": AuthUserSerializer(user).data,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            serializer.errors,
            status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    user = authenticate(request=request, username=email, password=password)
    if user is None:
        return error_response(
            "INVALID_CREDENTIALS",
            "Invalid email or password.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return Response(_token_payload(user))


class RefreshView(TokenRefreshView):
    pass


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return error_response(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"refresh": ["This field is required."]},
        )
    try:
        RefreshToken(refresh_token).blacklist()
    except Exception:
        return error_response("VALIDATION_ERROR", "Invalid refresh token.")
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(AuthUserSerializer(request.user).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def preferences_view(request):
    serializer = PreferencesSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(AuthUserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    user.set_user_password(serializer.validated_data["new_password"], must_change_password=False, mark_changed=True)
    user.save(update_fields=["password", "must_change_password", "password_changed_at", "updated_at"])
    log_activity(
        request=request,
        action="user_password_changed",
        entity_type="user",
        entity_id=user.id,
        metadata={"user_id": user.id},
    )
    return Response(AuthUserSerializer(user).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("id")
    serializer_class = UserManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            request=self.request,
            action="user_created",
            entity_type="user",
            entity_id=user.id,
            metadata={"created_user_role": user.role},
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_activity(
            request=self.request,
            action="user_updated",
            entity_type="user",
            entity_id=user.id,
            metadata={"updated_fields": sorted(self.request.data.keys()), "updated_user_role": user.role},
        )

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data, context={"target_user": user})
        serializer.is_valid(raise_exception=True)
        user.set_user_password(serializer.validated_data["temporary_password"], must_change_password=True, mark_changed=False)
        user.save(update_fields=["password", "must_change_password", "password_changed_at", "updated_at"])
        log_activity(
            request=request,
            action="user_password_reset",
            entity_type="user",
            entity_id=user.id,
            metadata={"target_user_role": user.role},
        )
        return Response(UserManagementSerializer(user).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        if user.id == request.user.id:
            return error_response(
                "INVALID_OPERATION",
                "Admin cannot deactivate their own account.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if user.role == User.Role.ADMIN and user.is_active:
            active_admins = User.objects.filter(role=User.Role.ADMIN, is_active=True).count()
            if active_admins <= 1:
                return error_response(
                    "INVALID_OPERATION",
                    "Cannot deactivate the last active admin.",
                    status_code=status.HTTP_409_CONFLICT,
                )
        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        log_activity(
            request=request,
            action="user_deactivated",
            entity_type="user",
            entity_id=user.id,
            metadata={"deactivated_user_role": user.role},
        )
        return Response(UserManagementSerializer(user).data)
