from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from apps.accounts.models import User
from apps.clinic.models import ClinicSettings
from apps.dashboard.analytics import (
    HISTORICAL_SCHEDULE_ACCURACY,
    appointment_problem_rate,
    doctor_utilization,
)
from apps.scheduling.models import Appointment, AvailabilityException


CLINIC_TZ = ZoneInfo("Asia/Damascus")


def _local(day, hour, minute=0, clinic_timezone=CLINIC_TZ):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=clinic_timezone)


def _open_every_day():
    clinic = ClinicSettings.get_solo()
    clinic.weekly_closed_days = []
    clinic.save(update_fields=["weekly_closed_days", "updated_at"])
    return clinic


@pytest.mark.django_db
def test_utilization_reconciles_interval_union_closure_leave_override_and_no_show(
    doctor_user,
    working_hour_factory,
    availability_exception_factory,
    appointment_factory,
):
    clinic = _open_every_day()
    day = date(2026, 7, 20)  # Monday
    working_hour_factory(doctor=doctor_user, weekday=0, start_time="09:00", end_time="17:00")
    availability_exception_factory(
        doctor=doctor_user,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        start_datetime=_local(day, 17),
        end_datetime=_local(day, 18),
    )
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime=_local(day, 12),
        end_datetime=_local(day, 14),
    )
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime=_local(day, 13),
        end_datetime=_local(day, 15),
    )

    appointment_factory(
        start_datetime=_local(day, 9),
        end_datetime=_local(day, 10),
        duration_minutes=60,
        status=Appointment.Status.COMPLETED,
    )
    appointment_factory(
        start_datetime=_local(day, 9, 30),
        end_datetime=_local(day, 10, 30),
        duration_minutes=60,
        status=Appointment.Status.COMPLETED,
    )
    appointment_factory(
        start_datetime=_local(day, 16),
        end_datetime=_local(day, 16, 30),
        duration_minutes=30,
        status=Appointment.Status.NO_SHOW,
    )
    appointment_factory(
        start_datetime=_local(day, 15),
        end_datetime=_local(day, 15, 30),
        status=Appointment.Status.CANCELLED,
    )
    appointment_factory(
        start_datetime=_local(day, 15, 30),
        end_datetime=_local(day, 16),
        status=Appointment.Status.NEEDS_RESCHEDULE,
    )

    rows = doctor_utilization(
        day,
        CLINIC_TZ,
        days=1,
        weekly_closed_days=clinic.weekly_closed_days,
    )
    row = next(item for item in rows if item["doctor"]["id"] == doctor_user.id)

    # Availability: union(09:00-17:00, 17:00-18:00) = 540;
    # union leave(12:00-14:00, 13:00-15:00) = 180; effective = 360.
    # Booked: union(09:00-10:00, 09:30-10:30) + NO_SHOW 16:00-16:30 = 120.
    assert row["available_minutes"] == 360
    assert row["booked_minutes"] == 120
    assert row["utilization_percent"] == 33.3


@pytest.mark.django_db
def test_utilization_clips_window_inside_split_shifts_and_subtracts_partial_leave(
    doctor_user,
    working_hour_factory,
    availability_exception_factory,
):
    _open_every_day()
    day = date(2026, 7, 20)
    working_hour_factory(doctor=doctor_user, weekday=0, start_time="09:00", end_time="12:00")
    working_hour_factory(doctor=doctor_user, weekday=0, start_time="13:00", end_time="17:00")
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime=_local(day, 11),
        end_datetime=_local(day, 14),
    )

    rows = doctor_utilization(
        day,
        CLINIC_TZ,
        weekly_closed_days=[],
        window_start=_local(day, 10),
        window_end=_local(day, 15),
    )
    row = next(item for item in rows if item["doctor"]["id"] == doctor_user.id)

    # Clipped shifts provide 240 minutes; leave removes 11-12 and 13-14.
    assert row["available_minutes"] == 120
    assert row["booked_minutes"] == 0


@pytest.mark.django_db
def test_closed_day_override_stays_closed_and_no_shift_doctor_is_reported(
    doctor_user,
    working_hour_factory,
    availability_exception_factory,
):
    day = date(2026, 7, 20)
    working_hour_factory(doctor=doctor_user, weekday=0, start_time="09:00", end_time="17:00")
    availability_exception_factory(
        doctor=doctor_user,
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
        start_datetime=_local(day, 8),
        end_datetime=_local(day, 18),
    )
    no_shift = User.objects.create_user(
        email="no-shift-doctor@example.test",
        password="NotUsed!2026",
        full_name="No Shift Doctor",
        role=User.Role.DOCTOR,
    )

    rows = doctor_utilization(day, CLINIC_TZ, days=1, weekly_closed_days=[0])
    by_id = {row["doctor"]["id"]: row for row in rows}

    assert by_id[doctor_user.id]["available_minutes"] == 0
    assert by_id[no_shift.id]["available_minutes"] == 0
    assert by_id[no_shift.id]["utilization_percent"] == 0.0


@pytest.mark.django_db
def test_full_day_leave_removes_denominator_and_ordinary_full_booking_is_100_percent(
    doctor_user,
    working_hour_factory,
    availability_exception_factory,
    appointment_factory,
):
    _open_every_day()
    day = date(2026, 7, 20)
    fully_booked = User.objects.create_user(
        email="fully-booked-doctor@example.test",
        password="NotUsed!2026",
        full_name="Fully Booked Doctor",
        role=User.Role.DOCTOR,
    )
    for doctor in (doctor_user, fully_booked):
        working_hour_factory(
            doctor=doctor,
            weekday=0,
            start_time="09:00",
            end_time="10:00",
        )
        appointment_factory(
            doctor=doctor,
            start_datetime=_local(day, 9),
            end_datetime=_local(day, 10),
            duration_minutes=60,
            status=Appointment.Status.COMPLETED,
        )
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime=_local(day, 0),
        end_datetime=_local(day, 23, 59),
    )

    rows = doctor_utilization(day, CLINIC_TZ, days=1, weekly_closed_days=[])
    by_id = {row["doctor"]["id"]: row for row in rows}

    assert by_id[doctor_user.id] == {
        "doctor": {"id": doctor_user.id, "full_name": doctor_user.full_name},
        "booked_minutes": 60,
        "available_minutes": 0,
        "utilization_percent": 0.0,
    }
    assert by_id[fully_booked.id]["booked_minutes"] == 60
    assert by_id[fully_booked.id]["available_minutes"] == 60
    assert by_id[fully_booked.id]["utilization_percent"] == 100.0


@pytest.mark.django_db
def test_utilization_returns_every_active_doctor_beyond_eight(
    doctor_user,
    working_hour_factory,
):
    _open_every_day()
    day = date(2026, 7, 20)
    working_hour_factory(doctor=doctor_user, weekday=0)
    doctor_ids = {doctor_user.id}
    for index in range(8):
        doctor = User.objects.create_user(
            email=f"analytics-doctor-{index}@example.test",
            password="NotUsed!2026",
            full_name=f"Analytics Doctor {index}",
            role=User.Role.DOCTOR,
        )
        doctor_ids.add(doctor.id)
        working_hour_factory(doctor=doctor, weekday=0)
    inactive = User.objects.create_user(
        email="inactive-analytics-doctor@example.test",
        password="NotUsed!2026",
        full_name="Inactive Analytics Doctor",
        role=User.Role.DOCTOR,
        is_active=False,
    )
    working_hour_factory(doctor=inactive, weekday=0)

    rows = doctor_utilization(day, CLINIC_TZ, days=1, weekly_closed_days=[])

    assert {row["doctor"]["id"] for row in rows} == doctor_ids
    assert len(rows) == 9
    assert inactive.id not in {row["doctor"]["id"] for row in rows}
    assert HISTORICAL_SCHEDULE_ACCURACY == "CURRENT_TEMPLATE_APPROXIMATION"


@pytest.mark.django_db
def test_problem_rate_current_week_uses_clinic_as_of_and_exact_denominator(
    appointment_factory,
):
    as_of = _local(date(2026, 7, 15), 12)
    records = [
        (date(2026, 7, 13), 9, Appointment.Status.CANCELLED),
        (date(2026, 7, 14), 9, Appointment.Status.NO_SHOW),
        (date(2026, 7, 15), 10, Appointment.Status.COMPLETED),
        (date(2026, 7, 15), 12, Appointment.Status.UPCOMING),  # exact as-of is eligible
        (date(2026, 7, 15), 11, Appointment.Status.NEEDS_RESCHEDULE),
        (date(2026, 7, 16), 9, Appointment.Status.UPCOMING),
        (date(2026, 7, 17), 9, Appointment.Status.CANCELLED),
    ]
    for day, hour, status in records:
        appointment_factory(
            start_datetime=_local(day, hour),
            end_datetime=_local(day, hour, 30),
            status=status,
        )

    [row] = appointment_problem_rate(
        date(2026, 7, 15),
        CLINIC_TZ,
        weeks=1,
        as_of=as_of,
    )

    assert row == {
        "week_start": "2026-07-13",
        "scheduled": 4,
        "cancelled": 1,
        "no_show": 1,
        "rate_percent": 50.0,
    }


@pytest.mark.django_db
def test_problem_rate_preserves_full_historical_week_and_zeroes_future_week(
    appointment_factory,
):
    historical_day = date(2026, 7, 5)
    appointment_factory(
        start_datetime=_local(historical_day, 23),
        end_datetime=_local(historical_day, 23, 30),
        status=Appointment.Status.NO_SHOW,
    )
    as_of = _local(date(2026, 7, 15), 12)

    [historical] = appointment_problem_rate(
        historical_day,
        CLINIC_TZ,
        weeks=1,
        as_of=as_of,
    )
    [future] = appointment_problem_rate(
        date(2026, 7, 27),
        CLINIC_TZ,
        weeks=1,
        as_of=as_of,
    )

    assert historical["scheduled"] == 1
    assert historical["no_show"] == 1
    assert historical["rate_percent"] == 100.0
    assert future["scheduled"] == 0
    assert future["rate_percent"] == 0.0


@pytest.mark.django_db
def test_problem_rate_as_of_uses_configured_iana_timezone_boundary(
    appointment_factory,
):
    clinic_timezone = ZoneInfo("America/New_York")
    clinic_date = date(2026, 7, 15)
    as_of = _local(clinic_date, 5, clinic_timezone=clinic_timezone)
    appointment_factory(
        start_datetime=_local(clinic_date, 4, 59, clinic_timezone),
        end_datetime=_local(clinic_date, 5, 0, clinic_timezone),
        duration_minutes=1,
        status=Appointment.Status.NO_SHOW,
    )
    appointment_factory(
        start_datetime=_local(clinic_date, 5, 1, clinic_timezone),
        end_datetime=_local(clinic_date, 5, 2, clinic_timezone),
        duration_minutes=1,
        status=Appointment.Status.UPCOMING,
    )

    [row] = appointment_problem_rate(
        clinic_date,
        clinic_timezone,
        weeks=1,
        as_of=as_of,
    )

    assert row["scheduled"] == 1
    assert row["no_show"] == 1
    assert row["rate_percent"] == 100.0
