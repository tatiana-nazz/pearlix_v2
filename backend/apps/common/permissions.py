from rest_framework.permissions import SAFE_METHODS, BasePermission


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


class IsAdminOrStaffReadOnlyTeam(BasePermission):
    """Keep Team mutations Admin-only while exposing its safe directory to Staff."""

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == "ADMIN":
            return True
        return request.user.role == "STAFF" and request.method in SAFE_METHODS
