"""Transactional account/profile linkage rules used by the Team and User APIs."""

from __future__ import annotations

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import AccountSecurityState, DoctorProfile, StaffProfile, User
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.visits.models import Visit


class TeamRuleError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = 400):
        self.code, self.message, self.details, self.status_code = code, message, details or {}, status_code
        super().__init__(message)


def _lock_account_security_scope() -> AccountSecurityState:
    """Acquire the shared row lock before any active-Admin removal.

    Locking a dedicated singleton serializes demotion and deactivation even
    when concurrent requests target different User rows.  The row is created
    by the accounts migration; absence therefore fails closed.
    """

    return AccountSecurityState.objects.select_for_update().get(pk=1)


def _lock_authority_users(*user_ids: int) -> dict[int, User]:
    users = (
        # Lock only User rows. The related profiles are nullable outer joins,
        # which PostgreSQL cannot include in a FOR UPDATE lock target.
        User.objects.select_for_update(of=("self",))
        .select_related("doctor_profile", "staff_profile")
        .filter(pk__in=set(user_ids))
        .order_by("pk")
    )
    return {user.id: user for user in users}


def _assert_current_admin_actor(actor: User) -> None:
    if actor.role != User.Role.ADMIN or not actor.is_active:
        raise TeamRuleError(
            "PERMISSION_DENIED",
            "Current active Admin authority is required.",
            status_code=403,
        )


def _assert_admin_removal_allowed(
    user: User,
    *,
    code: str = "LAST_ACTIVE_ADMIN",
    message: str = "The last active Admin cannot lose administrative authority.",
) -> None:
    if (
        user.role == User.Role.ADMIN
        and user.is_active
        and User.objects.filter(role=User.Role.ADMIN, is_active=True).count() <= 1
    ):
        raise TeamRuleError(
            code,
            message,
            status_code=409,
        )


def profile_state(user: User) -> str:
    doctor = getattr(user, "doctor_profile", None)
    staff = getattr(user, "staff_profile", None)
    if doctor and staff:
        return "INCONSISTENT"
    if user.role == User.Role.DOCTOR:
        return "DOCTOR" if doctor else "PROFILE_SETUP_REQUIRED"
    if user.role == User.Role.STAFF:
        return "STAFF" if staff else "PROFILE_SETUP_REQUIRED"
    return "INCONSISTENT" if (doctor and doctor.is_active) or (staff and staff.is_active) else "NONE"


def linked_profile(user: User):
    return getattr(user, "doctor_profile", None) or getattr(user, "staff_profile", None)


def assert_profile_integrity(user: User, *, require_profile: bool = False) -> None:
    state = profile_state(user)
    if state == "INCONSISTENT":
        raise TeamRuleError("PROFILE_INTEGRITY_ERROR", "The account has an inconsistent professional-profile linkage.", status_code=409)
    if user.role in {User.Role.DOCTOR, User.Role.STAFF} and require_profile and state == "PROFILE_SETUP_REQUIRED":
        raise TeamRuleError("PROFILE_REQUIRED", "Doctor and Staff accounts require a matching professional profile.", status_code=409)
    if user.role == User.Role.DOCTOR and state not in {"DOCTOR", "PROFILE_SETUP_REQUIRED"}:
        raise TeamRuleError("PROFILE_ROLE_MISMATCH", "The professional profile does not match the account role.", status_code=409)
    if user.role == User.Role.STAFF and state not in {"STAFF", "PROFILE_SETUP_REQUIRED"}:
        raise TeamRuleError("PROFILE_ROLE_MISMATCH", "The professional profile does not match the account role.", status_code=409)


def profile_integrity_counts() -> dict[str, int]:
    users = User.objects.select_related("doctor_profile", "staff_profile").all()
    counts = {"users": 0, "linked_doctors": 0, "linked_staff": 0, "unlinked_professional_accounts": 0, "dual_profiles": 0, "role_mismatches": 0, "active_admin_profiles": 0}
    for user in users:
        counts["users"] += 1
        doctor, staff = getattr(user, "doctor_profile", None), getattr(user, "staff_profile", None)
        if doctor and staff:
            counts["dual_profiles"] += 1
        if doctor and user.role == User.Role.DOCTOR:
            counts["linked_doctors"] += 1
        if staff and user.role == User.Role.STAFF:
            counts["linked_staff"] += 1
        if user.role in {User.Role.DOCTOR, User.Role.STAFF} and not (doctor or staff):
            counts["unlinked_professional_accounts"] += 1
        if (doctor and user.role != User.Role.DOCTOR) or (staff and user.role != User.Role.STAFF):
            counts["role_mismatches"] += 1
        if user.role == User.Role.ADMIN and ((doctor and doctor.is_active) or (staff and staff.is_active)):
            counts["active_admin_profiles"] += 1
    return counts


def user_account_summary(user: User) -> dict:
    return {"id": user.id, "email": user.email, "is_active": user.is_active, "must_change_password": user.must_change_password, "created_at": user.created_at, "updated_at": user.updated_at}


def clinic_today_window():
    clinic_tz = ZoneInfo(ClinicSettings.get_solo().timezone)
    now = timezone.now().astimezone(clinic_tz)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return now, start, start + timedelta(days=1)


def availability_summary(user: User) -> dict:
    now, _, _ = clinic_today_window()
    profile = linked_profile(user)
    if profile and not profile.is_active:
        return {"availability": "UNAVAILABLE", "on_leave": False, "next_exception": None}
    base = AvailabilityException.objects.filter(is_cancelled=False, type=AvailabilityException.Type.UNAVAILABLE)
    target = base.filter(doctor=user) if user.role == User.Role.DOCTOR else base.filter(staff=user)
    current = target.filter(start_datetime__lte=now, end_datetime__gt=now).order_by("start_datetime", "id").first()
    upcoming = target.filter(start_datetime__gt=now).order_by("start_datetime", "id").first()
    return {"availability": "ON_LEAVE" if current else "AVAILABLE", "on_leave": bool(current), "next_exception": {"id": upcoming.id, "start_datetime": upcoming.start_datetime, "end_datetime": upcoming.end_datetime, "reason": upcoming.reason} if upcoming else None}


def workload_summary(user: User) -> dict:
    _, start, end = clinic_today_window()
    return {
        "appointment_count": Appointment.objects.filter(doctor=user, start_datetime__gte=start, start_datetime__lt=end).count() if user.role == User.Role.DOCTOR else 0,
        "active_visit_count": Visit.objects.filter(doctor=user, status=Visit.Status.ACTIVE).count() if user.role == User.Role.DOCTOR else 0,
    }


def operational_history(user: User) -> dict:
    return {
        "working_shifts": WorkingShift.objects.filter(employee=user).count(),
        "doctor_availability_exceptions": AvailabilityException.objects.filter(doctor=user).count(),
        "staff_availability_exceptions": AvailabilityException.objects.filter(staff=user).count(),
        "appointments": Appointment.objects.filter(doctor=user).count(),
        "visits": Visit.objects.filter(doctor=user).count(),
    }


def has_operational_history(summary: dict) -> bool:
    return any(summary.values())


def create_team_member(*, account: dict, role: str, profile: dict) -> User:
    with transaction.atomic():
        if role not in {User.Role.DOCTOR, User.Role.STAFF}:
            raise TeamRuleError("PROFILE_REQUIRED", "Team onboarding supports Doctor and Staff roles only.")
        user = User(email=account["email"], full_name=account["full_name"], role=role, is_active=True)
        user.set_user_password(account["temporary_password"], must_change_password=True, mark_changed=False)
        user.save()
        if role == User.Role.DOCTOR:
            DoctorProfile.objects.create(user=user, specialty=profile.get("specialty", ""), phone=profile.get("phone", ""), bio=profile.get("bio", ""), is_active=True)
        else:
            StaffProfile.objects.create(user=user, position=profile.get("position", ""), phone=profile.get("phone", ""), is_active=True)
        user = User.objects.select_for_update(of=("self",)).select_related("doctor_profile", "staff_profile").get(pk=user.pk)
        assert_profile_integrity(user, require_profile=True)
        return user


def update_team_profile(*, user_id: int, data: dict) -> User:
    with transaction.atomic():
        user = User.objects.select_for_update(of=("self",)).select_related("doctor_profile", "staff_profile").get(pk=user_id)
        assert_profile_integrity(user, require_profile=True)
        profile = linked_profile(user)
        if data["version"] != profile.version:
            raise TeamRuleError("VERSION_CONFLICT", "The professional profile has changed.", {"current_version": profile.version}, 409)
        writable = {"specialty", "phone", "bio"} if user.role == User.Role.DOCTOR else {"position", "phone"}
        values = {key: value for key, value in data.items() if key in writable}
        if not values:
            raise TeamRuleError("PROFILE_INTEGRITY_ERROR", "No professional fields were supplied.")
        for key, value in values.items():
            setattr(profile, key, value)
        profile.version += 1
        profile.save(update_fields=[*values.keys(), "version", "updated_at"])
        return User.objects.select_related("doctor_profile", "staff_profile").get(pk=user.pk)


def set_professional_status(*, user_id: int, is_active: bool, version: int) -> User:
    with transaction.atomic():
        user = User.objects.select_for_update(of=("self",)).select_related("doctor_profile", "staff_profile").get(pk=user_id)
        assert_profile_integrity(user, require_profile=True)
        profile = linked_profile(user)
        if version != profile.version:
            raise TeamRuleError("VERSION_CONFLICT", "The professional profile has changed.", {"current_version": profile.version}, 409)
        profile.is_active = is_active
        profile.version += 1
        profile.save(update_fields=["is_active", "version", "updated_at"])
        return User.objects.select_related("doctor_profile", "staff_profile").get(pk=user.pk)


TRANSITION_SALT = "accounts.team-role-transition.v1"


def transition_preview(*, user: User, target_role: str, actor: User) -> dict:
    if actor.id == user.id:
        raise TeamRuleError("SELF_ROLE_CHANGE_FORBIDDEN", "Admins cannot change their own role.", status_code=403)
    if target_role not in set(User.Role.values):
        raise TeamRuleError("PROFILE_ROLE_MISMATCH", "The target role is not supported.")
    assert_profile_integrity(user)
    history = operational_history(user)
    blockers: list[dict] = []
    if user.role == User.Role.ADMIN and target_role != User.Role.ADMIN:
        allowed, consequence = True, "A matching professional profile will be created or reactivated."
    elif user.role == target_role:
        allowed, consequence = False, "The account already has the requested role."
        blockers.append({"code": "NO_ROLE_CHANGE", "counts": history})
    elif has_operational_history(history):
        allowed, consequence = False, "Operational history is retained and cannot be detached from this account."
        blockers.append({"code": "ROLE_TRANSITION_BLOCKED_BY_HISTORY", "counts": history})
    else:
        allowed, consequence = True, "The role and matching professional profile will be changed atomically."
    if user.role == User.Role.ADMIN and user.is_active and target_role != User.Role.ADMIN and User.objects.filter(role=User.Role.ADMIN, is_active=True).count() <= 1:
        allowed, consequence = False, "The last active Admin cannot transition away from ADMIN."
        blockers.append({"code": "LAST_ACTIVE_ADMIN", "counts": history})
    state = profile_state(user)
    token = None
    if allowed:
        token = signing.dumps({"user_id": user.id, "source_role": user.role, "target_role": target_role, "version": user.version, "profile_state": state}, salt=TRANSITION_SALT, compress=True)
    return {"current_role": user.role, "target_role": target_role, "linked_profile_state": state, "operational_history": history, "required_target_profile": None if target_role == User.Role.ADMIN else ("doctor_profile" if target_role == User.Role.DOCTOR else "staff_profile"), "allowed": allowed, "blockers": blockers, "consequences": [consequence], "confirmation_token": token}


def confirm_transition(*, user_id: int, actor: User, target_role: str, token: str, version: int, profile: dict) -> User:
    try:
        bound = signing.loads(token, salt=TRANSITION_SALT, max_age=600)
    except signing.BadSignature as exc:
        raise TeamRuleError("ROLE_TRANSITION_CONFIRMATION_REQUIRED", "A valid, unexpired transition confirmation is required.", status_code=409) from exc
    allowed_profile_fields = {
        User.Role.DOCTOR: {"specialty", "phone", "bio"},
        User.Role.STAFF: {"position", "phone"},
        User.Role.ADMIN: set(),
    }
    unexpected_profile_fields = sorted(set(profile) - allowed_profile_fields[target_role])
    if unexpected_profile_fields:
        raise TeamRuleError("PROFILE_INTEGRITY_ERROR", "The target profile contains unsupported fields.", {"profile": {field: ["This field is not allowed."] for field in unexpected_profile_fields}})
    with transaction.atomic():
        _lock_account_security_scope()
        locked_users = _lock_authority_users(actor.id, user_id)
        user = locked_users[user_id]
        actor = locked_users[actor.id]
        _assert_current_admin_actor(actor)
        if actor.id == user.id:
            raise TeamRuleError("SELF_ROLE_CHANGE_FORBIDDEN", "Admins cannot change their own role.", status_code=403)
        if bound != {"user_id": user.id, "source_role": user.role, "target_role": target_role, "version": user.version, "profile_state": profile_state(user)} or version != user.version:
            raise TeamRuleError("VERSION_CONFLICT", "The account changed after the transition preview.", {"current_version": user.version}, 409)
        if target_role != User.Role.ADMIN:
            _assert_admin_removal_allowed(user)
        preview = transition_preview(user=user, target_role=target_role, actor=actor)
        if not preview["allowed"]:
            code = preview["blockers"][0]["code"] if preview["blockers"] else "ROLE_TRANSITION_CONFIRMATION_REQUIRED"
            raise TeamRuleError(code, preview["consequences"][0], {"operational_history": preview["operational_history"]}, 409)
        doctor, staff = getattr(user, "doctor_profile", None), getattr(user, "staff_profile", None)
        if target_role == User.Role.DOCTOR:
            if staff:
                raise TeamRuleError("PROFILE_ALREADY_LINKED", "A Staff profile cannot be converted into a Doctor profile.", status_code=409)
            if doctor:
                doctor.is_active = True
                doctor.version += 1
                doctor.save(update_fields=["is_active", "version", "updated_at"])
            else:
                DoctorProfile.objects.create(user=user, specialty=profile.get("specialty", ""), phone=profile.get("phone", ""), bio=profile.get("bio", ""), is_active=True)
        elif target_role == User.Role.STAFF:
            if doctor:
                raise TeamRuleError("PROFILE_ALREADY_LINKED", "A Doctor profile cannot be converted into a Staff profile.", status_code=409)
            if staff:
                staff.is_active = True
                staff.version += 1
                staff.save(update_fields=["is_active", "version", "updated_at"])
            else:
                StaffProfile.objects.create(user=user, position=profile.get("position", ""), phone=profile.get("phone", ""), is_active=True)
        else:
            if doctor:
                doctor.is_active = False; doctor.version += 1; doctor.save(update_fields=["is_active", "version", "updated_at"])
            if staff:
                staff.is_active = False; staff.version += 1; staff.save(update_fields=["is_active", "version", "updated_at"])
        user.role = target_role
        user.version += 1
        update_fields = ["role", "version", "updated_at"]
        if target_role != User.Role.ADMIN:
            # Non-ADMIN roles cannot retain the separate Django-admin
            # authorization plane.  This reconciliation is committed in the
            # same transaction as the role/profile transition.
            user.is_staff = False
            user.is_superuser = False
            update_fields.extend(["is_staff", "is_superuser"])
        user.save(update_fields=update_fields)
        return User.objects.select_related("doctor_profile", "staff_profile").get(pk=user.pk)


def deactivate_user(*, user_id: int, actor_id: int) -> User:
    with transaction.atomic():
        _lock_account_security_scope()
        locked_users = _lock_authority_users(actor_id, user_id)
        user = locked_users[user_id]
        actor = locked_users[actor_id]
        _assert_current_admin_actor(actor)
        if user.id == actor_id:
            raise TeamRuleError(
                "INVALID_OPERATION",
                "Admin cannot deactivate their own account.",
                status_code=400,
            )
        _assert_admin_removal_allowed(
            user,
            code="INVALID_OPERATION",
            message="Cannot deactivate the last active admin.",
        )
        if user.is_active:
            user.is_active = False
            user.version += 1
            user.save(update_fields=["is_active", "version", "updated_at"])
        return user


def reactivate_user(*, user_id: int, actor_id: int) -> User:
    with transaction.atomic():
        _lock_account_security_scope()
        locked_users = _lock_authority_users(actor_id, user_id)
        user = locked_users[user_id]
        _assert_current_admin_actor(locked_users[actor_id])
        if user.is_active:
            raise TeamRuleError("USER_ALREADY_ACTIVE", "The account is already active.", status_code=409)
        assert_profile_integrity(user, require_profile=user.role in {User.Role.DOCTOR, User.Role.STAFF})
        user.is_active = True
        user.version += 1
        user.save(update_fields=["is_active", "version", "updated_at"])
        return user
