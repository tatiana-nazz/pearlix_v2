from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.authentication import (
    ACCOUNT_VERSION_CLAIM,
    AccountAuthorityChanged,
    AccountVersionTokenRefreshSerializer,
)
from apps.accounts.models import User
from apps.accounts.serializers import (
    AdminResetPasswordSerializer,
    AuthUserSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    PreferencesSerializer,
    ProfessionalStatusSerializer,
    RoleTransitionSerializer,
    TeamMemberCreateSerializer,
    TeamMemberUpdateSerializer,
    UserManagementSerializer,
)
from apps.accounts.team_services import (
    TeamRuleError,
    availability_summary,
    clinic_today_window,
    confirm_transition,
    create_team_member,
    linked_profile,
    profile_state,
    reactivate_user,
    set_professional_status,
    transition_preview,
    update_team_profile,
    user_account_summary,
)
from apps.audit.services import log_activity
from apps.common.errors import error_payload, error_response
from apps.common.permissions import IsAdminOrStaffReadOnlyTeam, IsAdminRole
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.visits.models import Visit


def _token_payload(user):
    refresh = RefreshToken.for_user(user)
    refresh[ACCOUNT_VERSION_CLAIM] = user.version
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
    if User.objects.filter(email__iexact=email, is_active=False).exists():
        return error_response(
            "ACCOUNT_DISABLED",
            "This account is disabled.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    user = authenticate(request=request, username=email, password=password)
    if user is None:
        return error_response(
            "INVALID_CREDENTIALS",
            "Invalid email or password.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return Response(_token_payload(user))


class RefreshView(TokenRefreshView):
    serializer_class = AccountVersionTokenRefreshSerializer


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
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if (
            request.auth is not None
            and request.auth.get(ACCOUNT_VERSION_CLAIM) != user.version
        ):
            raise AccountAuthorityChanged()
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request, "user": user},
        )
        serializer.is_valid(raise_exception=True)
        user.set_user_password(
            serializer.validated_data["new_password"],
            must_change_password=False,
            mark_changed=True,
        )
        user.version += 1
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "password_changed_at",
                "version",
                "updated_at",
            ]
        )
        log_activity(
            request=request,
            action="user_password_changed",
            entity_type="user",
            entity_id=user.id,
            metadata={"user_id": user.id},
        )
        token_payload = _token_payload(user)
    return Response(token_payload)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("doctor_profile", "staff_profile").order_by("id")
    serializer_class = UserManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def create(self, request, *args, **kwargs):
        if request.data.get("role") in {User.Role.DOCTOR, User.Role.STAFF}:
            return error_response("PROFILE_REQUIRED", "Use /api/team-members/ to create Doctor or Staff accounts with a professional profile.", {"role": ["Professional accounts must be onboarded through Team."]})
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if "role" in request.data and request.data["role"] != user.role:
            return error_response("PROFILE_INTEGRITY_ERROR", "Use the transition-role action for professional role changes.", {"role": ["Direct role changes are protected."]})
        return super().partial_update(request, *args, **kwargs)

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

    @action(detail=True, methods=["post"], url_path="transition-role")
    def transition_role(self, request, pk=None):
        user = self.get_object()
        serializer = RoleTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if data["mode"] == "PREVIEW":
                result = transition_preview(user=user, target_role=data["target_role"], actor=request.user)
                return Response(result)
            changed = confirm_transition(
                user_id=user.id,
                actor=request.user,
                target_role=data["target_role"],
                token=data["confirmation_token"],
                version=data["version"],
                profile=data.get("profile", {}),
            )
        except TeamRuleError as exc:
            return error_response(exc.code, exc.message, exc.details, exc.status_code)
        log_activity(request=request, action="user_role_transitioned", entity_type="user", entity_id=changed.id, metadata={"source_role": user.role, "target_role": changed.role})
        return Response(UserManagementSerializer(changed).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        try:
            user = reactivate_user(user_id=self.get_object().id)
        except TeamRuleError as exc:
            return error_response(exc.code, exc.message, exc.details, exc.status_code)
        log_activity(request=request, action="user_reactivated", entity_type="user", entity_id=user.id, metadata={"reactivated_user_role": user.role})
        return Response(UserManagementSerializer(user).data)


class TeamMemberPagination(PageNumberPagination):
    page_size = 20


def _team_profile_data(user, *, include_version=True):
    profile = linked_profile(user)
    data = {
        "professional_status": "ACTIVE" if profile.is_active else "INACTIVE",
        "specialty": profile.specialty if user.role == User.Role.DOCTOR else None,
        "position": profile.position if user.role == User.Role.STAFF else None,
        "phone": profile.phone,
    }
    if include_version:
        data["version"] = profile.version
    return data


def _team_summary(user, *, appointments=0, active_visits=0, include_account=True):
    data = {
        "id": user.id,
        "role": user.role,
        "full_name": user.full_name,
        "email": user.email,
        **_team_profile_data(user, include_version=include_account),
        "availability": availability_summary(user),
        "today_workload": {"appointment_count": appointments, "active_visit_count": active_visits},
        "schedule_summary": [
            {
                "name": shift.name,
                "weekday": shift.weekday,
                "start_time": shift.start_time.isoformat(),
                "end_time": shift.end_time.isoformat(),
            }
            for shift in getattr(user, "active_team_shifts", [])
        ],
        "created_at": linked_profile(user).created_at,
        "updated_at": linked_profile(user).updated_at,
    }
    if include_account:
        data["account"] = user_account_summary(user)
    return data


class TeamMemberViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrStaffReadOnlyTeam]
    pagination_class = TeamMemberPagination

    def _queryset(self):
        query = User.objects.select_related("doctor_profile", "staff_profile").prefetch_related(
            Prefetch(
                "working_shifts",
                queryset=WorkingShift.objects.filter(is_active=True).order_by("weekday", "start_time", "id"),
                to_attr="active_team_shifts",
            )
        ).filter(
            Q(role=User.Role.DOCTOR, doctor_profile__isnull=False) | Q(role=User.Role.STAFF, staff_profile__isnull=False)
        ).order_by("id")
        params = self.request.query_params
        if params.get("q"):
            query = query.filter(Q(full_name__icontains=params["q"]) | Q(email__icontains=params["q"]))
        if params.get("role") in {User.Role.DOCTOR, User.Role.STAFF}:
            query = query.filter(role=params["role"])
        if params.get("professional_status") == "ACTIVE":
            query = query.filter(Q(role=User.Role.DOCTOR, doctor_profile__is_active=True) | Q(role=User.Role.STAFF, staff_profile__is_active=True))
        if params.get("professional_status") == "INACTIVE":
            query = query.filter(Q(role=User.Role.DOCTOR, doctor_profile__is_active=False) | Q(role=User.Role.STAFF, staff_profile__is_active=False))
        now = timezone.now()
        on_leave = Q(doctor_availability_exceptions__is_cancelled=False, doctor_availability_exceptions__type=AvailabilityException.Type.UNAVAILABLE, doctor_availability_exceptions__start_datetime__lte=now, doctor_availability_exceptions__end_datetime__gt=now) | Q(staff_availability_exceptions__is_cancelled=False, staff_availability_exceptions__type=AvailabilityException.Type.UNAVAILABLE, staff_availability_exceptions__start_datetime__lte=now, staff_availability_exceptions__end_datetime__gt=now)
        if params.get("availability") == "ON_LEAVE":
            query = query.filter(on_leave)
        elif params.get("availability") == "AVAILABLE":
            query = query.exclude(on_leave)
        elif params.get("availability") == "UNAVAILABLE":
            query = query.filter(Q(role=User.Role.DOCTOR, doctor_profile__is_active=False) | Q(role=User.Role.STAFF, staff_profile__is_active=False))
        return query.distinct()

    def list(self, request):
        page = self.pagination_class()
        users = page.paginate_queryset(self._queryset(), request, view=self)
        user_ids = [user.id for user in users]
        _, today_start, today_end = clinic_today_window()
        appointment_counts = dict(Appointment.objects.filter(doctor_id__in=user_ids, start_datetime__gte=today_start, start_datetime__lt=today_end).values("doctor_id").annotate(count=Count("id")).values_list("doctor_id", "count"))
        visit_counts = dict(Visit.objects.filter(doctor_id__in=user_ids, status=Visit.Status.ACTIVE).values("doctor_id").annotate(count=Count("id")).values_list("doctor_id", "count"))
        include_account = request.user.role == User.Role.ADMIN
        return page.get_paginated_response([_team_summary(user, appointments=appointment_counts.get(user.id, 0), active_visits=visit_counts.get(user.id, 0), include_account=include_account) for user in users])

    def create(self, request):
        serializer = TeamMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = create_team_member(account=data["account"], role=data["role"], profile=data.get("doctor_profile") or data.get("staff_profile"))
        except TeamRuleError as exc:
            return error_response(exc.code, exc.message, exc.details, exc.status_code)
        log_activity(request=request, action="team_member_created", entity_type="user", entity_id=user.id, metadata={"role": user.role, "profile_state": profile_state(user)})
        return Response(_team_summary(user), status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            user = self._queryset().get(pk=pk)
        except User.DoesNotExist:
            return error_response("TEAM_MEMBER_NOT_FOUND", "The Team member was not found.", status_code=status.HTTP_404_NOT_FOUND)
        profile = linked_profile(user)
        now, start, end = clinic_today_window()
        appointments = Appointment.objects.select_related("patient").filter(doctor=user, start_datetime__gte=start, start_datetime__lt=end).order_by("start_datetime", "id")[:20] if user.role == User.Role.DOCTOR else []
        leaves = (AvailabilityException.objects.filter(doctor=user) if user.role == User.Role.DOCTOR else AvailabilityException.objects.filter(staff=user)).filter(is_cancelled=False, end_datetime__gte=now).order_by("start_datetime", "id")[:20]
        include_account = request.user.role == User.Role.ADMIN
        shift_fields = ("id", "name", "weekday", "start_time", "end_time", "is_active", "version") if include_account else ("id", "name", "weekday", "start_time", "end_time")
        leave_fields = ("id", "start_datetime", "end_datetime", "type", "reason", "is_cancelled", "version") if include_account else ("id", "start_datetime", "end_datetime", "type", "reason", "is_cancelled")
        data = {
            **_team_summary(user, appointments=len(appointments), active_visits=Visit.objects.filter(doctor=user, status=Visit.Status.ACTIVE).count() if user.role == User.Role.DOCTOR else 0, include_account=include_account),
            "profile": {"specialty": profile.specialty, "phone": profile.phone, "bio": profile.bio, "is_active": profile.is_active} if user.role == User.Role.DOCTOR else {"position": profile.position, "phone": profile.phone, "is_active": profile.is_active},
            "active_shifts": list(WorkingShift.objects.filter(employee=user, is_active=True).values(*shift_fields)),
            "current_future_leave": list(leaves.values(*leave_fields)),
        }
        if include_account:
            data["today_appointments"] = [{"id": row.id, "patient_id": row.patient_id, "patient_name": row.patient.full_name, "start_datetime": row.start_datetime, "end_datetime": row.end_datetime, "status": row.status, "reason": row.reason} for row in appointments]
        return Response(data)

    def partial_update(self, request, pk=None):
        try:
            user = self._queryset().get(pk=pk)
        except User.DoesNotExist:
            return error_response("TEAM_MEMBER_NOT_FOUND", "The Team member was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if "version" not in request.data:
            return error_response("VERSION_REQUIRED", "A current professional profile version is required.", {"version": ["This field is required."]})
        serializer = TeamMemberUpdateSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        try:
            updated = update_team_profile(user_id=user.id, data=serializer.validated_data)
        except TeamRuleError as exc:
            return error_response(exc.code, exc.message, exc.details, exc.status_code)
        log_activity(request=request, action="team_member_updated", entity_type="user", entity_id=updated.id, metadata={"updated_fields": sorted(set(serializer.validated_data) - {"version"})})
        return Response(_team_summary(updated))

    @action(detail=True, methods=["post"], url_path="set-professional-status")
    def set_professional_status(self, request, pk=None):
        try:
            user = self._queryset().get(pk=pk)
        except User.DoesNotExist:
            return error_response("TEAM_MEMBER_NOT_FOUND", "The Team member was not found.", status_code=status.HTTP_404_NOT_FOUND)
        if "version" not in request.data:
            return error_response("VERSION_REQUIRED", "A current professional profile version is required.", {"version": ["This field is required."]})
        serializer = ProfessionalStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = set_professional_status(user_id=user.id, is_active=serializer.validated_data["is_active"], version=serializer.validated_data["version"])
        except TeamRuleError as exc:
            return error_response(exc.code, exc.message, exc.details, exc.status_code)
        log_activity(request=request, action="professional_status_changed", entity_type="user", entity_id=updated.id, metadata={"is_active": serializer.validated_data["is_active"], "reason": serializer.validated_data.get("reason", "")})
        return Response(_team_summary(updated))
