from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.patients.selectors import user_can_read_patient_clinical_history


class VisitPermission(BasePermission):
    doctor_actions = {"active", "complete", "clinical_notes", "xrays", "billing_handoff"}

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action in self.doctor_actions:
            return request.user.role == "DOCTOR"
        return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action in {"complete", "clinical_notes", "xrays", "billing_handoff"}:
            return request.user.role == "DOCTOR" and obj.doctor_id == request.user.id
        if request.method in SAFE_METHODS:
            if request.user.role in {"ADMIN", "STAFF"}:
                return True
            return user_can_read_patient_clinical_history(request.user, obj.patient)
        return False
