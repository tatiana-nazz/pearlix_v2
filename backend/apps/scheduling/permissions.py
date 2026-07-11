from rest_framework.permissions import SAFE_METHODS, BasePermission


class ScheduleAdminPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role == "ADMIN")


class WorkingShiftPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}
        return request.user.role == "ADMIN"

    def has_object_permission(self, request, view, obj) -> bool:
        return request.user.role == "ADMIN" or (request.method in SAFE_METHODS and obj.employee_id == request.user.id)


class AvailabilityExceptionPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}
        return request.user.role == "ADMIN"

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method not in SAFE_METHODS:
            return request.user.role == "ADMIN"
        if request.user.role in {"ADMIN", "STAFF"}:
            return True
        return obj.doctor_id == request.user.id


class AppointmentPermission(BasePermission):
    status_actions = {"check_in", "cancel", "no_show"}

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action == "start_visit":
            return request.user.role == "DOCTOR"
        if view.action in {"create", "update", "partial_update"} | self.status_actions:
            return request.user.role == "STAFF"
        if view.action == "availability":
            return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}
        return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action == "start_visit":
            return request.user.role == "DOCTOR" and obj.doctor_id == request.user.id
        if view.action in {"update", "partial_update"} | self.status_actions:
            return request.user.role == "STAFF"
        if request.user.role in {"ADMIN", "STAFF"}:
            return True
        return obj.doctor_id == request.user.id
