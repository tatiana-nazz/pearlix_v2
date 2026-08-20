from datetime import date
from zoneinfo import ZoneInfo

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
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    cancel_appointment,
    check_in_appointment,
    create_appointment,
    mark_appointment_no_show,
    update_appointment,
)
from apps.scheduling.availability import build_availability_slots
from apps.scheduling.exception_services import (
    cancel_availability_exception,
    save_availability_exception,
    update_availability_exception,
)
from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift
from apps.scheduling.permissions import AppointmentPermission, AvailabilityExceptionPermission, ScheduleAdminPermission, WorkingShiftPermission
from apps.scheduling.serializers import AppointmentDetailSerializer, AppointmentListSerializer, AvailabilityExceptionSerializer, ClinicDefaultShiftSerializer, DoctorListSerializer, LegacyWorkingHoursReplaceSerializer, WorkingShiftSerializer
from apps.scheduling.schedule_services import (
    apply_default_schedule,
    copy_employee_schedule,
    create_working_shift,
    replace_employee_schedule,
    save_default_shift,
    set_default_shift_active,
    set_working_shift_active,
    update_default_shift,
    update_working_shift,
)
from apps.scheduling.time_utils import get_clinic_settings


User = get_user_model()


def _rule_error(exc): return exc.to_response()
def _employee_or_404(pk): return get_object_or_404(User, id=pk, role__in=[User.Role.DOCTOR, User.Role.STAFF])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctors_list(request):
    doctors = User.objects.filter(role=User.Role.DOCTOR, is_active=True).select_related("doctor_profile").order_by("full_name", "id")
    return Response(DoctorListSerializer(doctors, many=True).data)


def _can_read_doctor_schedule(user, doctor): return user.role in {"ADMIN", "STAFF"} or (user.role == "DOCTOR" and user.id == doctor.id)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def doctor_working_hours(request, doctor_id):
    doctor = get_object_or_404(User, id=doctor_id, role=User.Role.DOCTOR)
    if request.method == "GET":
        if not _can_read_doctor_schedule(request.user, doctor): return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
        shifts = WorkingShift.objects.filter(employee=doctor).order_by("weekday", "start_time", "id")
        return Response({"working_hours": WorkingShiftSerializer(shifts, many=True).data})
    if request.user.role != User.Role.ADMIN: return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
    serializer = LegacyWorkingHoursReplaceSerializer(data=request.data, context={"doctor": doctor}); serializer.is_valid(raise_exception=True)
    try:
        replace_employee_schedule(employee=doctor, schedule_rows=serializer.validated_data["working_hours"], user=request.user, confirm_appointment_impact=serializer.validated_data["confirm_appointment_impact"], request=request)
    except AppointmentRuleError as exc: return _rule_error(exc)
    shifts = WorkingShift.objects.filter(employee=doctor).order_by("weekday", "start_time", "id")
    return Response({"working_hours": WorkingShiftSerializer(shifts, many=True).data})


class ClinicDefaultShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ClinicDefaultShiftSerializer
    permission_classes = [ScheduleAdminPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]
    queryset = ClinicDefaultShift.objects.select_related("created_by", "updated_by").all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: instance = save_default_shift(serializer=serializer, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="clinic_default_shift_created", entity_type="clinic_default_shift", entity_id=instance.id, metadata={"weekday": instance.weekday})
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object(); serializer = self.get_serializer(instance, data=request.data, partial=True); serializer.is_valid(raise_exception=True)
        try: instance = update_default_shift(instance=instance, serializer=serializer, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="clinic_default_shift_updated", entity_type="clinic_default_shift", entity_id=instance.id, metadata={"weekday": instance.weekday})
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None): return self._set_active(request, True, "clinic_default_shift_activated")
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None): return self._set_active(request, False, "clinic_default_shift_deactivated")
    def _set_active(self, request, active, audit_action):
        instance = self.get_object()
        try: instance = set_default_shift_active(instance=instance, version=request.data.get("version"), is_active=active, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action=audit_action, entity_type="clinic_default_shift", entity_id=instance.id, metadata={"weekday": instance.weekday})
        return Response(self.get_serializer(instance).data)


class WorkingShiftViewSet(viewsets.ModelViewSet):
    serializer_class = WorkingShiftSerializer
    permission_classes = [WorkingShiftPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        query = WorkingShift.objects.select_related("employee", "created_by", "updated_by", "source_default_shift").all()
        user = self.request.user
        if user.is_authenticated and user.role in {User.Role.STAFF, User.Role.DOCTOR}: query = query.filter(employee=user)
        params = self.request.query_params
        if params.get("employee_id") and user.role == User.Role.ADMIN: query = query.filter(employee_id=params["employee_id"])
        if params.get("role") and user.role == User.Role.ADMIN: query = query.filter(employee__role=params["role"])
        if params.get("weekday") is not None: query = query.filter(weekday=params["weekday"])
        if params.get("is_active") in {"true", "false"}: query = query.filter(is_active=params["is_active"] == "true")
        return query

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: instance = create_working_shift(serializer=serializer, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="working_shift_created", entity_type="working_shift", entity_id=instance.id, metadata={"employee_id": instance.employee_id, "weekday": instance.weekday})
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object(); serializer = self.get_serializer(instance, data=request.data, partial=True); serializer.is_valid(raise_exception=True)
        try: instance, impacted = update_working_shift(instance=instance, serializer=serializer, user=request.user, confirm_appointment_impact=bool(request.data.get("confirm_appointment_impact")), request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="working_shift_updated", entity_type="working_shift", entity_id=instance.id, metadata={"employee_id": instance.employee_id, "weekday": instance.weekday, "impacted_appointments_count": impacted})
        return Response({**self.get_serializer(instance).data, "impacted_appointments_count": impacted})

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None): return self._set_active(request, True, "working_shift_activated")
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None): return self._set_active(request, False, "working_shift_deactivated")
    def _set_active(self, request, active, audit_action):
        instance = self.get_object()
        try: instance, impacted = set_working_shift_active(instance=instance, version=request.data.get("version"), is_active=active, user=request.user, confirm_appointment_impact=bool(request.data.get("confirm_appointment_impact")), request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action=audit_action, entity_type="working_shift", entity_id=instance.id, metadata={"employee_id": instance.employee_id, "impacted_appointments_count": impacted})
        return Response({**self.get_serializer(instance).data, "impacted_appointments_count": impacted})

    @action(detail=False, methods=["post"], url_path="apply-default")
    def apply_default(self, request):
        employee = _employee_or_404(request.data.get("employee_id"))
        try: result = apply_default_schedule(employee=employee, mode=request.data.get("mode"), user=request.user, confirm_appointment_impact=bool(request.data.get("confirm_appointment_impact")), request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="default_schedule_applied", entity_type="user", entity_id=employee.id, metadata={"employee_id": employee.id, "mode": request.data.get("mode"), **result})
        return Response({"employee": {"id": employee.id, "full_name": employee.full_name, "role": employee.role}, "mode": request.data.get("mode"), **result, "working_shifts": self.get_serializer(WorkingShift.objects.filter(employee=employee), many=True).data})

    @action(detail=False, methods=["post"], url_path="copy-schedule")
    def copy_schedule(self, request):
        source = _employee_or_404(request.data.get("source_employee_id")); target = _employee_or_404(request.data.get("target_employee_id"))
        try: result = copy_employee_schedule(source=source, target=target, mode=request.data.get("mode"), user=request.user, confirm_appointment_impact=bool(request.data.get("confirm_appointment_impact")), request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="employee_schedule_copied", entity_type="user", entity_id=target.id, metadata={"source_employee_id": source.id, "target_employee_id": target.id, "mode": request.data.get("mode"), **result})
        return Response({"employee": {"id": target.id, "full_name": target.full_name, "role": target.role}, "mode": request.data.get("mode"), **result, "working_shifts": self.get_serializer(WorkingShift.objects.filter(employee=target), many=True).data})


class AvailabilityExceptionViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilityExceptionSerializer; permission_classes = [AvailabilityExceptionPermission]; http_method_names = ["get", "post", "patch", "head", "options"]
    def get_queryset(self):
        query = AvailabilityException.objects.select_related("doctor", "staff", "created_by", "updated_by", "cancelled_by").all(); user = self.request.user
        if user.is_authenticated:
            if user.role == "DOCTOR": query = query.filter(doctor=user)
            elif user.role == "STAFF": query = query.filter(Q(doctor__isnull=False) | Q(staff=user))
        for field in ("doctor_id", "staff_id", "type"):
            if self.request.query_params.get(field): query = query.filter(**{field: self.request.query_params[field]})
        if self.request.query_params.get("start_from"): query = query.filter(start_datetime__gte=self.request.query_params["start_from"])
        if self.request.query_params.get("end_to"): query = query.filter(end_datetime__lte=self.request.query_params["end_to"])
        if self.request.query_params.get("is_cancelled") in {"true", "false"}: query = query.filter(is_cancelled=self.request.query_params["is_cancelled"] == "true")
        return query
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True); instance, marked = save_availability_exception(serializer=serializer, user=request.user, request=request)
        log_activity(request=request, action="availability_exception_created", entity_type="availability_exception", entity_id=instance.id, metadata={"doctor_id": instance.doctor_id, "staff_id": instance.staff_id, "marked_needs_reschedule_count": len(marked)})
        return Response({**self.get_serializer(instance).data, "marked_needs_reschedule_count": len(marked)}, status=status.HTTP_201_CREATED)
    def update(self, request, *args, **kwargs):
        instance = self.get_object(); serializer = self.get_serializer(instance, data=request.data, partial=True); serializer.is_valid(raise_exception=True)
        try: instance, marked = update_availability_exception(instance=instance, serializer=serializer, user=request.user, request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="availability_exception_updated", entity_type="availability_exception", entity_id=instance.id, metadata={"marked_needs_reschedule_count": len(marked)})
        return Response({**self.get_serializer(instance).data, "marked_needs_reschedule_count": len(marked)})
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try: instance, restored, blocked = cancel_availability_exception(availability_exception=self.get_object(), user=request.user, version=request.data.get("version"), request=request)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="availability_exception_cancelled", entity_type="availability_exception", entity_id=instance.id, metadata={"restored_appointments_count": len(restored), "still_blocked_appointments_count": len(blocked)})
        return Response({**self.get_serializer(instance).data, "restored_appointments_count": len(restored), "still_blocked_appointments_count": len(blocked)})


class AppointmentPagination(PageNumberPagination):
    page_size = 20

    def get_paginated_response(self, data):
        settings = get_clinic_settings()
        now = timezone.localtime(timezone.now(), ZoneInfo(settings.timezone))
        return Response({
            "count": self.page.paginator.count,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data,
            "clinic_date": now.date().isoformat(),
            "clinic_timezone": settings.timezone,
        })
class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentDetailSerializer; permission_classes = [AppointmentPermission]; pagination_class = AppointmentPagination; http_method_names = ["get", "post", "patch", "head", "options"]
    def get_queryset(self):
        query = Appointment.objects.select_related("patient", "doctor", "created_by", "updated_by", "reschedule_source_exception", "reschedule_source_working_shift").all()
        if self.request.user.is_authenticated and self.request.user.role == "DOCTOR": query = query.filter(doctor=self.request.user)
        for field in ("doctor_id", "patient_id", "status"):
            if self.request.query_params.get(field): query = query.filter(**{field: self.request.query_params[field]})
        if self.request.query_params.get("date"): query = query.filter(start_datetime__date=self.request.query_params["date"])
        if self.request.query_params.get("start_from"): query = query.filter(start_datetime__gte=self.request.query_params["start_from"])
        if self.request.query_params.get("start_to"): query = query.filter(start_datetime__lte=self.request.query_params["start_to"])
        if self.request.query_params.get("search"):
            term = self.request.query_params["search"]
            query = query.filter(Q(patient__first_name__icontains=term) | Q(patient__last_name__icontains=term) | Q(patient__phone_number__icontains=term))
        return query
    def get_serializer_class(self): return AppointmentListSerializer if self.action == "list" else AppointmentDetailSerializer
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: instance = create_appointment(serializer=serializer, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="appointment_created", entity_type="appointment", entity_id=instance.id, metadata={"appointment_id": instance.id, "patient_id": instance.patient_id, "doctor_id": instance.doctor_id})
        return Response(AppointmentDetailSerializer(instance).data, status=status.HTTP_201_CREATED)
    def update(self, request, *args, **kwargs):
        if "status" in request.data: return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"status": ["Use appointment status action endpoints."]})
        instance = self.get_object(); old = instance.status; serializer = self.get_serializer(instance, data=request.data, partial=kwargs.pop("partial", False)); serializer.is_valid(raise_exception=True)
        try: instance = update_appointment(appointment=instance, serializer=serializer, user=request.user)
        except AppointmentRuleError as exc: return _rule_error(exc)
        log_activity(request=request, action="appointment_rescheduled" if old == Appointment.Status.NEEDS_RESCHEDULE else "appointment_updated", entity_type="appointment", entity_id=instance.id, metadata={"appointment_id": instance.id})
        return Response(AppointmentDetailSerializer(instance).data)
    def partial_update(self, request, *args, **kwargs): kwargs["partial"] = True; return self.update(request, *args, **kwargs)
    def _transition(self, request, command):
        try:
            instance = command(appointment=self.get_object(), user=request.user, request=request)
        except AppointmentRuleError as exc:
            return _rule_error(exc)
        return Response(AppointmentDetailSerializer(instance).data)
    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None): return self._transition(request, check_in_appointment)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None): return self._transition(request, cancel_appointment)
    @action(detail=True, methods=["post"], url_path="no-show")
    def no_show(self, request, pk=None): return self._transition(request, mark_appointment_no_show)
    @action(detail=True, methods=["post"], url_path="start-visit")
    def start_visit(self, request, pk=None):
        from apps.visits.serializers import VisitDetailSerializer
        from apps.visits.services import VisitRuleError, start_visit_from_appointment
        try:
            visit = start_visit_from_appointment(appointment=self.get_object(), user=request.user)
        except VisitRuleError as exc:
            return exc.to_response()
        log_activity(request=request, action="visit_started", entity_type="visit", entity_id=visit.id, metadata={"visit_id": visit.id, "appointment_id": visit.appointment_id})
        return Response(VisitDetailSerializer(visit).data, status=status.HTTP_201_CREATED)
    @action(detail=False, methods=["get"])
    def availability(self, request):
        doctor_id, date_text, duration = request.query_params.get("doctor_id"), request.query_params.get("date"), request.query_params.get("duration_minutes")
        if not doctor_id or not date_text: return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"doctor_id": ["This field is required."], "date": ["This field is required."]})
        doctor = get_object_or_404(User, id=doctor_id, role=User.Role.DOCTOR, is_active=True)
        if request.user.role == "DOCTOR" and request.user.id != doctor.id: return error_response("PERMISSION_DENIED", "You do not have permission to perform this action.", status_code=status.HTTP_403_FORBIDDEN)
        try:
            value = date.fromisoformat(date_text)
        except ValueError:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"date": ["Invalid date."]})
        try:
            minutes = int(duration) if duration else get_clinic_settings().default_appointment_duration_minutes
        except ValueError:
            return error_response("VALIDATION_ERROR", "Some fields are invalid.", {"duration_minutes": ["Invalid duration."]})
        try:
            slots = build_availability_slots(doctor=doctor, date_value=value, duration_minutes=minutes)
        except AppointmentRuleError as exc:
            return _rule_error(exc)
        settings = get_clinic_settings(); return Response({"doctor_id": doctor.id, "date": value.isoformat(), "duration_minutes": minutes, "capacity_per_slot": settings.capacity_per_slot, "clinic_closed": settings.is_weekday_closed(value.weekday()), "available_slots": slots})
