from django.db.models import Q
from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.patients.selectors import user_can_read_patient_clinical_history


def doctor_xray_scope(user):
    return Q(patient__is_archived=False)


def user_can_read_xray(user, xray) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.role in {"ADMIN", "STAFF"}:
        return True
    if user.role != "DOCTOR":
        return False
    return user_can_read_patient_clinical_history(user, xray.patient)


class XrayPermission(BasePermission):
    doctor_write_actions = {"run_ai", "destroy"}

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action in self.doctor_write_actions:
            return request.user.role == "DOCTOR"
        if request.method in SAFE_METHODS:
            return request.user.role in {"ADMIN", "STAFF", "DOCTOR"}
        return False

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action == "destroy":
            return (
                request.user.role == "DOCTOR"
                and obj.uploaded_by_id == request.user.id
                and user_can_read_xray(request.user, obj)
            )
        if view.action in self.doctor_write_actions:
            return request.user.role == "DOCTOR" and user_can_read_xray(request.user, obj)
        if request.method in SAFE_METHODS:
            return user_can_read_xray(request.user, obj)
        return False


def user_can_read_external_xray(user, external_case) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.role == "ADMIN":
        return True
    if user.role == "DOCTOR":
        return external_case.uploaded_by_id == user.id
    return False


class ExternalXrayPermission(BasePermission):
    doctor_attach_actions = {"attach_to_patient"}
    mutation_actions = {"create", "run_ai", "discard"}

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action in self.doctor_attach_actions:
            return request.user.role == "DOCTOR"
        if view.action in self.mutation_actions:
            return request.user.role in {"ADMIN", "DOCTOR"}
        return request.user.role in {"ADMIN", "DOCTOR"}

    def has_object_permission(self, request, view, obj) -> bool:
        if view.action in self.doctor_attach_actions:
            return request.user.role == "DOCTOR" and obj.uploaded_by_id == request.user.id
        if view.action in self.mutation_actions:
            return user_can_read_external_xray(request.user, obj)
        return user_can_read_external_xray(request.user, obj)
