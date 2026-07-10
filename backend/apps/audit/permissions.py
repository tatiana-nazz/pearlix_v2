from rest_framework.permissions import BasePermission


class IsAuditAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role == "ADMIN")
