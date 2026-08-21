from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection
from django.db.models.query import QuerySet

from apps.accounts.models import User
from apps.clinic.models import ClinicSettings
from apps.scheduling import schedule_services, views as scheduling_views
from apps.scheduling.appointment_services import AppointmentRuleError
from apps.scheduling.exception_services import (
    save_availability_exception,
    update_availability_exception,
)
from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift
from apps.scheduling.schedule_services import (
    _mark_shift_impacts,
    create_working_shift,
    replace_employee_schedule,
)
from apps.scheduling.serializers import WorkingShiftSerializer


def add_shift(employee, weekday=0, start="09:00", end="17:00", name="Shift 1"):
    return WorkingShift.objects.create(
        employee=employee,
        name=name,
        weekday=weekday,
        start_time=start,
        end_time=end,
        is_active=True,
    )


def leave_payload(doctor, start, end, **overrides):
    payload = {
        "doctor_id": doctor.id,
        "start_datetime": start,
        "end_datetime": end,
        "type": AvailabilityException.Type.UNAVAILABLE,
        "reason": "Phase 3 reconciliation leave",
    }
    payload.update(overrides)
    return payload


def override_payload(doctor, start, end, **overrides):
    return leave_payload(
        doctor,
        start,
        end,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        reason="Approved extra availability",
        **overrides,
    )


class CreateModelStub:
    def __init__(self, model, validated_data):
        self.model = model
        self.validated_data = validated_data

    def save(self, **kwargs):
        return self.model.objects.create(**{**self.validated_data, **kwargs})


@pytest.mark.django_db
def test_available_override_create_restores_schedule_sourced_appointment(
    admin_client,
    doctor_user,
    appointment_factory,
):
    appointment = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        reschedule_previous_status=Appointment.Status.UPCOMING,
        reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
        start_datetime="2026-07-20T18:00:00+03:00",
        end_datetime="2026-07-20T18:30:00+03:00",
    )

    response = admin_client.post(
        "/api/availability-exceptions/",
        override_payload(
            doctor_user,
            "2026-07-20T18:00:00+03:00",
            "2026-07-20T19:00:00+03:00",
        ),
        format="json",
    )

    assert response.status_code == 201
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_previous_status is None
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_available_override_expand_shrink_move_and_cancel_reconcile_both_windows(
    admin_client,
    doctor_user,
    appointment_factory,
):
    monday = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        reschedule_previous_status=Appointment.Status.UPCOMING,
        reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
        start_datetime="2026-07-20T18:30:00+03:00",
        end_datetime="2026-07-20T19:00:00+03:00",
    )
    tuesday = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        reschedule_previous_status=Appointment.Status.CHECKED_IN,
        reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
        start_datetime="2026-07-21T18:30:00+03:00",
        end_datetime="2026-07-21T19:00:00+03:00",
    )
    availability_override = AvailabilityException.objects.create(
        doctor=doctor_user,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        start_datetime="2026-07-20T18:00:00+03:00",
        end_datetime="2026-07-20T18:15:00+03:00",
        reason="Initially narrow override",
    )

    expanded = admin_client.patch(
        f"/api/availability-exceptions/{availability_override.id}/",
        {"end_datetime": "2026-07-20T19:00:00+03:00", "version": 1},
        format="json",
    )
    assert expanded.status_code == 200
    monday.refresh_from_db()
    assert monday.status == Appointment.Status.UPCOMING

    shrunk = admin_client.patch(
        f"/api/availability-exceptions/{availability_override.id}/",
        {
            "end_datetime": "2026-07-20T18:45:00+03:00",
            "version": expanded.data["version"],
        },
        format="json",
    )
    assert shrunk.status_code == 200
    monday.refresh_from_db()
    assert monday.status == Appointment.Status.NEEDS_RESCHEDULE
    assert monday.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE

    reexpanded = admin_client.patch(
        f"/api/availability-exceptions/{availability_override.id}/",
        {
            "end_datetime": "2026-07-20T19:00:00+03:00",
            "version": shrunk.data["version"],
        },
        format="json",
    )
    assert reexpanded.status_code == 200
    monday.refresh_from_db()
    assert monday.status == Appointment.Status.UPCOMING

    moved = admin_client.patch(
        f"/api/availability-exceptions/{availability_override.id}/",
        {
            "start_datetime": "2026-07-21T18:00:00+03:00",
            "end_datetime": "2026-07-21T19:00:00+03:00",
            "version": reexpanded.data["version"],
        },
        format="json",
    )
    assert moved.status_code == 200
    monday.refresh_from_db()
    tuesday.refresh_from_db()
    assert monday.status == Appointment.Status.NEEDS_RESCHEDULE
    assert monday.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
    assert tuesday.status == Appointment.Status.CHECKED_IN
    assert tuesday.reschedule_source_kind is None

    cancelled = admin_client.post(
        f"/api/availability-exceptions/{availability_override.id}/cancel/",
        {"version": str(moved.data["version"])},
    )
    assert cancelled.status_code == 200
    tuesday.refresh_from_db()
    assert tuesday.status == Appointment.Status.NEEDS_RESCHEDULE
    assert tuesday.reschedule_previous_status == Appointment.Status.CHECKED_IN
    assert tuesday.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE


@pytest.mark.django_db
def test_available_override_never_restores_through_closure_or_unavailable_leave(
    admin_client,
    doctor_user,
    appointment_factory,
):
    settings = ClinicSettings.get_solo()
    settings.weekly_closed_days = [0, 4]
    settings.save(update_fields=["weekly_closed_days", "updated_at"])
    closed_appointment = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        reschedule_previous_status=Appointment.Status.UPCOMING,
        reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
        start_datetime="2026-07-20T18:00:00+03:00",
        end_datetime="2026-07-20T18:30:00+03:00",
    )

    closed_override = admin_client.post(
        "/api/availability-exceptions/",
        override_payload(
            doctor_user,
            "2026-07-20T18:00:00+03:00",
            "2026-07-20T19:00:00+03:00",
        ),
        format="json",
    )
    assert closed_override.status_code == 201
    closed_appointment.refresh_from_db()
    assert closed_appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert closed_appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.CLINIC_WEEKLY_CLOSURE

    leave = AvailabilityException.objects.create(
        doctor=doctor_user,
        type=AvailabilityException.Type.UNAVAILABLE,
        start_datetime="2026-07-21T18:00:00+03:00",
        end_datetime="2026-07-21T19:00:00+03:00",
        reason="Leave remains authoritative",
    )
    leave_appointment = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        reschedule_previous_status=Appointment.Status.UPCOMING,
        reschedule_source_kind=Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE,
        start_datetime="2026-07-21T18:00:00+03:00",
        end_datetime="2026-07-21T18:30:00+03:00",
    )
    leave_override = admin_client.post(
        "/api/availability-exceptions/",
        override_payload(
            doctor_user,
            "2026-07-21T18:00:00+03:00",
            "2026-07-21T19:00:00+03:00",
        ),
        format="json",
    )
    assert leave_override.status_code == 201
    leave_appointment.refresh_from_db()
    assert leave_appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert leave_appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.LEAVE
    assert leave_appointment.reschedule_source_exception_id == leave.id


@pytest.mark.django_db
def test_timezone_change_marks_new_schedule_gap_and_reverse_change_restores(
    admin_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0, start="00:00", end="02:00")
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T00:30:00+03:00",
        end_datetime="2026-07-20T01:00:00+03:00",
    )

    preview = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "UTC"},
        format="json",
    )
    assert preview.status_code == 409
    assert preview.data["code"] == "CLINIC_TIMEZONE_CHANGE_REQUIRES_CONFIRMATION"
    assert preview.data["details"]["impacted_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING

    confirmed = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "UTC", "confirm_appointment_impact": True},
        format="json",
    )
    assert confirmed.status_code == 200
    assert confirmed.data["affected_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_previous_status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE

    reversed_timezone = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "Asia/Damascus"},
        format="json",
    )
    assert reversed_timezone.status_code == 200
    assert reversed_timezone.data["restored_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_previous_status is None
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_leave_edit_reconciles_expand_shrink_move_target_type_and_cancel(
    admin_client,
    doctor_user,
    other_doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    add_shift(doctor_user, 1)
    add_shift(other_doctor_user, 1)
    monday_nine = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    monday_ten = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    tuesday_nine = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-21T09:00:00+03:00",
        end_datetime="2026-07-21T09:30:00+03:00",
    )
    other_tuesday_nine = appointment_factory(
        doctor=other_doctor_user,
        start_datetime="2026-07-21T09:00:00+03:00",
        end_datetime="2026-07-21T09:30:00+03:00",
    )
    outside = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T12:00:00+03:00",
        end_datetime="2026-07-20T12:30:00+03:00",
    )

    created = admin_client.post(
        "/api/availability-exceptions/",
        leave_payload(
            doctor_user,
            "2026-07-20T09:00:00+03:00",
            "2026-07-20T09:30:00+03:00",
        ),
        format="json",
    )
    assert created.status_code == 201
    assert created.data["marked_needs_reschedule_count"] == 1
    monday_nine.refresh_from_db()
    outside.refresh_from_db()
    assert monday_nine.status == Appointment.Status.NEEDS_RESCHEDULE
    assert monday_nine.reschedule_source_kind == Appointment.RescheduleSourceKind.LEAVE
    assert outside.status == Appointment.Status.UPCOMING

    expanded = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "end_datetime": "2026-07-20T10:30:00+03:00",
            "version": created.data["version"],
        },
        format="json",
    )
    assert expanded.status_code == 200
    assert expanded.data["marked_needs_reschedule_count"] == 1
    monday_ten.refresh_from_db()
    assert monday_ten.status == Appointment.Status.NEEDS_RESCHEDULE
    assert monday_ten.reschedule_previous_status == Appointment.Status.CHECKED_IN

    shrunk = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "end_datetime": "2026-07-20T09:30:00+03:00",
            "version": expanded.data["version"],
        },
        format="json",
    )
    assert shrunk.status_code == 200
    monday_ten.refresh_from_db()
    assert monday_ten.status == Appointment.Status.CHECKED_IN
    assert monday_ten.reschedule_source_kind is None

    moved_same_day = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "start_datetime": "2026-07-20T10:00:00+03:00",
            "end_datetime": "2026-07-20T10:30:00+03:00",
            "version": shrunk.data["version"],
        },
        format="json",
    )
    assert moved_same_day.status_code == 200
    monday_nine.refresh_from_db()
    monday_ten.refresh_from_db()
    assert monday_nine.status == Appointment.Status.UPCOMING
    assert monday_ten.status == Appointment.Status.NEEDS_RESCHEDULE

    moved_day = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "start_datetime": "2026-07-21T09:00:00+03:00",
            "end_datetime": "2026-07-21T09:30:00+03:00",
            "version": moved_same_day.data["version"],
        },
        format="json",
    )
    assert moved_day.status_code == 200
    monday_ten.refresh_from_db()
    tuesday_nine.refresh_from_db()
    assert monday_ten.status == Appointment.Status.CHECKED_IN
    assert tuesday_nine.status == Appointment.Status.NEEDS_RESCHEDULE

    changed_target = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "doctor_id": other_doctor_user.id,
            "version": moved_day.data["version"],
        },
        format="json",
    )
    assert changed_target.status_code == 200
    tuesday_nine.refresh_from_db()
    other_tuesday_nine.refresh_from_db()
    assert tuesday_nine.status == Appointment.Status.UPCOMING
    assert other_tuesday_nine.status == Appointment.Status.NEEDS_RESCHEDULE

    available = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "type": AvailabilityException.Type.AVAILABLE_OVERRIDE,
            "version": changed_target.data["version"],
        },
        format="json",
    )
    assert available.status_code == 200
    other_tuesday_nine.refresh_from_db()
    assert other_tuesday_nine.status == Appointment.Status.UPCOMING
    assert other_tuesday_nine.reschedule_source_kind is None

    unavailable = admin_client.patch(
        f"/api/availability-exceptions/{created.data['id']}/",
        {
            "type": AvailabilityException.Type.UNAVAILABLE,
            "version": available.data["version"],
        },
        format="json",
    )
    assert unavailable.status_code == 200
    other_tuesday_nine.refresh_from_db()
    assert other_tuesday_nine.status == Appointment.Status.NEEDS_RESCHEDULE

    cancelled = admin_client.post(
        f"/api/availability-exceptions/{created.data['id']}/cancel/",
        {"version": unavailable.data["version"]},
        format="json",
    )
    assert cancelled.status_code == 200
    assert cancelled.data["restored_appointments_count"] == 1
    other_tuesday_nine.refresh_from_db()
    assert other_tuesday_nine.status == Appointment.Status.UPCOMING
    assert other_tuesday_nine.reschedule_source_kind is None


@pytest.mark.django_db
def test_leave_cancel_reattributes_to_closure_then_reopen_restores(
    admin_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    leave = admin_client.post(
        "/api/availability-exceptions/",
        leave_payload(
            doctor_user,
            "2026-07-20T09:00:00+03:00",
            "2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )
    closed = admin_client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": [0, 4]},
        format="json",
    )
    cancelled = admin_client.post(
        f"/api/availability-exceptions/{leave.data['id']}/cancel/",
        {"version": leave.data["version"]},
        format="json",
    )

    assert closed.status_code == 200
    assert cancelled.status_code == 200
    assert cancelled.data["still_blocked_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.CLINIC_WEEKLY_CLOSURE
    assert appointment.reschedule_source_clinic_weekday == 0
    assert appointment.reschedule_source_exception_id is None

    reopened = admin_client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": [4]},
        format="json",
    )
    assert reopened.status_code == 200
    assert reopened.data["restored_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_leave_cancel_reattributes_to_schedule_change_then_shift_reactivation_restores(
    admin_client,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    leave = admin_client.post(
        "/api/availability-exceptions/",
        leave_payload(
            doctor_user,
            "2026-07-20T09:00:00+03:00",
            "2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )
    deactivated = admin_client.post(
        f"/api/working-shifts/{shift.id}/deactivate/",
        {"version": shift.version},
        format="json",
    )
    cancelled = admin_client.post(
        f"/api/availability-exceptions/{leave.data['id']}/cancel/",
        {"version": leave.data["version"]},
        format="json",
    )

    assert deactivated.status_code == 200
    assert cancelled.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
    assert appointment.reschedule_source_exception_id is None

    activated = admin_client.post(
        f"/api/working-shifts/{shift.id}/activate/",
        {"version": deactivated.data["version"]},
        format="json",
    )
    assert activated.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_replace_all_uses_truthful_generic_schedule_provenance_and_reverse_restores(
    admin_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )
    proposed = {
        "working_hours": [
            {
                "name": "Shift 1",
                "weekday": 0,
                "start_time": "09:00",
                "end_time": "15:00",
            }
        ]
    }

    preview = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        proposed,
        format="json",
    )
    assert preview.status_code == 409
    assert preview.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"

    replaced = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        {**proposed, "confirm_appointment_impact": True},
        format="json",
    )
    assert replaced.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.WORKING_SCHEDULE_CHANGE
    assert appointment.reschedule_source_working_shift_id is None

    detail = admin_client.get(f"/api/appointments/{appointment.id}/")
    assert detail.data["reschedule_source_type"] == "SHIFT_CHANGE"
    assert detail.data["reschedule_source_label"] == "Doctor working schedule changed"

    reversed_schedule = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        {
            "working_hours": [
                {
                    "name": "Shift 1",
                    "weekday": 0,
                    "start_time": "09:00",
                    "end_time": "17:00",
                }
            ]
        },
        format="json",
    )
    assert reversed_schedule.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind is None
    assert WorkingShift.objects.filter(employee=doctor_user, is_active=True).count() == 1


@pytest.mark.django_db
def test_available_override_prevents_false_shift_change_impact(
    admin_client,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )
    AvailabilityException.objects.create(
        doctor=doctor_user,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T17:00:00+03:00",
        reason="Approved extra availability",
    )

    response = admin_client.patch(
        f"/api/working-shifts/{shift.id}/",
        {"end_time": "15:00", "version": shift.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["impacted_appointments_count"] == 0
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_shift_impact_marker_never_fabricates_provenance_for_valid_appointment(
    admin_user,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    appointment.refresh_from_db()

    marked = _mark_shift_impacts(
        [appointment],
        shift,
        admin_user,
        settings=ClinicSettings.get_solo(),
    )

    assert marked == []
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_kind is None


@pytest.mark.django_db
def test_json_false_cannot_bypass_shift_update_impact_confirmation(
    admin_client,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )

    response = admin_client.patch(
        f"/api/working-shifts/{shift.id}/",
        {
            "end_time": "15:00",
            "version": shift.version,
            "confirm_appointment_impact": False,
        },
        format="json",
    )

    assert response.status_code == 409
    assert response.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"
    shift.refresh_from_db()
    appointment.refresh_from_db()
    assert shift.end_time.isoformat() == "17:00:00"
    assert appointment.status == Appointment.Status.UPCOMING


@pytest.mark.django_db
def test_multipart_false_cannot_bypass_shift_deactivation_confirmation(
    admin_client,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )

    response = admin_client.post(
        f"/api/working-shifts/{shift.id}/deactivate/",
        {"version": shift.version, "confirm_appointment_impact": "false"},
    )

    assert response.status_code == 409
    assert response.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"
    shift.refresh_from_db()
    appointment.refresh_from_db()
    assert shift.is_active is True
    assert appointment.status == Appointment.Status.UPCOMING


@pytest.mark.django_db
def test_multipart_zero_cannot_bypass_apply_default_replace_confirmation(
    admin_client,
    admin_user,
    doctor_user,
    appointment_factory,
):
    shift = add_shift(doctor_user, 0)
    ClinicDefaultShift.objects.create(
        name="Short default",
        weekday=0,
        start_time="09:00",
        end_time="15:00",
        is_active=True,
        created_by=admin_user,
        updated_by=admin_user,
    )
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )

    response = admin_client.post(
        "/api/working-shifts/apply-default/",
        {
            "employee_id": doctor_user.id,
            "mode": "REPLACE_ALL",
            "confirm_appointment_impact": "0",
        },
    )

    assert response.status_code == 409
    assert response.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"
    shift.refresh_from_db()
    appointment.refresh_from_db()
    assert shift.is_active is True
    assert appointment.status == Appointment.Status.UPCOMING
    assert WorkingShift.objects.filter(employee=doctor_user).count() == 1


@pytest.mark.django_db
def test_multipart_false_cannot_bypass_copy_replace_confirmation(
    admin_client,
    doctor_user,
    other_doctor_user,
    appointment_factory,
):
    target_shift = add_shift(doctor_user, 0)
    add_shift(other_doctor_user, 0, end="15:00", name="Source short shift")
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T16:00:00+03:00",
        end_datetime="2026-07-20T16:30:00+03:00",
    )

    response = admin_client.post(
        "/api/working-shifts/copy-schedule/",
        {
            "source_employee_id": other_doctor_user.id,
            "target_employee_id": doctor_user.id,
            "mode": "REPLACE_ALL",
            "confirm_appointment_impact": "false",
        },
    )

    assert response.status_code == 409
    assert response.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"
    target_shift.refresh_from_db()
    appointment.refresh_from_db()
    assert target_shift.is_active is True
    assert appointment.status == Appointment.Status.UPCOMING
    assert WorkingShift.objects.filter(employee=doctor_user).count() == 1


@pytest.mark.django_db
def test_working_shift_mutation_uses_stable_lock_hierarchy(
    monkeypatch,
    admin_client,
    doctor_user,
):
    original_select_for_update = QuerySet.select_for_update
    locked_models = []

    def track_select_for_update(queryset, *args, **kwargs):
        locked_models.append(queryset.model)
        return original_select_for_update(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "select_for_update", track_select_for_update)
    response = admin_client.post(
        "/api/working-shifts/",
        {
            "employee_id": doctor_user.id,
            "name": "Shift 1",
            "weekday": 0,
            "start_time": "09:00",
            "end_time": "12:00",
        },
        format="json",
    )

    assert response.status_code == 201
    ordered_models = [ClinicSettings, User, WorkingShift, Appointment]
    positions = [locked_models.index(model) for model in ordered_models]
    assert positions == sorted(positions)


@pytest.mark.django_db
def test_schedule_copy_and_default_snapshots_are_materialized_only_after_source_and_target_locks(
    monkeypatch,
    admin_user,
    doctor_user,
    other_doctor_user,
    staff_user,
):
    add_shift(doctor_user, 0, name="Source Shift")
    ClinicDefaultShift.objects.create(
        name="Default Shift",
        weekday=1,
        start_time="09:00",
        end_time="12:00",
        is_active=True,
    )
    original_select_for_update = QuerySet.select_for_update
    original_working_snapshot = schedule_services._snapshot_working_shift_specs
    original_default_snapshot = schedule_services._snapshot_default_shift_specs
    events = []

    def track_select_for_update(queryset, *args, **kwargs):
        events.append(("lock", queryset.model))
        return original_select_for_update(queryset, *args, **kwargs)

    def track_working_snapshot(rows):
        events.append(("snapshot", WorkingShift))
        return original_working_snapshot(rows)

    def track_default_snapshot(rows):
        events.append(("snapshot", ClinicDefaultShift))
        return original_default_snapshot(rows)

    monkeypatch.setattr(QuerySet, "select_for_update", track_select_for_update)
    monkeypatch.setattr(schedule_services, "_snapshot_working_shift_specs", track_working_snapshot)
    monkeypatch.setattr(schedule_services, "_snapshot_default_shift_specs", track_default_snapshot)

    schedule_services.copy_employee_schedule(
        source=doctor_user,
        target=other_doctor_user,
        mode="MISSING_ONLY",
        user=admin_user,
    )
    copy_snapshot = events.index(("snapshot", WorkingShift))
    assert events.index(("lock", ClinicSettings)) < events.index(("lock", User))
    assert sum(1 for event in events[:copy_snapshot] if event == ("lock", WorkingShift)) == 2

    events.clear()
    schedule_services.apply_default_schedule(
        employee=staff_user,
        mode="MISSING_ONLY",
        user=admin_user,
    )
    default_snapshot = events.index(("snapshot", ClinicDefaultShift))
    assert events.index(("lock", ClinicSettings)) < events.index(("lock", User))
    assert events.index(("lock", ClinicDefaultShift)) < default_snapshot
    assert events.index(("lock", WorkingShift)) < default_snapshot


@pytest.mark.django_db
def test_locked_employee_role_is_revalidated_for_shift_create_and_replace(
    admin_user,
    doctor_user,
):
    stale_doctor = User.objects.get(pk=doctor_user.pk)
    User.objects.filter(pk=doctor_user.pk).update(role=User.Role.ADMIN)
    serializer = CreateModelStub(
        WorkingShift,
        {
            "employee": stale_doctor,
            "name": "Stale role shift",
            "weekday": 0,
            "start_time": "09:00",
            "end_time": "12:00",
            "is_active": True,
        },
    )

    with pytest.raises(AppointmentRuleError) as create_error:
        create_working_shift(serializer=serializer, user=admin_user)
    with pytest.raises(AppointmentRuleError) as replace_error:
        replace_employee_schedule(
            employee=stale_doctor,
            schedule_rows=[
                {
                    "name": "Stale replacement",
                    "weekday": 0,
                    "start_time": "09:00",
                    "end_time": "12:00",
                    "is_active": True,
                }
            ],
            user=admin_user,
        )

    assert create_error.value.code == "VALIDATION_ERROR"
    assert replace_error.value.code == "VALIDATION_ERROR"
    assert not WorkingShift.objects.filter(employee_id=doctor_user.pk).exists()


@pytest.mark.django_db
def test_locked_exception_target_role_is_revalidated_on_create(
    admin_user,
    doctor_user,
):
    stale_doctor = User.objects.get(pk=doctor_user.pk)
    User.objects.filter(pk=doctor_user.pk).update(role=User.Role.ADMIN)
    serializer = CreateModelStub(
        AvailabilityException,
        {
            "doctor": stale_doctor,
            "staff": None,
            "start_datetime": "2026-07-20T09:00:00+03:00",
            "end_datetime": "2026-07-20T10:00:00+03:00",
            "type": AvailabilityException.Type.UNAVAILABLE,
        },
    )

    with pytest.raises(AppointmentRuleError) as exc_info:
        save_availability_exception(serializer=serializer, user=admin_user)

    assert exc_info.value.code == "VALIDATION_ERROR"
    assert not AvailabilityException.objects.exists()


@pytest.mark.django_db
def test_locked_exception_target_role_is_revalidated_on_update(
    admin_user,
    doctor_user,
    other_doctor_user,
):
    exception = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    stale_target = User.objects.get(pk=other_doctor_user.pk)
    User.objects.filter(pk=other_doctor_user.pk).update(role=User.Role.ADMIN)
    serializer = type(
        "UpdateStub",
        (),
        {"validated_data": {"doctor": stale_target, "version": exception.version}},
    )()

    with pytest.raises(AppointmentRuleError) as exc_info:
        update_availability_exception(
            instance=exception,
            serializer=serializer,
            user=admin_user,
        )

    assert exc_info.value.code == "VALIDATION_ERROR"
    exception.refresh_from_db()
    assert exception.doctor_id == doctor_user.pk


@pytest.mark.django_db
def test_exception_update_rechecks_cancelled_state_after_row_lock(
    admin_user,
    doctor_user,
):
    exception = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    stale_instance = AvailabilityException.objects.get(pk=exception.pk)
    AvailabilityException.objects.filter(pk=exception.pk).update(is_cancelled=True)
    serializer = type(
        "UpdateStub",
        (),
        {"validated_data": {"reason": "Must not be written", "version": exception.version}},
    )()

    with pytest.raises(AppointmentRuleError) as exc_info:
        update_availability_exception(
            instance=stale_instance,
            serializer=serializer,
            user=admin_user,
        )

    assert exc_info.value.code == "INVALID_STATUS_TRANSITION"
    exception.refresh_from_db()
    assert exception.reason == ""
    assert exception.is_cancelled is True


@pytest.mark.django_db
def test_exception_create_maps_under_lock_rule_error_to_api_response(
    monkeypatch,
    admin_client,
    doctor_user,
):
    def reject_stale_target(**kwargs):
        raise AppointmentRuleError(
            "VALIDATION_ERROR",
            "Some fields are invalid.",
            {"doctor_id": ["Doctor target must have DOCTOR role."]},
        )

    monkeypatch.setattr(
        scheduling_views,
        "save_availability_exception",
        reject_stale_target,
    )
    response = admin_client.post(
        "/api/availability-exceptions/",
        leave_payload(
            doctor_user,
            "2026-07-20T09:00:00+03:00",
            "2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert response.data["details"]["doctor_id"] == ["Doctor target must have DOCTOR role."]


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="Requires PostgreSQL row-lock interleaving semantics.",
)
def test_postgresql_concurrent_overlapping_shift_creations_serialize(
    admin_user,
    doctor_user,
):
    barrier = Barrier(2)

    def worker(name, start, end):
        close_old_connections()
        try:
            actor = User.objects.get(pk=admin_user.pk)
            employee = User.objects.get(pk=doctor_user.pk)
            serializer = WorkingShiftSerializer(
                data={
                    "employee_id": employee.pk,
                    "name": name,
                    "weekday": 0,
                    "start_time": start,
                    "end_time": end,
                }
            )
            serializer.is_valid(raise_exception=True)
            barrier.wait(timeout=10)
            try:
                create_working_shift(serializer=serializer, user=actor)
            except AppointmentRuleError as exc:
                return exc.code
            return "CREATED"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda args: worker(*args),
                [
                    ("Morning", "09:00", "12:00"),
                    ("Overlap", "11:30", "16:00"),
                ],
            )
        )

    assert sorted(results) == ["CREATED", "SHIFT_OVERLAP"]
    assert WorkingShift.objects.filter(employee=doctor_user, is_active=True).count() == 1
