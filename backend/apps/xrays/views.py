from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.ai_results.serializers import AIResultSerializer
from apps.ai_results.services import AIServiceError, run_ai_for_external_case, run_ai_for_xray
from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.common.protected_media import protected_file_response
from apps.patients.models import Patient
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.xrays.permissions import ExternalXrayPermission, XrayPermission, doctor_xray_scope
from apps.xrays.serializers import ExternalXrayCaseSerializer, XrayAttachmentSerializer
from apps.xrays.services import (
    ExternalXrayRuleError,
    XrayUploadError,
    XrayDeleteError,
    attach_external_case_to_patient,
    create_external_xray_case,
    discard_external_case,
    delete_xray_attachment,
    validate_external_temporary,
)


class XrayPagination(PageNumberPagination):
    page_size = 20


class XrayViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = XrayAttachmentSerializer
    permission_classes = [XrayPermission]
    pagination_class = XrayPagination
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        queryset = XrayAttachment.objects.select_related("patient", "visit", "uploaded_by", "ai_result").all()
        user = self.request.user
        if user.is_authenticated and user.role == "DOCTOR":
            queryset = queryset.filter(doctor_xray_scope(user)).distinct()

        patient_id = self.request.query_params.get("patient_id")
        visit_id = self.request.query_params.get("visit_id")
        uploaded_by = self.request.query_params.get("uploaded_by")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        if uploaded_by:
            queryset = queryset.filter(uploaded_by_id=uploaded_by)
        return queryset

    def destroy(self, request, *args, **kwargs):
        xray = self.get_object()
        try:
            metadata = delete_xray_attachment(xray=xray)
        except XrayDeleteError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="xray_deleted",
            entity_type="xray_attachment",
            entity_id=metadata["xray_id"],
            metadata=metadata,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        xray = self.get_object()
        return protected_file_response(
            xray.original_file,
            content_type=xray.content_type,
            filename=xray.stored_file_name,
            not_found_message="X-ray file was not found.",
        )

    @action(detail=True, methods=["post"], url_path="run-ai")
    def run_ai(self, request, pk=None):
        xray = self.get_object()
        log_activity(
            request=request,
            action="xray_ai_requested",
            entity_type="xray_attachment",
            entity_id=xray.id,
            metadata={"xray_id": xray.id, "patient_id": xray.patient_id},
        )
        try:
            result = run_ai_for_xray(xray_attachment=xray, user=request.user)
        except AIServiceError as exc:
            metadata = {
                "xray_id": xray.id,
                "patient_id": xray.patient_id,
                "failure_code": exc.code,
                "request_outcome": exc.audit_outcome.upper(),
            }
            if exc.audit_outcome == "failed":
                metadata["status"] = "FAILED"
            if exc.result_id is not None:
                metadata["result_id"] = exc.result_id
            if exc.model_version:
                metadata["model_version"] = exc.model_version
            log_activity(
                request=request,
                action=f"xray_ai_{exc.audit_outcome}",
                entity_type="ai_result",
                entity_id=exc.result_id,
                metadata=metadata,
            )
            return exc.to_response()
        log_activity(
            request=request,
            action="xray_ai_completed",
            entity_type="ai_result",
            entity_id=result.id,
            metadata={
                "result_id": result.id,
                "xray_id": xray.id,
                "patient_id": xray.patient_id,
                "model_version": result.model_version,
                "status": result.status,
            },
        )
        log_activity(
            request=request,
            action="xray_ai_run",
            entity_type="ai_result",
            entity_id=result.id,
            metadata={"result_id": result.id, "xray_id": xray.id, "patient_id": xray.patient_id, "status": result.status},
        )
        return Response(AIResultSerializer(result).data)

    @action(detail=True, methods=["get"], url_path="ai-result")
    def ai_result(self, request, pk=None):
        xray = self.get_object()
        result = getattr(xray, "ai_result", None)
        if result is None:
            return error_response(
                "AI_RESULT_UNAVAILABLE",
                "AI result is unavailable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return Response(AIResultSerializer(result).data)

    @action(detail=True, methods=["get"], url_path="ai-overlay")
    def ai_overlay(self, request, pk=None):
        xray = self.get_object()
        result = getattr(xray, "ai_result", None)
        if result is None or not result.overlay_file:
            return error_response(
                "AI_RESULT_UNAVAILABLE",
                "AI overlay is unavailable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return protected_file_response(
            result.overlay_file,
            content_type="image/png",
            filename=f"ai-overlay-{xray.id}.png",
            not_found_message="AI overlay is unavailable.",
        )


class ExternalXrayViewSet(viewsets.ModelViewSet):
    serializer_class = ExternalXrayCaseSerializer
    permission_classes = [ExternalXrayPermission]
    pagination_class = XrayPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = ExternalXrayCase.objects.select_related(
            "uploaded_by",
            "attached_patient",
            "attached_visit",
            "attached_xray",
            "ai_result",
        ).all()
        user = self.request.user
        if user.is_authenticated and user.role == "DOCTOR":
            queryset = queryset.filter(uploaded_by=user)

        case_status = self.request.query_params.get("status")
        uploaded_by = self.request.query_params.get("uploaded_by")
        created_from = self.request.query_params.get("created_from")
        created_to = self.request.query_params.get("created_to")
        if case_status:
            queryset = queryset.filter(status=case_status)
        if uploaded_by:
            queryset = queryset.filter(uploaded_by_id=uploaded_by)
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            external = create_external_xray_case(
                uploaded_by=request.user,
                uploaded_file=request.FILES.get("file"),
                title=request.data.get("title", ""),
                notes=request.data.get("notes", ""),
            )
        except XrayUploadError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="external_xray_uploaded",
            entity_type="external_xray_case",
            entity_id=external.id,
            metadata={"external_xray_case_id": external.id, "uploaded_by_id": request.user.id},
        )
        return Response(ExternalXrayCaseSerializer(external).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        external = self.get_object()
        return protected_file_response(
            external.original_file,
            content_type=external.content_type,
            filename=external.stored_file_name,
            not_found_message="External X-ray file was not found.",
        )

    @action(detail=True, methods=["post"], url_path="run-ai")
    def run_ai(self, request, pk=None):
        external = self.get_object()
        try:
            validate_external_temporary(external, "AI can only run on temporary external X-ray cases.")
        except ExternalXrayRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="external_xray_ai_requested",
            entity_type="external_xray_case",
            entity_id=external.id,
            metadata={"external_xray_case_id": external.id},
        )
        try:
            result = run_ai_for_external_case(external_xray_case=external, user=request.user)
        except AIServiceError as exc:
            metadata = {
                "external_xray_case_id": external.id,
                "failure_code": exc.code,
                "request_outcome": exc.audit_outcome.upper(),
            }
            if exc.audit_outcome == "failed":
                metadata["status"] = "FAILED"
            if exc.result_id is not None:
                metadata["result_id"] = exc.result_id
            if exc.model_version:
                metadata["model_version"] = exc.model_version
            log_activity(
                request=request,
                action=f"external_xray_ai_{exc.audit_outcome}",
                entity_type="ai_result",
                entity_id=exc.result_id,
                metadata=metadata,
            )
            return exc.to_response()
        log_activity(
            request=request,
            action="external_xray_ai_completed",
            entity_type="ai_result",
            entity_id=result.id,
            metadata={
                "result_id": result.id,
                "external_xray_case_id": external.id,
                "model_version": result.model_version,
                "status": result.status,
            },
        )
        log_activity(
            request=request,
            action="external_xray_ai_run",
            entity_type="ai_result",
            entity_id=result.id,
            metadata={"result_id": result.id, "external_xray_case_id": external.id, "status": result.status},
        )
        return Response(AIResultSerializer(result).data)

    @action(detail=True, methods=["get"], url_path="ai-result")
    def ai_result(self, request, pk=None):
        external = self.get_object()
        result = getattr(external, "ai_result", None)
        if result is None:
            return error_response(
                "AI_RESULT_UNAVAILABLE",
                "AI result is unavailable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return Response(AIResultSerializer(result).data)

    @action(detail=True, methods=["get"], url_path="ai-overlay")
    def ai_overlay(self, request, pk=None):
        external = self.get_object()
        result = getattr(external, "ai_result", None)
        if result is None or not result.overlay_file:
            return error_response(
                "AI_RESULT_UNAVAILABLE",
                "AI overlay is unavailable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return protected_file_response(
            result.overlay_file,
            content_type="image/png",
            filename=f"external-ai-overlay-{external.id}.png",
            not_found_message="AI overlay is unavailable.",
        )

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        external = self.get_object()
        try:
            external = discard_external_case(external_case=external, user=request.user)
        except ExternalXrayRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="external_xray_discarded",
            entity_type="external_xray_case",
            entity_id=external.id,
            metadata={"external_xray_case_id": external.id, "status": external.status},
        )
        return Response(ExternalXrayCaseSerializer(external).data)

    @action(detail=True, methods=["post"], url_path="attach-to-patient")
    def attach_to_patient(self, request, pk=None):
        external = self.get_object()
        patient_id = request.data.get("patient_id")
        if not patient_id:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"patient_id": ["This field is required."]})
        patient = get_object_or_404(Patient, pk=patient_id)
        visit = None
        visit_id = request.data.get("visit_id")
        if visit_id not in (None, ""):
            visit = get_object_or_404(Visit, pk=visit_id)
        try:
            external = attach_external_case_to_patient(
                external_case=external,
                patient=patient,
                visit=visit,
                user=request.user,
                title=request.data.get("title", ""),
                notes=request.data.get("notes", ""),
            )
        except ExternalXrayRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="external_xray_attached_to_patient",
            entity_type="external_xray_case",
            entity_id=external.id,
            metadata={
                "external_xray_case_id": external.id,
                "patient_id": external.attached_patient_id,
                "visit_id": external.attached_visit_id,
                "xray_id": external.attached_xray_id,
            },
        )
        return Response(ExternalXrayCaseSerializer(external).data)
