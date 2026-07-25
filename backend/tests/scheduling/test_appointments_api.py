import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.models import ActivityLog
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift


FUTURE_START = "2026-07-20T09:00:00+03:00"


def appointment_payload(patient, doctor, **overrides):
    payload = {
        "patient_id": patient.id,
        "doctor_id": doctor.id,
        "start_datetime": FUTURE_START,
        "duration_minutes": 30,
        "reason": "Tooth pain",
        "notes": "Pain in lower left molar.",
    }
    payload.update(overrides)
    return payload


def add_working_hour(doctor, weekday=0, start="09:00", end="17:00"):
    return WorkingShift.objects.create(employee=doctor, name="Test shift", weekday=weekday, start_time=start, end_time=end)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/appointments/"),
        ("post", "/api/appointments/"),
        ("get", "/api/appointments/{id}/"),
        ("patch", "/api/appointments/{id}/"),
        ("post", "/api/appointments/{id}/check-in/"),
        ("post", "/api/appointments/{id}/cancel/"),
        ("post", "/api/appointments/{id}/no-show/"),
        ("get", "/api/appointments/availability/"),
    ],
)
def test_unauthenticated_user_cannot_access_appointment_endpoints(api_client, appointment_factory, patient, doctor_user, method, path):
    appointment = appointment_factory()

    response = getattr(api_client, method)(
        path.format(id=appointment.id),
        appointment_payload(patient, doctor_user),
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_can_list_and_read_but_cannot_mutate_appointments(admin_client, appointment_factory, patient, doctor_user):
    appointment = appointment_factory()

    assert admin_client.get("/api/appointments/").status_code == 200
    assert admin_client.get(f"/api/appointments/{appointment.id}/").status_code == 200
    assert admin_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json").status_code == 403
    assert admin_client.patch(f"/api/appointments/{appointment.id}/", {"reason": "No"}, format="json").status_code == 403
    assert admin_client.post(f"/api/appointments/{appointment.id}/check-in/").status_code == 403
    assert admin_client.post(f"/api/appointments/{appointment.id}/cancel/").status_code == 403
    assert admin_client.post(f"/api/appointments/{appointment.id}/no-show/").status_code == 403


@pytest.mark.django_db
def test_staff_can_create_read_update_and_transition_appointment(staff_client, staff_user, patient, doctor_user):
    add_working_hour(doctor_user)

    create_response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")

    assert create_response.status_code == 201
    appointment = Appointment.objects.get(id=create_response.data["id"])
    assert appointment.created_by == staff_user
    assert appointment.updated_by == staff_user
    assert create_response.data["end_datetime"].startswith("2026-07-20T09:30:00")
    assert "password" not in create_response.data["doctor"]

    update_response = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"reason": "Updated reason"},
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data["reason"] == "Updated reason"

    check_in_response = staff_client.post(f"/api/appointments/{appointment.id}/check-in/")
    assert check_in_response.status_code == 200
    assert check_in_response.data["status"] == Appointment.Status.CHECKED_IN

    cancel_response = staff_client.post(f"/api/appointments/{appointment.id}/cancel/")
    assert cancel_response.status_code == 200
    assert cancel_response.data["status"] == Appointment.Status.CANCELLED


@pytest.mark.django_db
def test_doctor_permissions_are_own_read_only(doctor_client, doctor_user, other_doctor_user, appointment_factory):
    own = appointment_factory(doctor=doctor_user)
    other = appointment_factory(doctor=other_doctor_user)

    list_response = doctor_client.get("/api/appointments/")
    own_response = doctor_client.get(f"/api/appointments/{own.id}/")
    other_response = doctor_client.get(f"/api/appointments/{other.id}/")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data["results"]] == [own.id]
    assert own_response.status_code == 200
    assert other_response.status_code == 404
    assert doctor_client.post("/api/appointments/", {}, format="json").status_code == 403
    assert doctor_client.patch(f"/api/appointments/{own.id}/", {"reason": "No"}, format="json").status_code == 403
    assert doctor_client.post(f"/api/appointments/{own.id}/check-in/").status_code == 403
    assert doctor_client.post(f"/api/appointments/{own.id}/cancel/").status_code == 403
    assert doctor_client.post(f"/api/appointments/{own.id}/no-show/").status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("payload_overrides", "expected_field"),
    [
        ({"patient_id": None}, "patient_id"),
        ({"patient_id": 9999}, "patient_id"),
        ({"doctor_id": None}, "doctor_id"),
        ({"duration_minutes": 10}, "duration_minutes"),
        ({"start_datetime": "2020-01-01T09:00:00+03:00"}, "start_datetime"),
    ],
)
def test_create_validation_rejects_invalid_payloads(staff_client, patient, doctor_user, payload_overrides, expected_field):
    add_working_hour(doctor_user)
    payload = appointment_payload(patient, doctor_user)
    if "patient_id" in payload_overrides and payload_overrides["patient_id"] is None:
        payload.pop("patient_id")
    elif "doctor_id" in payload_overrides and payload_overrides["doctor_id"] is None:
        payload.pop("doctor_id")
    else:
        payload.update(payload_overrides)

    response = staff_client.post("/api/appointments/", payload, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert expected_field in response.data["details"]


@pytest.mark.django_db
def test_staff_cannot_create_an_appointment_for_an_archived_patient(staff_client, patient, doctor_user):
    add_working_hour(doctor_user)
    patient.is_archived = True
    patient.save(update_fields=["is_archived", "updated_at"])

    response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "patient_id" in response.data["details"]


@pytest.mark.django_db
def test_non_doctor_and_inactive_doctor_rejected(staff_client, patient, staff_user):
    inactive_doctor = User.objects.create_user(
        email="inactive-doctor2@example.com",
        password="password123",
        full_name="Inactive Doctor",
        role=User.Role.DOCTOR,
        is_active=False,
    )

    non_doctor_response = staff_client.post("/api/appointments/", appointment_payload(patient, staff_user), format="json")
    inactive_response = staff_client.post("/api/appointments/", appointment_payload(patient, inactive_doctor), format="json")

    assert non_doctor_response.status_code == 400
    assert inactive_response.status_code == 400


@pytest.mark.django_db
def test_omitted_duration_uses_clinic_default_and_frontend_end_datetime_is_ignored(staff_client, patient, doctor_user):
    add_working_hour(doctor_user)
    payload = appointment_payload(patient, doctor_user, end_datetime="2026-07-20T12:00:00+03:00")
    payload.pop("duration_minutes")

    response = staff_client.post("/api/appointments/", payload, format="json")

    assert response.status_code == 201
    assert response.data["duration_minutes"] == 30
    assert response.data["end_datetime"].startswith("2026-07-20T09:30:00")


@pytest.mark.django_db
def test_working_hours_and_unavailable_exception_are_enforced(staff_client, patient, doctor_user):
    no_hours_response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")
    assert no_hours_response.status_code == 409
    assert no_hours_response.data["code"] == "OUTSIDE_WORKING_HOURS"

    WorkingShift.objects.create(employee=doctor_user, name="Short shift", weekday=0, start_time="09:00", end_time="09:15")
    partial_response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")
    assert partial_response.status_code == 409
    assert partial_response.data["code"] == "OUTSIDE_WORKING_HOURS"

    WorkingShift.objects.filter(employee=doctor_user).delete()
    add_working_hour(doctor_user)
    AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    unavailable_response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")
    assert unavailable_response.status_code == 409
    assert unavailable_response.data["code"] == "DOCTOR_UNAVAILABLE"


@pytest.mark.django_db
@pytest.mark.parametrize("blocking_status", [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN, Appointment.Status.ACTIVE])
def test_capacity_counts_active_statuses(staff_client, patient, patient_factory, doctor_user, other_doctor_user, appointment_factory, blocking_status):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user)
    add_working_hour(other_doctor_user)
    other_patient = patient_factory(phone="0944111111")
    appointment_factory(patient=other_patient, doctor=other_doctor_user, status=blocking_status)

    response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")

    assert response.status_code == 409
    assert response.data["code"] == "CAPACITY_FULL"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ignored_status",
    [Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW, Appointment.Status.COMPLETED, Appointment.Status.NEEDS_RESCHEDULE],
)
def test_capacity_and_doctor_conflict_ignore_inactive_statuses(staff_client, patient, doctor_user, appointment_factory, ignored_status):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user)
    appointment_factory(doctor=doctor_user, status=ignored_status)

    response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")

    assert response.status_code == 201


@pytest.mark.django_db
def test_admin_cannot_override_capacity(admin_client, patient, doctor_user, other_doctor_user, appointment_factory):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user)
    appointment_factory(doctor=other_doctor_user)

    response = admin_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_doctor_conflict_rules(staff_client, patient, doctor_user, other_doctor_user, appointment_factory):
    add_working_hour(doctor_user, end="18:00")
    add_working_hour(other_doctor_user, end="18:00")
    appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T09:00:00+03:00", end_datetime="2026-07-20T09:30:00+03:00")

    exact_response = staff_client.post("/api/appointments/", appointment_payload(patient, doctor_user), format="json")
    overlap_response = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, start_datetime="2026-07-20T09:15:00+03:00"),
        format="json",
    )
    non_overlap_response = staff_client.post(
        "/api/appointments/",
        appointment_payload(patient, doctor_user, start_datetime="2026-07-20T09:30:00+03:00"),
        format="json",
    )
    different_doctor_response = staff_client.post("/api/appointments/", appointment_payload(patient, other_doctor_user), format="json")

    assert exact_response.status_code == 409
    assert exact_response.data["code"] == "DOCTOR_ALREADY_BOOKED"
    assert overlap_response.status_code == 409
    assert overlap_response.data["code"] == "DOCTOR_ALREADY_BOOKED"
    assert non_overlap_response.status_code == 201
    assert different_doctor_response.status_code == 201


@pytest.mark.django_db
def test_staff_update_revalidates_rules_and_rejects_direct_status_change(staff_client, patient, doctor_user, other_doctor_user, appointment_factory):
    add_working_hour(doctor_user, end="17:00")
    add_working_hour(other_doctor_user, end="17:00")
    appointment = appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T10:00:00+03:00", end_datetime="2026-07-20T10:30:00+03:00")
    appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T11:00:00+03:00", end_datetime="2026-07-20T11:30:00+03:00")

    status_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"status": "CANCELLED"}, format="json")
    conflict_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"start_datetime": "2026-07-20T11:00:00+03:00"}, format="json")
    hours_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"start_datetime": "2026-07-20T18:00:00+03:00"}, format="json")

    AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T12:00:00+03:00",
        end_datetime="2026-07-20T13:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    unavailable_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"start_datetime": "2026-07-20T12:00:00+03:00"}, format="json")

    assert status_response.status_code == 400
    assert conflict_response.status_code == 409
    assert conflict_response.data["code"] == "DOCTOR_ALREADY_BOOKED"
    assert hours_response.status_code == 409
    assert hours_response.data["code"] == "OUTSIDE_WORKING_HOURS"
    assert unavailable_response.status_code == 409
    assert unavailable_response.data["code"] == "DOCTOR_UNAVAILABLE"


@pytest.mark.django_db
def test_update_revalidates_capacity_and_locked_statuses_are_not_editable(staff_client, patient, doctor_user, other_doctor_user, appointment_factory):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user, end="17:00")
    add_working_hour(other_doctor_user, end="17:00")
    appointment = appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T10:00:00+03:00", end_datetime="2026-07-20T10:30:00+03:00")
    appointment_factory(doctor=other_doctor_user, start_datetime="2026-07-20T11:00:00+03:00", end_datetime="2026-07-20T11:30:00+03:00")
    locked = appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T12:00:00+03:00", end_datetime="2026-07-20T12:30:00+03:00", status=Appointment.Status.CANCELLED)

    capacity_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"start_datetime": "2026-07-20T11:00:00+03:00"}, format="json")
    locked_response = staff_client.patch(f"/api/appointments/{locked.id}/", {"reason": "No"}, format="json")

    assert capacity_response.status_code == 409
    assert capacity_response.data["code"] == "CAPACITY_FULL"
    assert locked_response.status_code == 409
    assert locked_response.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_needs_reschedule_serializes_filters_and_blocks_status_actions(staff_client, doctor_client, doctor_user, appointment_factory):
    appointment = appointment_factory(status=Appointment.Status.NEEDS_RESCHEDULE)

    list_response = staff_client.get(f"/api/appointments/?status={Appointment.Status.NEEDS_RESCHEDULE}")
    detail_response = staff_client.get(f"/api/appointments/{appointment.id}/")
    doctor_list_response = doctor_client.get(f"/api/appointments/?status={Appointment.Status.NEEDS_RESCHEDULE}")
    check_in_response = staff_client.post(f"/api/appointments/{appointment.id}/check-in/")
    no_show_response = staff_client.post(f"/api/appointments/{appointment.id}/no-show/")
    cancel_response = staff_client.post(f"/api/appointments/{appointment.id}/cancel/")
    start_visit_response = doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")
    spoof_response = staff_client.patch(f"/api/appointments/{appointment.id}/", {"status": Appointment.Status.NEEDS_RESCHEDULE}, format="json")

    assert list_response.status_code == 200
    assert list_response.data["count"] == 1
    assert list_response.data["results"][0]["status"] == Appointment.Status.NEEDS_RESCHEDULE
    assert detail_response.status_code == 200
    assert detail_response.data["status"] == Appointment.Status.NEEDS_RESCHEDULE
    assert doctor_list_response.status_code == 200
    assert [item["id"] for item in doctor_list_response.data["results"]] == [appointment.id]
    assert appointment.doctor_id == doctor_user.id
    for response in (check_in_response, no_show_response, cancel_response, start_visit_response):
        assert response.status_code == 409
        assert response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert spoof_response.status_code == 400
    assert spoof_response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_staff_can_reschedule_needs_reschedule_appointment_to_valid_slot(
    staff_client,
    appointment_factory,
    doctor_user,
    availability_exception_factory,
):
    add_working_hour(doctor_user, weekday=1, start="09:00", end="12:00")
    source_exception = availability_exception_factory(doctor=doctor_user)
    appointment = appointment_factory(
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
        reschedule_source_exception=source_exception,
        reschedule_previous_status=Appointment.Status.UPCOMING,
    )

    response = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"start_datetime": "2026-07-21T09:00:00+03:00", "duration_minutes": 30},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == Appointment.Status.UPCOMING
    assert response.data["start_datetime"].startswith("2026-07-21T09:00:00")
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_exception_id is None
    assert appointment.reschedule_previous_status is None
    assert ActivityLog.objects.filter(action="appointment_rescheduled", entity_id=str(appointment.id)).exists()


@pytest.mark.django_db
def test_needs_reschedule_reschedule_validates_slot_rules(
    staff_client,
    appointment_factory,
    doctor_user,
    other_doctor_user,
):
    add_working_hour(doctor_user, weekday=1, start="09:00", end="12:00")
    add_working_hour(other_doctor_user, weekday=1, start="09:00", end="12:00")
    conflict = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-21T09:00:00+03:00",
        end_datetime="2026-07-21T09:30:00+03:00",
    )
    target = appointment_factory(
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )

    conflict_response = staff_client.patch(
        f"/api/appointments/{target.id}/",
        {"start_datetime": "2026-07-21T09:00:00+03:00"},
        format="json",
    )
    unavailable = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-21T09:30:00+03:00",
        end_datetime="2026-07-21T10:00:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    unavailable_response = staff_client.patch(
        f"/api/appointments/{target.id}/",
        {"start_datetime": "2026-07-21T09:30:00+03:00"},
        format="json",
    )
    hours_response = staff_client.patch(
        f"/api/appointments/{target.id}/",
        {"start_datetime": "2026-07-21T12:00:00+03:00"},
        format="json",
    )
    past_response = staff_client.patch(
        f"/api/appointments/{target.id}/",
        {"start_datetime": "2020-01-01T09:00:00+03:00"},
        format="json",
    )

    assert conflict.status == Appointment.Status.UPCOMING
    assert unavailable.type == AvailabilityException.Type.UNAVAILABLE
    assert conflict_response.status_code == 409
    assert conflict_response.data["code"] == "DOCTOR_ALREADY_BOOKED"
    assert unavailable_response.status_code == 409
    assert unavailable_response.data["code"] == "DOCTOR_UNAVAILABLE"
    assert hours_response.status_code == 409
    assert hours_response.data["code"] == "OUTSIDE_WORKING_HOURS"
    assert past_response.status_code == 400
    assert past_response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_needs_reschedule_reschedule_rejects_capacity_and_roles(
    api_client,
    admin_client,
    doctor_client,
    staff_client,
    appointment_factory,
    doctor_user,
    other_doctor_user,
):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user, weekday=1, start="09:00", end="12:00")
    add_working_hour(other_doctor_user, weekday=1, start="09:00", end="12:00")
    target = appointment_factory(
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    appointment_factory(
        doctor=other_doctor_user,
        start_datetime="2026-07-21T10:00:00+03:00",
        end_datetime="2026-07-21T10:30:00+03:00",
    )

    capacity_response = staff_client.patch(
        f"/api/appointments/{target.id}/",
        {"start_datetime": "2026-07-21T10:00:00+03:00"},
        format="json",
    )
    admin_response = admin_client.patch(f"/api/appointments/{target.id}/", {"start_datetime": "2026-07-21T09:00:00+03:00"}, format="json")
    doctor_response = doctor_client.patch(f"/api/appointments/{target.id}/", {"start_datetime": "2026-07-21T09:00:00+03:00"}, format="json")
    anonymous_response = api_client.patch(f"/api/appointments/{target.id}/", {"start_datetime": "2026-07-21T09:00:00+03:00"}, format="json")

    assert capacity_response.status_code == 409
    assert capacity_response.data["code"] == "CAPACITY_FULL"
    assert admin_response.status_code == 403
    assert doctor_response.status_code == 403
    assert anonymous_response.status_code == 401


@pytest.mark.django_db
def test_status_transition_rules(staff_client, appointment_factory):
    upcoming = appointment_factory(start_datetime="2026-07-20T13:00:00+03:00", end_datetime="2026-07-20T13:30:00+03:00")
    checked_in = appointment_factory(status=Appointment.Status.CHECKED_IN, start_datetime="2026-07-20T14:00:00+03:00", end_datetime="2026-07-20T14:30:00+03:00")
    cancelled = appointment_factory(status=Appointment.Status.CANCELLED, start_datetime="2026-07-20T15:00:00+03:00", end_datetime="2026-07-20T15:30:00+03:00")
    no_show = appointment_factory(status=Appointment.Status.NO_SHOW, start_datetime="2026-07-20T16:00:00+03:00", end_datetime="2026-07-20T16:30:00+03:00")

    assert staff_client.post(f"/api/appointments/{upcoming.id}/check-in/").status_code == 200
    assert staff_client.post(f"/api/appointments/{checked_in.id}/check-in/").status_code == 409
    assert staff_client.post(f"/api/appointments/{cancelled.id}/check-in/").status_code == 409
    assert staff_client.post(f"/api/appointments/{checked_in.id}/cancel/").status_code == 200
    assert staff_client.post(f"/api/appointments/{cancelled.id}/cancel/").status_code == 409
    assert staff_client.post(f"/api/appointments/{no_show.id}/cancel/").status_code == 409

    no_show_target = appointment_factory(start_datetime="2026-07-20T17:00:00+03:00", end_datetime="2026-07-20T17:30:00+03:00")
    assert staff_client.post(f"/api/appointments/{no_show_target.id}/no-show/").status_code == 200
    assert staff_client.post(f"/api/appointments/{checked_in.id}/no-show/").status_code == 409
    assert staff_client.post(f"/api/appointments/{cancelled.id}/no-show/").status_code == 409


@pytest.mark.django_db
def test_list_filters_and_pagination(admin_client, staff_client, doctor_client, patient, patient_factory, doctor_user, other_doctor_user, appointment_factory):
    other_patient = patient_factory(full_name="Other Patient", phone="0933555555")
    own = appointment_factory(patient=patient, doctor=doctor_user, status=Appointment.Status.UPCOMING)
    appointment_factory(patient=other_patient, doctor=other_doctor_user, status=Appointment.Status.CANCELLED, start_datetime="2026-07-21T09:00:00+03:00", end_datetime="2026-07-21T09:30:00+03:00")
    for index in range(20):
        appointment_factory(
            patient=patient,
            doctor=doctor_user,
            start_datetime=f"2026-07-22T{9 + (index // 2):02}:{(index % 2) * 30:02}:00+03:00",
            end_datetime=f"2026-07-22T{9 + (index // 2):02}:{30 if index % 2 == 0 else 59}:00+03:00",
        )

    assert admin_client.get("/api/appointments/").data["count"] == 22
    assert staff_client.get("/api/appointments/").data["count"] == 22
    assert doctor_client.get("/api/appointments/").data["count"] == 21
    assert admin_client.get(f"/api/appointments/?doctor_id={other_doctor_user.id}").data["count"] == 1
    assert admin_client.get(f"/api/appointments/?patient_id={patient.id}").data["count"] == 21
    assert admin_client.get("/api/appointments/?status=CANCELLED").data["count"] == 1
    assert admin_client.get("/api/appointments/?date=2026-07-20").data["count"] == 1
    range_response = admin_client.get("/api/appointments/?start_from=2026-07-21T00:00:00%2B03:00&start_to=2026-07-21T23:59:00%2B03:00")
    assert range_response.data["count"] == 1
    first_page = admin_client.get("/api/appointments/")
    assert first_page.data["next"] is not None
    assert len(first_page.data["results"]) == 20
    assert first_page.data["results"][0]["id"] == own.id
    assert first_page.data["clinic_date"] == timezone.localdate().isoformat()
    assert first_page.data["clinic_timezone"] == ClinicSettings.get_solo().timezone
    assert admin_client.get("/api/appointments/?search=Other").data["count"] == 1


@pytest.mark.django_db
def test_availability_preview_permissions_and_validation(admin_client, staff_client, doctor_client, doctor_user, other_doctor_user):
    add_working_hour(doctor_user)
    assert staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20").status_code == 200
    assert admin_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20").status_code == 200
    assert doctor_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20").status_code == 200
    assert doctor_client.get(f"/api/appointments/availability/?doctor_id={other_doctor_user.id}&date=2026-07-20").status_code == 403
    assert staff_client.get("/api/appointments/availability/?doctor_id=9999&date=2026-07-20").status_code == 404
    invalid_duration = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20&duration_minutes=10")
    assert invalid_duration.status_code == 400
    assert invalid_duration.data["code"] == "VALIDATION_ERROR"
    no_hours = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-21")
    assert no_hours.status_code == 200
    assert no_hours.data["available_slots"] == []


@pytest.mark.django_db
def test_availability_preview_removes_unavailable_conflict_and_capacity_full_slots(staff_client, patient, doctor_user, other_doctor_user, appointment_factory):
    settings = ClinicSettings.get_solo()
    settings.capacity_per_slot = 1
    settings.save()
    add_working_hour(doctor_user, start="09:00", end="10:00")
    add_working_hour(other_doctor_user, start="09:00", end="10:00")
    AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:30:00+03:00",
        end_datetime="2026-07-20T09:45:00+03:00",
        type=AvailabilityException.Type.UNAVAILABLE,
    )
    appointment_factory(doctor=other_doctor_user, start_datetime="2026-07-20T09:00:00+03:00", end_datetime="2026-07-20T09:30:00+03:00")
    appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T09:15:00+03:00", end_datetime="2026-07-20T09:45:00+03:00")

    response = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20&duration_minutes=15")

    assert response.status_code == 200
    starts = {slot["start_datetime"] for slot in response.data["available_slots"]}
    assert not any("09:00:00" in start for start in starts)
    assert not any("09:15:00" in start for start in starts)
    assert not any("09:30:00" in start for start in starts)
    assert any("09:45:00" in start for start in starts)
