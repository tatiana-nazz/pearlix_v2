from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.patients.selectors import user_can_access_patient


class PatientPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action == "create":
            return request.user.role == "STAFF"
        if view.action in {"archive", "unarchive"}:
            return request.user.role == "STAFF"
        return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action in {"archive", "unarchive"}:
            return request.user.role == "STAFF"
        if request.method in SAFE_METHODS:
            if request.user.role in {"ADMIN", "STAFF"}:
                return True
            return user_can_access_patient(request.user, obj)
        if request.user.role == "STAFF":
            return True
        if request.user.role == "DOCTOR":
            if "is_archived" in request.data:
                return False
            return user_can_access_patient(request.user, obj)
        return False
