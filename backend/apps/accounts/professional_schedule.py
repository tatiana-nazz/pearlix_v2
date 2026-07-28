"""Authoritative active-professional schedule invariant.

Professional activity is deliberately distinct from ``User.is_active``.  This
module is the single place that decides whether a professional can be active
and is used by both Team and schedule mutation services.
"""

from __future__ import annotations

from django.db.models import QuerySet
from rest_framework import status

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.common.errors import error_response
from apps.scheduling.models import WorkingShift


ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE = "ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE"


class ProfessionalScheduleRuleError(Exception):
    def __init__(self, *, employee_id: int, active_shift_count: int):
        self.code = ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE
        self.message = "An active professional requires at least one active working shift."
        self.details = {
            "employee_id": employee_id,
            "active_shift_count": active_shift_count,
            "required_minimum": 1,
            "next_action": "CONFIGURE_SCHEDULE",
        }
        self.status_code = status.HTTP_409_CONFLICT
        super().__init__(self.message)

    def to_response(self):
        return error_response(self.code, self.message, self.details, self.status_code)


def active_shifts(user: User, *, lock: bool = False) -> QuerySet[WorkingShift]:
    shifts = WorkingShift.objects.filter(employee_id=user.id, is_active=True)
    return shifts.select_for_update() if lock else shifts


def active_shift_count(user: User, *, lock: bool = False) -> int:
    return active_shifts(user, lock=lock).count()


def professional_profile(user: User, *, lock: bool = False):
    if user.role == User.Role.DOCTOR:
        query = DoctorProfile.objects.filter(user_id=user.id)
    elif user.role == User.Role.STAFF:
        query = StaffProfile.objects.filter(user_id=user.id)
    else:
        return None
    return (query.select_for_update() if lock else query).first()


def lock_professional_and_active_shifts(user: User):
    """Lock the profile and active schedule rows before a status mutation."""
    profile = professional_profile(user, lock=True)
    list(active_shifts(user, lock=True).only("id"))
    return profile


def assert_professional_activation_allowed(user: User) -> int:
    """Lock and verify the schedule immediately before professional activation."""
    lock_professional_and_active_shifts(user)
    count = active_shift_count(user, lock=True)
    if count < 1:
        raise ProfessionalScheduleRuleError(employee_id=user.id, active_shift_count=count)
    return count


def assert_schedule_mutation_preserves_active_schedule(user: User) -> int:
    """Re-check the invariant after a schedule mutation and before commit."""
    profile = lock_professional_and_active_shifts(user)
    count = active_shift_count(user, lock=True)
    if profile and profile.is_active and count < 1:
        raise ProfessionalScheduleRuleError(employee_id=user.id, active_shift_count=count)
    return count


def operational_status(*, professional_is_active: bool, active_shift_count: int) -> str:
    if professional_is_active:
        return "ACTIVE" if active_shift_count else "INVARIANT_VIOLATION"
    return "INACTIVE" if active_shift_count else "SETUP_REQUIRED"
