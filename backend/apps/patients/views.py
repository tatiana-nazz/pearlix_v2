from django.db.models import Case, IntegerField, Max, Q, Value, When
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
    get_doctor_related_patients,
    get_doctor_upcoming_patients,
    get_patients_for_user,
)
from apps.patients.services import (
    ArchiveBlocked,
    PatientVersionConflict,
    parse_required_version,
    set_patient_archive_state_with_version,
    update_patient_with_version,
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
                    .order_by("-last_visit_with_me_at", "first_name", "last_name", "id")
                    .distinct()
                )

        first_name = self.request.query_params.get("first_name")
        last_name = self.request.query_params.get("last_name")
        phone_number = self.request.query_params.get("phone_number") or self.request.query_params.get("phone")
        email = self.request.query_params.get("email")
        national_id_or_passport = self.request.query_params.get("national_id_or_passport")
        name = self.request.query_params.get("name")
        search = self.request.query_params.get("search")

        if first_name:
            queryset = queryset.filter(first_name__icontains=first_name)
        if last_name:
            queryset = queryset.filter(last_name__icontains=last_name)
        if phone_number:
            queryset = queryset.filter(phone_number__icontains=phone_number)
        if email:
            queryset = queryset.filter(email__icontains=email)
        if national_id_or_passport:
            queryset = queryset.filter(national_id_or_passport__icontains=national_id_or_passport)
        if name:
            queryset = self._filter_name(queryset, name)
        if search:
            queryset = (
                self._filter_search(queryset, search)
                .annotate(
                    contact_match_order=Case(
                        When(phone_number__icontains=search, then=Value(0)),
                        When(email__icontains=search, then=Value(0)),
                        When(national_id_or_passport__icontains=search, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                )
                .order_by("contact_match_order", "first_name", "last_name", "id")
            )

        return queryset

    def _filter_name(self, queryset, raw_value):
        value = raw_value.strip()
        if not value:
            return queryset
        parts = value.split()
        name_query = Q(first_name__icontains=value) | Q(last_name__icontains=value)
        if len(parts) >= 2:
            name_query |= Q(first_name__icontains=parts[0], last_name__icontains=parts[-1])
        return queryset.filter(name_query)

    def _filter_search(self, queryset, raw_value):
        value = raw_value.strip()
        if not value:
            return queryset
        search_query = (
            Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
            | Q(phone_number__icontains=value)
            | Q(email__icontains=value)
            | Q(national_id_or_passport__icontains=value)
        )
        parts = value.split()
        if len(parts) >= 2:
            search_query |= Q(first_name__icontains=parts[0], last_name__icontains=parts[-1])
        return queryset.filter(search_query)

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

    def update(self, request, *args, **kwargs):
        patient = self.get_object()
        version_response = self._required_version_response(request)
        if version_response:
            return version_response

        serializer = self.get_serializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated_data = dict(serializer.validated_data)
        submitted_version = validated_data.pop("version")
        try:
            patient = update_patient_with_version(
                patient=patient,
                validated_data=validated_data,
                submitted_version=submitted_version,
                user=request.user,
            )
        except PatientVersionConflict as exc:
            return exc.to_response()

        log_activity(
            request=request,
            action="patient_updated",
            entity_type="patient",
            entity_id=patient.id,
            metadata={"patient_id": patient.id, "updated_fields": sorted(key for key in request.data.keys() if key != "version")},
        )
        return Response(self.get_serializer(patient).data)

    def _required_version_response(self, request):
        if "version" not in request.data:
            return error_response("VERSION_REQUIRED", "Patient version is required.", {"field": "version"})
        try:
            parse_required_version(request.data.get("version"))
        except (TypeError, ValueError):
            return error_response("VERSION_REQUIRED", "Patient version is required.", {"field": "version"})
        return None

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        patient = self.get_object()
        version_response = self._required_version_response(request)
        if version_response:
            return version_response
        submitted_version = parse_required_version(request.data.get("version"))
        try:
            patient = set_patient_archive_state_with_version(
                patient=patient,
                is_archived=True,
                submitted_version=submitted_version,
                user=request.user,
            )
        except PatientVersionConflict as exc:
            return exc.to_response()
        except ArchiveBlocked as exc:
            return exc.to_response()
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
        version_response = self._required_version_response(request)
        if version_response:
            return version_response
        submitted_version = parse_required_version(request.data.get("version"))
        try:
            patient = set_patient_archive_state_with_version(
                patient=patient,
                is_archived=False,
                submitted_version=submitted_version,
                user=request.user,
            )
        except PatientVersionConflict as exc:
            return exc.to_response()
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
