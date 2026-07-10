from rest_framework.permissions import BasePermission


def has_role(user, role: str) -> bool:
    return bool(user and user.is_authenticated and user.role == role)


class IsAdminRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        return has_role(request.user, "ADMIN")


class IsStaffRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        return has_role(request.user, "STAFF")


class IsDoctorRole(BasePermission):
    def has_permission(self, request, view) -> bool:
        return has_role(request.user, "DOCTOR")
