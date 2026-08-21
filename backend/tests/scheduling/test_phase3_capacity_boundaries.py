from datetime import date, datetime, timedelta

import pytest

from apps.accounts.models import User
from apps.clinic.models import ClinicSettings
from apps.scheduling.capacity import assess_candidate_capacity
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift


MONDAY = date(2026, 7, 20)

CAPACITY_CASES = [
    pytest.param([], 0, id="none"),
    pytest.param([("09:15", "09:45")], 1, id="one-existing"),
    pytest.param(
        [("08:30", "09:00"), ("10:00", "10:30")],
        0,
        id="exact-outer-adjacency",
    ),
    pytest.param(
        [("09:00", "09:30"), ("09:30", "10:00")],
        1,
        id="staggered-adjacent",
    ),
    pytest.param(
        [("09:00", "10:00"), ("09:15", "09:45")],
        2,
        id="nested",
    ),
    pytest.param(
        [("08:45", "09:15"), ("09:10", "09:40")],
        2,
        id="partial-overlap",
    ),
    pytest.param(
        [("09:00", "09:30"), ("09:00", "10:00")],
        2,
        id="same-start",
    ),
    pytest.param(
        [("09:00", "10:00"), ("09:30", "10:00")],
        2,
        id="same-end",
    ),
    pytest.param(
        [
            ("09:00", "09:15"),
            ("09:15", "09:30"),
            ("09:30", "09:45"),
            ("09:45", "10:00"),
        ],
        1,
        id="candidate-spans-adjacent-chain",
    ),
    pytest.param(
        [("09:00", "10:00"), ("09:15", "09:45"), ("09:30", "10:00")],
        3,
        id="three-simultaneous",
    ),
]


def dt(value: str) -> datetime:
    return datetime.fromisoformat(f"2026-07-20T{value}:00+03:00")


def appointment_payload(patient, doctor, *, start="2026-07-20T09:00:00+03:00", duration=60):
    return {
        "patient_id": patient.id,
        "doctor_id": doctor.id,
        "start_datetime": start,
        "duration_minutes": duration,
        "reason": "Capacity verification",
    }


def make_doctor(index: int) -> User:
    return User.objects.create_user(
        email=f"capacity-doctor-{index}@example.com",
        password="password123",
        full_name=f"Capacity Doctor {index}",
        role=User.Role.DOCTOR,
        is_active=True,
    )


def add_monday_shift(doctor, *, start="09:00", end="10:00"):
    return WorkingShift.objects.create(
        employee=doctor,
        name="Capacity shift",
        weekday=0,
        start_time=start,
        end_time=end,
        is_active=True,
    )


@pytest.mark.parametrize("capacity", [1, 2, 3])
@pytest.mark.parametrize(
    ("intervals", "expected_existing_peak"),
    CAPACITY_CASES,
)
def test_capacity_sweep_matrix_uses_half_open_peak_occupancy(
    capacity,
    intervals,
    expected_existing_peak,
):
    assessment = assess_candidate_capacity(
        ((dt(start), dt(end)) for start, end in intervals),
        start_datetime=dt("09:00"),
        end_datetime=dt("10:00"),
        capacity=capacity,
    )

    assert assessment.existing_peak == expected_existing_peak
    assert assessment.projected_peak == expected_existing_peak + 1
    assert assessment.available is (expected_existing_peak + 1 <= capacity)


@pytest.mark.django_db
@pytest.mark.parametrize("capacity", [1, 2, 3])
@pytest.mark.parametrize(("existing_intervals", "expected_current_count"), CAPACITY_CASES)
def test_creation_and_availability_share_capacity_matrix(
    staff_client,
    patient,
    appointment_factory,
    capacity,
    existing_intervals,
    expected_current_count,
):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = capacity
    settings.save()
    candidate_doctor = make_doctor(90)
    add_monday_shift(candidate_doctor)
    for index, (start, end) in enumerate(existing_intervals):
        appointment_factory(
            doctor=make_doctor(index),
            start_datetime=dt(start),
            end_datetime=dt(end),
            duration_minutes=int((dt(end) - dt(start)).total_seconds() // 60),
        )

    availability = staff_client.get(
        "/api/appointments/availability/",
        {"doctor_id": candidate_doctor.id, "date": MONDAY.isoformat(), "duration_minutes": 60},
    )
    matching = [
        slot
        for slot in availability.data["available_slots"]
        if slot["start_datetime"].startswith("2026-07-20T09:00:00")
    ]
    creation = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, candidate_doctor),
        format="json",
    )

    assert availability.status_code == 200
    expected_available = expected_current_count + 1 <= capacity
    assert bool(matching) is expected_available
    if expected_available:
        assert len(matching) == 1
        assert matching[0]["current_count"] == expected_current_count
        assert creation.status_code == 201
    else:
        assert creation.status_code == 409
        assert creation.data["code"] == "CAPACITY_FULL"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("existing_intervals", "expected_status"),
    [
        pytest.param(
            [("09:00", "09:30"), ("09:30", "10:00")],
            200,
            id="staggered-peak-allows-update",
        ),
        pytest.param(
            [("09:00", "10:00"), ("09:15", "09:45")],
            409,
            id="simultaneous-peak-rejects-update",
        ),
    ],
)
def test_appointment_update_uses_peak_capacity_semantics(
    staff_client,
    doctor_user,
    appointment_factory,
    existing_intervals,
    expected_status,
):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 2
    settings.save()
    add_monday_shift(doctor_user, end="11:00")
    candidate = appointment_factory(
        doctor=doctor_user,
        start_datetime=dt("10:00"),
        end_datetime=dt("11:00"),
        duration_minutes=60,
    )
    for index, (start, end) in enumerate(existing_intervals):
        appointment_factory(
            doctor=make_doctor(index),
            start_datetime=dt(start),
            end_datetime=dt(end),
            duration_minutes=int((dt(end) - dt(start)).total_seconds() // 60),
        )

    response = staff_client.patch(
        f"/api/appointments/{candidate.id}/",
        {
            "start_datetime": dt("09:00").isoformat(),
            "duration_minutes": 60,
            "version": candidate.version,
        },
        format="json",
    )

    assert response.status_code == expected_status
    candidate.refresh_from_db()
    if expected_status == 200:
        assert candidate.start_datetime == dt("09:00")
        assert candidate.version == 2
    else:
        assert response.data["code"] == "CAPACITY_FULL"
        assert candidate.start_datetime == dt("10:00")
        assert candidate.version == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ignored_status",
    [Appointment.Status.CANCELLED, Appointment.Status.NEEDS_RESCHEDULE],
)
def test_creation_and_availability_ignore_non_counting_statuses(
    staff_client,
    patient,
    doctor_user,
    appointment_factory,
    ignored_status,
):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_monday_shift(doctor_user)
    appointment_factory(
        doctor=doctor_user,
        status=ignored_status,
        start_datetime=dt("09:00"),
        end_datetime=dt("10:00"),
        duration_minutes=60,
    )

    availability = staff_client.get(
        "/api/appointments/availability/",
        {"doctor_id": doctor_user.id, "date": MONDAY.isoformat(), "duration_minutes": 60},
    )
    creation = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user),
        format="json",
    )

    assert any(
        slot["start_datetime"].startswith("2026-07-20T09:00:00")
        for slot in availability.data["available_slots"]
    )
    assert creation.status_code == 201


@pytest.mark.django_db
def test_doctor_conflict_remains_independent_when_clinic_has_capacity(
    staff_client,
    patient,
    doctor_user,
    appointment_factory,
):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 3
    settings.save()
    add_monday_shift(doctor_user)
    appointment_factory(
        doctor=doctor_user,
        start_datetime=dt("09:00"),
        end_datetime=dt("09:30"),
    )

    availability = staff_client.get(
        "/api/appointments/availability/",
        {"doctor_id": doctor_user.id, "date": MONDAY.isoformat(), "duration_minutes": 30},
    )
    creation = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, duration=30),
        format="json",
    )

    assert not any(
        slot["start_datetime"].startswith("2026-07-20T09:00:00")
        for slot in availability.data["available_slots"]
    )
    assert creation.status_code == 409
    assert creation.data["code"] == "DOCTOR_ALREADY_BOOKED"


@pytest.mark.django_db
def test_closed_clinic_precedes_leave_and_availability_is_empty(
    staff_client,
    patient,
    doctor_user,
):
    WorkingShift.objects.create(
        employee=doctor_user,
        name="Stored closed-day shift",
        weekday=4,
        start_time="09:00",
        end_time="10:00",
        is_active=True,
    )
    AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-17T09:00:00+03:00",
        end_datetime="2026-07-17T10:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )

    availability = staff_client.get(
        "/api/appointments/availability/",
        {"doctor_id": doctor_user.id, "date": "2026-07-17", "duration_minutes": 60},
    )
    creation = staff_client.post(
        "/api/appointments/",
        appointment_payload(
            patient,
            doctor_user,
            start="2026-07-17T09:00:00+03:00",
        ),
        format="json",
    )

    assert availability.status_code == 200
    assert availability.data["available_slots"] == []
    assert creation.status_code == 409
    assert creation.data["code"] == "CLINIC_CLOSED_DAY"


@pytest.mark.django_db
def test_leave_rejection_remains_independent_of_available_capacity(
    staff_client,
    patient,
    doctor_user,
):
    add_monday_shift(doctor_user)
    AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime=dt("09:00"),
        end_datetime=dt("10:00"),
        type=AvailabilityException.Type.UNAVAILABLE,
    )

    availability = staff_client.get(
        "/api/appointments/availability/",
        {"doctor_id": doctor_user.id, "date": MONDAY.isoformat(), "duration_minutes": 60},
    )
    creation = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user),
        format="json",
    )

    assert availability.data["available_slots"] == []
    assert creation.status_code == 409
    assert creation.data["code"] == "DOCTOR_UNAVAILABLE"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("period", "start", "end", "inside"),
    [
        (
            "day",
            "2026-07-20T00:00:00+03:00",
            "2026-07-21T00:00:00+03:00",
            "2026-07-20T23:45:00+03:00",
        ),
        (
            "week",
            "2026-07-20T00:00:00+03:00",
            "2026-07-27T00:00:00+03:00",
            "2026-07-26T23:45:00+03:00",
        ),
        (
            "month",
            "2026-07-01T00:00:00+03:00",
            "2026-08-01T00:00:00+03:00",
            "2026-07-31T23:45:00+03:00",
        ),
    ],
)
def test_day_week_month_list_bounds_are_half_open(
    admin_client,
    appointment_factory,
    period,
    start,
    end,
    inside,
):
    del period
    lower = appointment_factory(
        start_datetime=start,
        end_datetime=datetime.fromisoformat(start) + timedelta(minutes=15),
        duration_minutes=15,
    )
    interior = appointment_factory(
        start_datetime=inside,
        end_datetime=datetime.fromisoformat(inside) + timedelta(minutes=15),
        duration_minutes=15,
    )
    upper = appointment_factory(
        start_datetime=end,
        end_datetime=datetime.fromisoformat(end) + timedelta(minutes=15),
        duration_minutes=15,
    )
    before = datetime.fromisoformat(start) - timedelta(minutes=15)
    appointment_factory(
        start_datetime=before,
        end_datetime=before + timedelta(minutes=15),
        duration_minutes=15,
    )

    response = admin_client.get(
        "/api/appointments/",
        {"start_from": start, "start_to": end},
    )

    assert response.status_code == 200
    assert response.data["count"] == 2
    result_ids = {row["id"] for row in response.data["results"]}
    assert result_ids == {lower.id, interior.id}
    assert upper.id not in result_ids
