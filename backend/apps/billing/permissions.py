from rest_framework.permissions import SAFE_METHODS, BasePermission


class BillingHandoffPermission(BasePermission):
    mutation_actions = {"create", "update", "partial_update", "cancel", "issue_invoice"}

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action in self.mutation_actions:
            return request.user.role == "STAFF"
        if request.method in SAFE_METHODS:
            return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}
        return False

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action in self.mutation_actions:
            return request.user.role == "STAFF"
        if request.method in SAFE_METHODS:
            if request.user.role in {"ADMIN", "STAFF"}:
                return True
            return request.user.role == "DOCTOR" and obj.doctor_id == request.user.id
        return False


class InvoicePermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in {"ADMIN", "STAFF"}
        return False

    def has_object_permission(self, request, view, obj) -> bool:
        return self.has_permission(request, view)
