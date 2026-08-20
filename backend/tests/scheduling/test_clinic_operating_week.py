import pytest
from django.utils import timezone

from apps.audit.models import ActivityLog
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import (
    Appointment,
    AvailabilityException,
    ClinicDefaultShift,
    WorkingShift,
)
from apps.scheduling.schedule_services import apply_default_schedule
from apps.scheduling.serializers import (
    ClinicDefaultShiftSerializer,
    WorkingShiftSerializer,
)


def add_shift(employee, weekday, start="09:00", end="12:00", name="Shift 1"):
    return WorkingShift.objects.create(
        employee=employee,
        name=name,
        weekday=weekday,
        start_time=start,
        end_time=end,
        is_active=True,
    )


def set_closed_days(admin_client, days, *, confirm=False):
    payload = {"weekly_closed_days": days}
    if confirm:
        payload["confirm_appointment_impact"] = True
    return admin_client.patch("/api/clinic/settings/", payload, format="json")


def appointment_payload(patient, doctor, start_datetime):
    return {
        "patient_id": patient.id,
        "doctor_id": doctor.id,
        "start_datetime": start_datetime,
        "duration_minutes": 30,
        "reason": "Operating week test",
    }


def availability(staff_client, doctor, date_value):
    return staff_client.get(
        f"/api/appointments/availability/?doctor_id={doctor.id}"
        f"&date={date_value}&duration_minutes=30"
    )


@pytest.mark.django_db
def test_closed_day_suppresses_shift_and_available_override_then_reopens(
    admin_client,
    staff_client,
    doctor_user,
    patient,
):
    friday_shift = add_shift(doctor_user, 4)
    AvailabilityException.objects.create(
        doctor=doctor_user,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        start_datetime="2026-07-17T09:00:00+03:00",
        end_datetime="2026-07-17T12:00:00+03:00",
        reason="Extra availability",
    )

    closed = availability(staff_client, doctor_user, "2026-07-17")

    assert closed.status_code == 200
    assert closed.data["clinic_closed"] is True
    assert closed.data["available_slots"] == []
    assert WorkingShift.objects.filter(pk=friday_shift.pk, is_active=True).exists()
    closed_booking = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-17T09:00:00+03:00"),
        format="json",
    )
    assert closed_booking.status_code == 409
    assert closed_booking.data["code"] == "CLINIC_CLOSED_DAY"

    reopen = set_closed_days(admin_client, [])
    opened = availability(staff_client, doctor_user, "2026-07-17")

    assert reopen.status_code == 200
    assert opened.data["clinic_closed"] is False
    assert opened.data["available_slots"]

    AvailabilityException.objects.create(
        doctor=doctor_user,
        type=AvailabilityException.Type.UNAVAILABLE,
        start_datetime="2026-07-17T09:00:00+03:00",
        end_datetime="2026-07-17T12:00:00+03:00",
        reason="Leave",
    )
    assert availability(staff_client, doctor_user, "2026-07-17").data["available_slots"] == []


@pytest.mark.django_db
def test_alternative_sunday_closure_leaves_friday_open(
    admin_client,
    staff_client,
    doctor_user,
):
    add_shift(doctor_user, 4)
    add_shift(doctor_user, 6)
    response = set_closed_days(admin_client, [6])

    friday = availability(staff_client, doctor_user, "2026-07-17")
    sunday = availability(staff_client, doctor_user, "2026-07-19")

    assert response.status_code == 200
    assert friday.data["clinic_closed"] is False
    assert friday.data["available_slots"]
    assert sunday.data["clinic_closed"] is True
    assert sunday.data["available_slots"] == []


@pytest.mark.django_db
def test_appointment_create_and_reschedule_reject_closed_day_but_open_day_works(
    staff_client,
    doctor_user,
    patient,
):
    add_shift(doctor_user, 0)
    add_shift(doctor_user, 4)

    closed_create = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-17T09:00:00+03:00"),
        format="json",
    )
    open_create = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-20T09:00:00+03:00"),
        format="json",
    )
    closed_update = staff_client.patch(
        f"/api/appointments/{open_create.data['id']}/",
        {
            "start_datetime": "2026-07-17T09:00:00+03:00",
            "duration_minutes": 30,
        },
        format="json",
    )

    assert closed_create.status_code == 409
    assert closed_create.data["code"] == "CLINIC_CLOSED_DAY"
    assert open_create.status_code == 201
    assert closed_update.status_code == 409
    assert closed_update.data["code"] == "CLINIC_CLOSED_DAY"
    saved = Appointment.objects.get(pk=open_create.data["id"])
    assert timezone.localtime(saved.start_datetime).isoformat().startswith("2026-07-20T09:00:00")


@pytest.mark.django_db
def test_closure_change_requires_confirmation_and_marks_only_future_actionable(
    admin_client,
    doctor_user,
    staff_user,
    appointment_factory,
):
    doctor_shift = add_shift(doctor_user, 0)
    staff_shift = add_shift(staff_user, 0)
    upcoming = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    checked_in = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    terminal = [
        appointment_factory(
            doctor=doctor_user,
            status=value,
            start_datetime=f"2026-07-20T{hour}:00:00+03:00",
            end_datetime=f"2026-07-20T{hour}:30:00+03:00",
        )
        for value, hour in (
            (Appointment.Status.COMPLETED, "11"),
            (Appointment.Status.CANCELLED, "12"),
            (Appointment.Status.NO_SHOW, "13"),
        )
    ]
    past = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-13T09:00:00+03:00",
        end_datetime="2026-07-13T09:30:00+03:00",
    )

    preview = set_closed_days(admin_client, [0, 4])

    assert preview.status_code == 409
    assert preview.data["code"] == "CLINIC_CLOSURE_REQUIRES_CONFIRMATION"
    assert preview.data["details"]["impacted_count"] == 2
    assert preview.data["details"]["proposed_weekly_closed_days"] == [0, 4]
    assert {row["id"] for row in preview.data["details"]["appointments"]} == {
        upcoming.id,
        checked_in.id,
    }
    assert ClinicSettings.objects.get(pk=1).weekly_closed_days == [4]
    upcoming.refresh_from_db()
    assert upcoming.status == Appointment.Status.UPCOMING
    assert not ActivityLog.objects.filter(action="clinic_settings_updated").exists()

    confirmed = set_closed_days(admin_client, [0, 4], confirm=True)

    assert confirmed.status_code == 200
    assert confirmed.data["affected_appointments_count"] == 2
    for appointment, previous in (
        (upcoming, Appointment.Status.UPCOMING),
        (checked_in, Appointment.Status.CHECKED_IN),
    ):
        appointment.refresh_from_db()
        assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
        assert appointment.reschedule_previous_status == previous
        assert appointment.reschedule_source_clinic_weekday == 0
        assert appointment.reschedule_source_exception_id is None
        assert appointment.reschedule_source_working_shift_id is None
    for appointment in [*terminal, past]:
        expected = appointment.status
        appointment.refresh_from_db()
        assert appointment.status == expected
        assert appointment.reschedule_source_clinic_weekday is None
    assert WorkingShift.objects.filter(pk__in=[doctor_shift.pk, staff_shift.pk], is_active=True).count() == 2

    audit = ActivityLog.objects.get(action="clinic_settings_updated")
    assert audit.metadata_json["old_weekly_closed_days"] == [4]
    assert audit.metadata_json["new_weekly_closed_days"] == [0, 4]
    assert audit.metadata_json["affected_appointment_count"] == 2
    assert ActivityLog.objects.filter(
        action="appointment_marked_needs_reschedule",
        metadata_json__reschedule_source_type="CLINIC_WEEKLY_CLOSURE",
    ).count() == 2


@pytest.mark.django_db
def test_reopening_restores_only_fully_valid_closure_impacts(
    admin_client,
    doctor_user,
    appointment_factory,
    availability_exception_factory,
):
    add_shift(doctor_user, 0)
    restorable = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    blocked = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    assert set_closed_days(admin_client, [0, 4], confirm=True).status_code == 200
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )

    reopened = set_closed_days(admin_client, [4])

    assert reopened.status_code == 200
    assert reopened.data["restored_appointments_count"] == 1
    assert reopened.data["still_blocked_appointments_count"] == 1
    restorable.refresh_from_db()
    blocked.refresh_from_db()
    assert restorable.status == Appointment.Status.UPCOMING
    assert restorable.reschedule_previous_status is None
    assert restorable.reschedule_source_clinic_weekday is None
    assert blocked.status == Appointment.Status.NEEDS_RESCHEDULE
    assert blocked.reschedule_source_clinic_weekday == 0


@pytest.mark.django_db
def test_reopening_keeps_closure_impact_when_doctor_conflict_exists(
    admin_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    impacted = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    set_closed_days(admin_client, [0, 4], confirm=True)
    appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )

    reopened = set_closed_days(admin_client, [4])

    assert reopened.status_code == 200
    assert reopened.data["restored_appointments_count"] == 0
    assert reopened.data["still_blocked_appointments_count"] == 1
    impacted.refresh_from_db()
    assert impacted.status == Appointment.Status.NEEDS_RESCHEDULE
    assert impacted.reschedule_source_clinic_weekday == 0


@pytest.mark.django_db
def test_manually_rescheduled_closure_impact_is_not_restored(
    admin_client,
    staff_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    add_shift(doctor_user, 1)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    set_closed_days(admin_client, [0, 4], confirm=True)

    manual = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {
            "start_datetime": "2026-07-21T09:00:00+03:00",
            "duration_minutes": 30,
        },
        format="json",
    )
    reopened = set_closed_days(admin_client, [4])

    assert manual.status_code == 200
    assert reopened.data["restored_appointments_count"] == 0
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert timezone.localtime(appointment.start_datetime).isoformat().startswith("2026-07-21T09:00:00")
    assert appointment.reschedule_source_clinic_weekday is None


@pytest.mark.django_db
def test_closure_provenance_is_safely_serialized(
    admin_client,
    staff_client,
    doctor_user,
    appointment_factory,
):
    add_shift(doctor_user, 0)
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    set_closed_days(admin_client, [0, 4], confirm=True)

    response = staff_client.get(f"/api/appointments/{appointment.id}/")

    assert response.status_code == 200
    assert response.data["reschedule_source_clinic_weekday"] == 0
    assert response.data["reschedule_source_type"] == "CLINIC_WEEKLY_CLOSURE"
    assert response.data["reschedule_source_label"] == "Clinic closed on Monday"


@pytest.mark.django_db
def test_default_and_employee_shifts_remain_stored_but_are_not_effective_when_closed(
    admin_user,
    doctor_user,
    staff_user,
):
    default_shift = ClinicDefaultShift.objects.create(
        name="Shift 1",
        weekday=4,
        start_time="09:00",
        end_time="12:00",
        is_active=True,
        created_by=admin_user,
        updated_by=admin_user,
    )
    result = apply_default_schedule(
        employee=doctor_user,
        mode="MISSING_ONLY",
        user=admin_user,
    )
    staff_shift = add_shift(staff_user, 4)
    doctor_shift = WorkingShift.objects.get(employee=doctor_user, weekday=4)

    default_data = ClinicDefaultShiftSerializer(default_shift).data
    doctor_data = WorkingShiftSerializer(doctor_shift).data
    staff_data = WorkingShiftSerializer(staff_shift).data

    assert result["created_count"] == 1
    assert default_data["name"] == "Shift 1"
    assert default_data["clinic_closed"] is True
    assert default_data["effective_is_active"] is False
    assert doctor_data["clinic_closed"] is True
    assert doctor_data["effective_is_active"] is False
    assert staff_data["clinic_closed"] is True
    assert staff_data["effective_is_active"] is False
    assert WorkingShift.objects.filter(pk__in=[doctor_shift.pk, staff_shift.pk], is_active=True).count() == 2


@pytest.mark.django_db
def test_past_historical_appointment_is_not_rewritten_when_weekday_closes(
    admin_client,
    appointment_factory,
):
    set_closed_days(admin_client, [])
    historical = appointment_factory(
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-10T09:00:00+03:00",
        end_datetime="2026-07-10T09:30:00+03:00",
    )

    response = set_closed_days(admin_client, [4])

    assert response.status_code == 200
    historical.refresh_from_db()
    assert historical.status == Appointment.Status.COMPLETED
    assert historical.reschedule_source_clinic_weekday is None


@pytest.mark.django_db
def test_timezone_change_uses_effective_old_and_new_clinic_weekdays(
    admin_client,
    staff_client,
    doctor_user,
    patient,
):
    add_shift(doctor_user, 0, start="00:00", end="02:00")
    assert set_closed_days(admin_client, [6]).status_code == 200
    created = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-20T00:30:00+03:00"),
        format="json",
    )
    assert created.status_code == 201

    preview = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "UTC"},
        format="json",
    )
    confirmed = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "UTC", "confirm_appointment_impact": True},
        format="json",
    )

    assert preview.status_code == 409
    assert preview.data["code"] == "CLINIC_CLOSURE_REQUIRES_CONFIRMATION"
    assert preview.data["details"]["impacted_count"] == 1
    assert confirmed.status_code == 200
    appointment = Appointment.objects.get(pk=created.data["id"])
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_clinic_weekday == 6

    reopened = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "Asia/Damascus"},
        format="json",
    )

    assert reopened.status_code == 200
    assert reopened.data["restored_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_clinic_weekday is None


@pytest.mark.django_db
def test_reopen_restores_after_timezone_moves_source_between_closed_weekdays(
    admin_client,
    staff_client,
    doctor_user,
    patient,
):
    add_shift(doctor_user, 6, start="00:00", end="02:00")
    add_shift(doctor_user, 5, start="21:00", end="23:00")
    created = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-19T01:00:00+03:00"),
        format="json",
    )
    assert created.status_code == 201
    assert set_closed_days(admin_client, [4, 6], confirm=True).status_code == 200
    appointment = Appointment.objects.get(pk=created.data["id"])
    assert appointment.reschedule_source_clinic_weekday == 6

    moved_while_closed = admin_client.patch(
        "/api/clinic/settings/",
        {"timezone": "UTC", "weekly_closed_days": [4, 5, 6]},
        format="json",
    )

    assert moved_while_closed.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_clinic_weekday == 6

    reopened = set_closed_days(admin_client, [4, 6])

    assert reopened.status_code == 200
    assert reopened.data["restored_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_clinic_weekday is None


@pytest.mark.django_db
def test_confirmed_closure_rolls_back_settings_and_appointments_if_audit_fails(
    monkeypatch,
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

    def fail_audit(**kwargs):
        raise RuntimeError("deterministic audit failure")

    monkeypatch.setattr(
        "apps.scheduling.clinic_week_services.log_activity",
        fail_audit,
    )

    with pytest.raises(RuntimeError, match="deterministic audit failure"):
        set_closed_days(admin_client, [0, 4], confirm=True)

    assert ClinicSettings.objects.get(pk=1).weekly_closed_days == [4]
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_previous_status is None
    assert appointment.reschedule_source_clinic_weekday is None


@pytest.mark.django_db
def test_booking_and_closure_update_use_same_clinic_settings_row_lock(
    monkeypatch,
    admin_client,
    staff_client,
    doctor_user,
    patient,
):
    from django.db.models.query import QuerySet

    add_shift(doctor_user, 0)
    original_select_for_update = QuerySet.select_for_update
    locked_models = []

    def track_select_for_update(queryset, *args, **kwargs):
        if queryset.model is ClinicSettings:
            locked_models.append(queryset.model)
        return original_select_for_update(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "select_for_update", track_select_for_update)

    booked = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-20T09:00:00+03:00"),
        format="json",
    )
    assert booked.status_code == 201
    assert locked_models == [ClinicSettings]

    locked_models.clear()
    updated = set_closed_days(admin_client, [6])
    assert updated.status_code == 200
    assert locked_models == [ClinicSettings]
