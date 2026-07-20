from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.patients.selectors import get_patients_for_user
from apps.visits.models import Visit
from apps.visits.permissions import VisitPermission
from apps.visits.serializers import ClinicalNotesUpdateSerializer, VisitDetailSerializer, VisitListSerializer
from apps.visits.services import VisitRuleError, complete_visit, update_clinical_notes


class VisitPagination(PageNumberPagination):
    page_size = 20


class VisitViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [VisitPermission]
    pagination_class = VisitPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Visit.objects.select_related(
            "appointment",
            "patient",
            "doctor",
            "created_by",
            "updated_by",
        ).all()
        user = self.request.user
        if user.is_authenticated and user.role == "DOCTOR":
            patient_id = self.request.query_params.get("patient_id")
            if self.action == "retrieve" or patient_id:
                queryset = queryset.filter(patient__in=get_patients_for_user(user))
            else:
                queryset = queryset.filter(doctor=user)

        doctor_id = self.request.query_params.get("doctor_id")
        patient_id = self.request.query_params.get("patient_id")
        appointment_id = self.request.query_params.get("appointment_id")
        visit_status = self.request.query_params.get("status")
        started_from = self.request.query_params.get("started_from")
        started_to = self.request.query_params.get("started_to")

        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if appointment_id:
            queryset = queryset.filter(appointment_id=appointment_id)
        if visit_status:
            queryset = queryset.filter(status=visit_status)
        if started_from:
            queryset = queryset.filter(started_at__gte=started_from)
        if started_to:
            queryset = queryset.filter(started_at__lte=started_to)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return VisitListSerializer
        if self.action == "clinical_notes":
            return ClinicalNotesUpdateSerializer
        return VisitDetailSerializer

    @action(detail=False, methods=["get"])
    def active(self, request):
        visit = self.get_queryset().filter(status=Visit.Status.ACTIVE).first()
        if not visit:
            return error_response("NO_ACTIVE_VISIT", "No active visit found.", status_code=status.HTTP_404_NOT_FOUND)
        return Response(VisitDetailSerializer(visit).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        visit = self.get_object()
        try:
            visit = complete_visit(visit=visit, user=request.user)
        except VisitRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="visit_completed",
            entity_type="visit",
            entity_id=visit.id,
            metadata={"visit_id": visit.id, "appointment_id": visit.appointment_id, "patient_id": visit.patient_id, "doctor_id": visit.doctor_id},
        )
        return Response(VisitDetailSerializer(visit).data)

    @action(detail=True, methods=["patch"], url_path="clinical-notes")
    def clinical_notes(self, request, pk=None):
        visit = self.get_object()
        allowed_fields = set(ClinicalNotesUpdateSerializer.Meta.fields)
        blocked_fields = sorted(set(request.data) - allowed_fields)
        if blocked_fields:
            return error_response(
                "VALIDATION_ERROR",
                "Some fields are invalid.",
                {field: ["This field cannot be changed here."] for field in blocked_fields},
            )

        serializer = self.get_serializer(visit, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        visit = update_clinical_notes(visit=visit, data=serializer.validated_data, user=request.user)
        log_activity(
            request=request,
            action="clinical_notes_updated",
            entity_type="visit",
            entity_id=visit.id,
            metadata={"visit_id": visit.id, "updated_fields": sorted(serializer.validated_data.keys())},
        )
        return Response(VisitDetailSerializer(visit).data)

    @action(detail=True, methods=["post"])
    def xrays(self, request, pk=None):
        from apps.xrays.serializers import XrayAttachmentSerializer
        from apps.xrays.services import XrayUploadError, create_xray_attachment

        visit = self.get_object()
        try:
            xray = create_xray_attachment(
                patient=visit.patient,
                visit=visit,
                uploaded_by=request.user,
                uploaded_file=request.FILES.get("file"),
                title=request.data.get("title", ""),
                notes=request.data.get("notes", ""),
            )
        except XrayUploadError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="xray_uploaded",
            entity_type="xray_attachment",
            entity_id=xray.id,
            metadata={"xray_id": xray.id, "patient_id": xray.patient_id, "visit_id": xray.visit_id, "source": xray.source},
        )
        return Response(XrayAttachmentSerializer(xray).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="billing-handoff")
    def billing_handoff(self, request, pk=None):
        from apps.billing.serializers import BillingHandoffCreateSerializer, BillingHandoffSerializer
        from apps.billing.services import BillingRuleError, create_billing_handoff

        visit = self.get_object()
        serializer = BillingHandoffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            handoff = create_billing_handoff(visit=visit, user=request.user, data=serializer.validated_data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="billing_handoff_created",
            entity_type="billing_handoff",
            entity_id=handoff.id,
            metadata={"handoff_id": handoff.id, "visit_id": handoff.visit_id, "patient_id": handoff.patient_id},
        )
        return Response(BillingHandoffSerializer(handoff).data, status=status.HTTP_201_CREATED)
