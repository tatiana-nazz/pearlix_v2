from django.db.models import Case, IntegerField, Max, Q, Value, When
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework import mixins, status, viewsets

from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.patients.models import Patient
from apps.patients.permissions import PatientPermission
from apps.patients.serializers import PatientDetailSerializer, PatientListSerializer
from apps.patients.selectors import (
    ARCHIVE_BLOCKING_APPOINTMENT_STATUSES,
    get_doctor_related_patients,
    get_doctor_upcoming_patients,
    get_patients_for_user,
    patient_has_archive_blocking_appointments,
)


class PatientPagination(PageNumberPagination):
    page_size = 20


class PatientViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [PatientPermission]
    pagination_class = PatientPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = get_patients_for_user(self.request.user)
        user = self.request.user

        is_archived = self.request.query_params.get("is_archived")
        if self.action == "list" and user.role in {"ADMIN", "STAFF"} and is_archived is None:
            queryset = queryset.filter(is_archived=False)
        elif user.role in {"ADMIN", "STAFF"} and is_archived and is_archived.lower() in {"true", "1", "yes"}:
            queryset = queryset.filter(is_archived=True)
        elif user.role in {"ADMIN", "STAFF"} and is_archived and is_archived.lower() in {"false", "0", "no"}:
            queryset = queryset.filter(is_archived=False)

        if user.is_authenticated and user.role == "DOCTOR":
            if self.request.query_params.get("my_patients", "").lower() in {"true", "1", "yes"}:
                queryset = queryset.filter(id__in=get_doctor_related_patients(user).values("id"))
            if self.request.query_params.get("upcoming_with_me", "").lower() in {"true", "1", "yes"}:
                queryset = queryset.filter(id__in=get_doctor_upcoming_patients(user).values("id"))
            if self.request.query_params.get("last_visit_with_me", "").lower() in {"true", "1", "yes"}:
                queryset = (
                    queryset.filter(visits__doctor=user)
                    .annotate(last_visit_with_me_at=Max("visits__started_at", filter=Q(visits__doctor=user)))
                    .order_by("-last_visit_with_me_at", "full_name", "id")
                    .distinct()
                )

        phone = self.request.query_params.get("phone")
        name = self.request.query_params.get("name")
        search = self.request.query_params.get("search")

        if phone:
            queryset = queryset.filter(phone__icontains=phone)
        if name:
            queryset = queryset.filter(full_name__icontains=name)
        if search:
            queryset = (
                queryset.filter(Q(phone__icontains=search) | Q(full_name__icontains=search))
                .annotate(
                    phone_match_order=Case(
                        When(phone__icontains=search, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                )
                .order_by("phone_match_order", "full_name", "id")
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientDetailSerializer

    def perform_create(self, serializer):
        patient = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_activity(
            request=self.request,
            action="patient_created",
            entity_type="patient",
            entity_id=patient.id,
            metadata={"patient_id": patient.id},
        )

    def perform_update(self, serializer):
        was_archived = serializer.instance.is_archived
        patient = serializer.save(updated_by=self.request.user)
        if patient.is_archived != was_archived:
            action_name = "patient_archived" if patient.is_archived else "patient_unarchived"
            log_activity(
                request=self.request,
                action=action_name,
                entity_type="patient",
                entity_id=patient.id,
                metadata={"patient_id": patient.id},
            )
            return
        log_activity(
            request=self.request,
            action="patient_updated",
            entity_type="patient",
            entity_id=patient.id,
            metadata={"patient_id": patient.id, "updated_fields": sorted(self.request.data.keys())},
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        patient = self.get_object()
        if patient.is_archived:
            return Response(PatientDetailSerializer(patient, context=self.get_serializer_context()).data)
        if patient_has_archive_blocking_appointments(patient):
            blocked = ", ".join(ARCHIVE_BLOCKING_APPOINTMENT_STATUSES)
            return error_response(
                "ARCHIVE_BLOCKED",
                "Patient cannot be archived while active operational appointments exist.",
                {"blocking_statuses": list(ARCHIVE_BLOCKING_APPOINTMENT_STATUSES), "message": f"Blocked statuses: {blocked}."},
                status_code=status.HTTP_409_CONFLICT,
            )
        patient.is_archived = True
        patient.updated_by = request.user
        patient.save(update_fields=["is_archived", "updated_by", "updated_at"])
        log_activity(
            request=request,
            action="patient_archived",
            entity_type="patient",
            entity_id=patient.id,
            metadata={"patient_id": patient.id},
        )
        return Response(PatientDetailSerializer(patient, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        patient = self.get_object()
        if patient.is_archived:
            patient.is_archived = False
            patient.updated_by = request.user
            patient.save(update_fields=["is_archived", "updated_by", "updated_at"])
            log_activity(
                request=request,
                action="patient_unarchived",
                entity_type="patient",
                entity_id=patient.id,
                metadata={"patient_id": patient.id},
            )
        return Response(PatientDetailSerializer(patient, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get"])
    def visits(self, request, pk=None):
        from apps.visits.models import Visit
        from apps.visits.serializers import VisitListSerializer

        patient = self.get_object()
        queryset = Visit.objects.select_related("appointment", "patient", "doctor").filter(patient=patient)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = VisitListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = VisitListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"])
    def xrays(self, request, pk=None):
        from apps.visits.models import Visit
        from apps.xrays.models import XrayAttachment
        from apps.xrays.serializers import XrayAttachmentSerializer
        from apps.xrays.services import XrayUploadError, create_xray_attachment

        patient = self.get_object()
        if request.method == "POST":
            if request.user.role != "DOCTOR":
                return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
            try:
                xray = create_xray_attachment(
                    patient=patient,
                    visit=None,
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
                metadata={"xray_id": xray.id, "patient_id": patient.id, "source": xray.source},
            )
            return Response(XrayAttachmentSerializer(xray).data, status=status.HTTP_201_CREATED)

        queryset = XrayAttachment.objects.select_related("patient", "visit", "uploaded_by", "ai_result").filter(patient=patient)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = XrayAttachmentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = XrayAttachmentSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="ai-results")
    def ai_results(self, request, pk=None):
        from apps.ai_results.models import AIResult
        from apps.ai_results.serializers import AIResultSerializer

        patient = self.get_object()
        queryset = AIResult.objects.select_related("xray_attachment", "xray_attachment__patient", "xray_attachment__visit").filter(
            xray_attachment__patient=patient
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AIResultSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AIResultSerializer(queryset, many=True)
        return Response(serializer.data)
