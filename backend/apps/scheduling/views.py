from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.common.errors import error_response
from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour
from apps.scheduling.permissions import AppointmentPermission, AvailabilityExceptionPermission
from apps.scheduling.serializers import (
    AppointmentDetailSerializer,
    AppointmentListSerializer,
    AvailabilityExceptionSerializer,
    DoctorListSerializer,
    WorkingHourReplaceSerializer,
    WorkingHourSerializer,
)
from apps.scheduling.services import (
    AppointmentRuleError,
    build_availability_slots,
    cancel_availability_exception,
    create_appointment,
    get_clinic_settings,
    save_availability_exception,
    update_appointment,
    update_availability_exception,
)


User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctors_list(request):
    doctors = User.objects.filter(role=User.Role.DOCTOR, is_active=True).select_related("doctor_profile").order_by("full_name", "id")
    return Response(DoctorListSerializer(doctors, many=True).data)


def _get_doctor_or_404(doctor_id):
    return get_object_or_404(User, id=doctor_id, role=User.Role.DOCTOR)


def _can_read_working_hours(user, doctor):
    if user.role in {"ADMIN", "STAFF"}:
        return True
    return user.role == "DOCTOR" and user.id == doctor.id


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def doctor_working_hours(request, doctor_id):
    doctor = _get_doctor_or_404(doctor_id)
    if request.method == "GET":
        if not _can_read_working_hours(request.user, doctor):
            return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
        hours = WorkingHour.objects.filter(doctor=doctor)
        return Response({"working_hours": WorkingHourSerializer(hours, many=True).data})

    if request.user.role != "ADMIN":
        return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)

    serializer = WorkingHourReplaceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    hours = serializer.save(doctor=doctor)
    return Response({"working_hours": WorkingHourSerializer(hours, many=True).data})


class AvailabilityExceptionViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilityExceptionSerializer
    permission_classes = [AvailabilityExceptionPermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = AvailabilityException.objects.select_related("doctor", "staff", "created_by", "updated_by", "cancelled_by").all()
        user = self.request.user
        if user.is_authenticated:
            if user.role == "DOCTOR":
                queryset = queryset.filter(doctor=user)
            elif user.role == "STAFF":
                queryset = queryset.filter(Q(doctor__isnull=False) | Q(staff=user))

        doctor_id = self.request.query_params.get("doctor_id")
        staff_id = self.request.query_params.get("staff_id")
        exception_type = self.request.query_params.get("type")
        start_from = self.request.query_params.get("start_from")
        end_to = self.request.query_params.get("end_to")

        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if staff_id:
            queryset = queryset.filter(staff_id=staff_id)
        if exception_type:
            queryset = queryset.filter(type=exception_type)
        if start_from:
            queryset = queryset.filter(start_datetime__gte=start_from)
        if end_to:
            queryset = queryset.filter(end_datetime__lte=end_to)
        return queryset

    def perform_create(self, serializer):
        availability_exception, marked = save_availability_exception(
            serializer=serializer,
            user=self.request.user,
            request=self.request,
        )
        log_activity(
            request=self.request,
            action="availability_exception_created",
            entity_type="availability_exception",
            entity_id=availability_exception.id,
            metadata={
                "availability_exception_id": availability_exception.id,
                "doctor_id": availability_exception.doctor_id,
                "staff_id": availability_exception.staff_id,
                "marked_needs_reschedule_count": len(marked),
            },
        )

    def perform_update(self, serializer):
        availability_exception, marked = update_availability_exception(
            serializer=serializer,
            user=self.request.user,
            request=self.request,
        )
        log_activity(
            request=self.request,
            action="availability_exception_updated",
            entity_type="availability_exception",
            entity_id=availability_exception.id,
            metadata={
                "availability_exception_id": availability_exception.id,
                "doctor_id": availability_exception.doctor_id,
                "staff_id": availability_exception.staff_id,
                "marked_needs_reschedule_count": len(marked),
            },
        )

    def destroy(self, request, *args, **kwargs):
        return error_response(
            "METHOD_NOT_ALLOWED",
            "Availability exceptions must be cancelled, not deleted.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        availability_exception = self.get_object()
        try:
            availability_exception, restored, still_blocked = cancel_availability_exception(
                availability_exception=availability_exception,
                user=request.user,
                request=request,
            )
        except AppointmentRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="availability_exception_cancelled",
            entity_type="availability_exception",
            entity_id=availability_exception.id,
            metadata={
                "availability_exception_id": availability_exception.id,
                "doctor_id": availability_exception.doctor_id,
                "staff_id": availability_exception.staff_id,
                "restored_appointments_count": len(restored),
                "still_blocked_appointments_count": len(still_blocked),
            },
        )
        return Response(
            {
                **AvailabilityExceptionSerializer(availability_exception).data,
                "restored_appointments_count": len(restored),
                "still_blocked_appointments_count": len(still_blocked),
            }
        )


class AppointmentPagination(PageNumberPagination):
    page_size = 20


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentDetailSerializer
    permission_classes = [AppointmentPermission]
    pagination_class = AppointmentPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Appointment.objects.select_related("patient", "doctor", "created_by", "updated_by").all()
        user = self.request.user
        if user.is_authenticated and user.role == "DOCTOR":
            queryset = queryset.filter(doctor=user)

        doctor_id = self.request.query_params.get("doctor_id")
        patient_id = self.request.query_params.get("patient_id")
        appointment_status = self.request.query_params.get("status")
        date_value = self.request.query_params.get("date")
        start_from = self.request.query_params.get("start_from")
        start_to = self.request.query_params.get("start_to")

        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if appointment_status:
            queryset = queryset.filter(status=appointment_status)
        if date_value:
            queryset = queryset.filter(start_datetime__date=date_value)
        if start_from:
            queryset = queryset.filter(start_datetime__gte=start_from)
        if start_to:
            queryset = queryset.filter(start_datetime__lte=start_to)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return AppointmentListSerializer
        return AppointmentDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            appointment = create_appointment(serializer=serializer, user=request.user)
        except AppointmentRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="appointment_created",
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={"appointment_id": appointment.id, "patient_id": appointment.patient_id, "doctor_id": appointment.doctor_id},
        )
        return Response(AppointmentDetailSerializer(appointment).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if "status" in request.data:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"status": ["Use appointment status action endpoints."]})
        partial = kwargs.pop("partial", False)
        appointment = self.get_object()
        old_status = appointment.status
        serializer = self.get_serializer(appointment, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            appointment = update_appointment(appointment=appointment, serializer=serializer, user=request.user)
        except AppointmentRuleError as exc:
            return exc.to_response()
        action_name = "appointment_rescheduled" if old_status == Appointment.Status.NEEDS_RESCHEDULE and appointment.status == Appointment.Status.UPCOMING else "appointment_updated"
        log_activity(
            request=request,
            action=action_name,
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={"appointment_id": appointment.id, "updated_fields": sorted(request.data.keys())},
        )
        return Response(AppointmentDetailSerializer(appointment).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def _transition(self, request, pk, *, allowed_statuses, target_status, timestamp_field, audit_action):
        appointment = self.get_object()
        if appointment.status not in allowed_statuses:
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Invalid appointment status transition.",
                status_code=status.HTTP_409_CONFLICT,
            )
        appointment.status = target_status
        setattr(appointment, timestamp_field, timezone.now())
        appointment.updated_by = request.user
        appointment.save(update_fields=["status", timestamp_field, "updated_by", "updated_at"])
        log_activity(
            request=request,
            action=audit_action,
            entity_type="appointment",
            entity_id=appointment.id,
            metadata={"appointment_id": appointment.id, "patient_id": appointment.patient_id, "doctor_id": appointment.doctor_id},
        )
        return Response(AppointmentDetailSerializer(appointment).data)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        return self._transition(
            request,
            pk,
            allowed_statuses=[Appointment.Status.UPCOMING],
            target_status=Appointment.Status.CHECKED_IN,
            timestamp_field="checked_in_at",
            audit_action="appointment_checked_in",
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(
            request,
            pk,
            allowed_statuses=[Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN],
            target_status=Appointment.Status.CANCELLED,
            timestamp_field="cancelled_at",
            audit_action="appointment_cancelled",
        )

    @action(detail=True, methods=["post"], url_path="no-show")
    def no_show(self, request, pk=None):
        return self._transition(
            request,
            pk,
            allowed_statuses=[Appointment.Status.UPCOMING],
            target_status=Appointment.Status.NO_SHOW,
            timestamp_field="no_show_at",
            audit_action="appointment_marked_no_show",
        )

    @action(detail=True, methods=["post"], url_path="start-visit")
    def start_visit(self, request, pk=None):
        from apps.visits.serializers import VisitDetailSerializer
        from apps.visits.services import VisitRuleError, start_visit_from_appointment

        appointment = self.get_object()
        try:
            visit = start_visit_from_appointment(appointment=appointment, user=request.user)
        except VisitRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="visit_started",
            entity_type="visit",
            entity_id=visit.id,
            metadata={"visit_id": visit.id, "appointment_id": appointment.id, "patient_id": visit.patient_id, "doctor_id": visit.doctor_id},
        )
        return Response(VisitDetailSerializer(visit).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def availability(self, request):
        doctor_id = request.query_params.get("doctor_id")
        date_text = request.query_params.get("date")
        duration = request.query_params.get("duration_minutes")
        if not doctor_id or not date_text:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"doctor_id": ["This field is required."], "date": ["This field is required."]})
        doctor = get_object_or_404(User, id=doctor_id, role=User.Role.DOCTOR, is_active=True)
        if request.user.role == "DOCTOR" and request.user.id != doctor.id:
            return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
        try:
            date_value = date.fromisoformat(date_text)
        except ValueError:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"date": ["Use YYYY-MM-DD."]})

        try:
            duration_minutes = int(duration) if duration else get_clinic_settings().default_appointment_duration_minutes
            slots = build_availability_slots(doctor=doctor, date_value=date_value, duration_minutes=duration_minutes)
        except (ValueError, AppointmentRuleError) as exc:
            if isinstance(exc, AppointmentRuleError):
                return exc.to_response()
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"duration_minutes": ["Invalid duration."]})

        settings = get_clinic_settings()
        return Response(
            {
                "doctor_id": doctor.id,
                "date": date_value.isoformat(),
                "duration_minutes": duration_minutes,
                "capacity_per_slot": settings.capacity_per_slot,
                "available_slots": slots,
            }
        )
