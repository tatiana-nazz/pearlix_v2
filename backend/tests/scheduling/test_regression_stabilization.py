from datetime import date

import pytest
from django.utils import timezone

from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.scheduling.services import build_availability_slots


MONDAY = date(2026, 7, 20)


def add_shift(doctor, *, weekday=0, start="09:00", end="12:00"):
    return WorkingShift.objects.create(
        employee=doctor,
        name="Regression shift",
        weekday=weekday,
        start_time=start,
        end_time=end,
        is_active=True,
    )


def appointment_payload(patient, doctor, start_datetime):
    return {
        "patient_id": patient.id,
        "doctor_id": doctor.id,
        "start_datetime": start_datetime,
        "duration_minutes": 30,
    }


@pytest.mark.django_db
def test_capacity_uses_overlapping_intervals_not_matching_start_times(staff_client, patient, patient_factory, doctor_user, other_doctor_user, appointment_factory):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_shift(doctor_user)
    add_shift(other_doctor_user)
    appointment_factory(
        patient=patient_factory(phone="0944111111"),
        doctor=other_doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
    )

    response = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-20T09:30:00+03:00"),
        format="json",
    )

    assert response.status_code == 409
    assert response.data["code"] == "CAPACITY_FULL"


@pytest.mark.django_db
def test_available_override_enables_slots_and_unavailable_exception_takes_precedence(admin_client, staff_client, patient, doctor_user):
    override = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
        type=AvailabilityException.Type.AVAILABLE_OVERRIDE,
    )

    initial = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date={MONDAY.isoformat()}&duration_minutes=30")
    assert initial.status_code == 200
    assert any(slot["start_datetime"].startswith("2026-07-20T09:00:00") for slot in initial.data["available_slots"])

    unavailable = admin_client.post(
        "/api/availability-exceptions/",
        {
            "doctor_id": doctor_user.id,
            "start_datetime": "2026-07-20T09:15:00+03:00",
            "end_datetime": "2026-07-20T09:45:00+03:00",
            "type": AvailabilityException.Type.UNAVAILABLE,
        },
        format="json",
    )
    assert unavailable.status_code == 201

    blocked = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, "2026-07-20T09:15:00+03:00"),
        format="json",
    )
    refreshed = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date={MONDAY.isoformat()}&duration_minutes=30")

    assert override.is_cancelled is False
    assert blocked.status_code == 409
    assert blocked.data["code"] == "DOCTOR_UNAVAILABLE"
    assert not any(slot["start_datetime"].startswith("2026-07-20T09:15:00") for slot in refreshed.data["available_slots"])


@pytest.mark.django_db
def test_today_availability_excludes_past_slots_and_uses_clinic_timezone(staff_client, doctor_user):
    settings = ClinicSettings.get_solo()
    settings.timezone = "Asia/Damascus"
    settings.save()
    add_shift(doctor_user, weekday=2, start="09:00", end="14:00")

    with timezone.override("UTC"):
        slots = build_availability_slots(doctor=doctor_user, date_value=date(2026, 7, 15), duration_minutes=30)

    assert slots
    assert all(slot["start_datetime"] > "2026-07-15T12:00:00+03:00" for slot in slots)
    assert slots[0]["start_datetime"].endswith("+03:00")


@pytest.mark.django_db
def test_clinic_timezone_and_availability_validation_errors_are_field_specific(admin_client, staff_client, doctor_user):
    invalid_timezone = admin_client.patch("/api/clinic/settings/", {"timezone": "Not/AZone"}, format="json")
    invalid_date = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=not-a-date")
    invalid_duration = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date={MONDAY.isoformat()}&duration_minutes=bad")

    assert invalid_timezone.status_code == 400
    assert "timezone" in invalid_timezone.data["details"]
    assert invalid_date.status_code == 400
    assert "date" in invalid_date.data["details"]
    assert invalid_duration.status_code == 400
    assert "duration_minutes" in invalid_duration.data["details"]
