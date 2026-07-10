import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.models import ActivityLog
from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour
from apps.visits.models import Visit


def exception_payload(target_key="doctor_id", target_id=None, **overrides):
    payload = {
        target_key: target_id,
        "start_datetime": "2026-07-12T09:00:00+03:00",
        "end_datetime": "2026-07-12T10:00:00+03:00",
        "type": "UNAVAILABLE",
        "reason": "Out of clinic",
    }
    payload.update(overrides)
    return payload


def add_working_hour(doctor, weekday=0, start="09:00", end="17:00"):
    return WorkingHour.objects.create(doctor=doctor, weekday=weekday, start_time=start, end_time=end, is_active=True)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/availability-exceptions/"),
        ("post", "/api/availability-exceptions/"),
        ("get", "/api/availability-exceptions/{id}/"),
        ("patch", "/api/availability-exceptions/{id}/"),
        ("delete", "/api/availability-exceptions/{id}/"),
    ],
)
def test_unauthenticated_user_cannot_access_availability_exceptions(
    api_client,
    availability_exception_factory,
    doctor_user,
    method,
    path,
):
    exception = availability_exception_factory(doctor=doctor_user)

    response = getattr(api_client, method)(
        path.format(id=exception.id),
        exception_payload(target_id=doctor_user.id),
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_can_list_read_create_update_and_delete_is_rejected(admin_client, doctor_user, availability_exception_factory):
    existing = availability_exception_factory(doctor=doctor_user)

    list_response = admin_client.get("/api/availability-exceptions/")
    detail_response = admin_client.get(f"/api/availability-exceptions/{existing.id}/")
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(target_id=doctor_user.id),
        format="json",
    )
    update_response = admin_client.patch(
        f"/api/availability-exceptions/{existing.id}/",
        {"reason": "Updated reason"},
        format="json",
    )
    delete_response = admin_client.delete(f"/api/availability-exceptions/{existing.id}/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert create_response.status_code == 201
    assert create_response.data["doctor"]["id"] == doctor_user.id
    assert update_response.status_code == 200
    assert update_response.data["reason"] == "Updated reason"
    assert delete_response.status_code == 405
    assert AvailabilityException.objects.filter(id=existing.id).exists()


@pytest.mark.django_db
def test_staff_can_list_and_read_but_not_mutate_exceptions(staff_client, doctor_user, availability_exception_factory):
    exception = availability_exception_factory(doctor=doctor_user)

    assert staff_client.get("/api/availability-exceptions/").status_code == 200
    assert staff_client.get(f"/api/availability-exceptions/{exception.id}/").status_code == 200
    assert staff_client.post("/api/availability-exceptions/", exception_payload(target_id=doctor_user.id), format="json").status_code == 403
    assert staff_client.patch(f"/api/availability-exceptions/{exception.id}/", {"reason": "No"}, format="json").status_code == 403
    assert staff_client.post(f"/api/availability-exceptions/{exception.id}/cancel/").status_code == 403
    assert staff_client.delete(f"/api/availability-exceptions/{exception.id}/").status_code == 403


@pytest.mark.django_db
def test_doctor_can_list_and_read_own_but_not_mutate_exceptions(doctor_client, doctor_user, availability_exception_factory):
    exception = availability_exception_factory(doctor=doctor_user)

    list_response = doctor_client.get("/api/availability-exceptions/")
    detail_response = doctor_client.get(f"/api/availability-exceptions/{exception.id}/")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data["results"]] == [exception.id]
    assert detail_response.status_code == 200
    assert doctor_client.post("/api/availability-exceptions/", exception_payload(target_id=doctor_user.id), format="json").status_code == 403
    assert doctor_client.patch(f"/api/availability-exceptions/{exception.id}/", {"reason": "No"}, format="json").status_code == 403
    assert doctor_client.post(f"/api/availability-exceptions/{exception.id}/cancel/").status_code == 403
    assert doctor_client.delete(f"/api/availability-exceptions/{exception.id}/").status_code == 403


@pytest.mark.django_db
def test_staff_can_see_doctor_blocks_and_own_leave_but_not_unrelated_staff_leave(
    staff_client,
    staff_user,
    doctor_user,
    availability_exception_factory,
):
    doctor_exception = availability_exception_factory(doctor=doctor_user, reason="Doctor scheduling block")
    own_staff_leave = availability_exception_factory(
        doctor=None,
        staff=staff_user,
        reason="Own staff leave",
        start_datetime="2026-07-11T09:00:00+03:00",
        end_datetime="2026-07-11T10:00:00+03:00",
    )
    other_staff = User.objects.create_user(
        email="other-staff-leave@example.com",
        password="password123",
        full_name="Other Staff Leave",
        role=User.Role.STAFF,
        must_change_password=False,
    )
    other_staff_leave = availability_exception_factory(
        doctor=None,
        staff=other_staff,
        reason="Other staff leave",
        start_datetime="2026-07-12T11:00:00+03:00",
        end_datetime="2026-07-12T12:00:00+03:00",
    )

    list_response = staff_client.get("/api/availability-exceptions/")
    own_filter_response = staff_client.get(f"/api/availability-exceptions/?staff_id={staff_user.id}")
    other_filter_response = staff_client.get(f"/api/availability-exceptions/?staff_id={other_staff.id}")

    listed_ids = {item["id"] for item in list_response.data["results"]}
    assert list_response.status_code == 200
    assert doctor_exception.id in listed_ids
    assert own_staff_leave.id in listed_ids
    assert other_staff_leave.id not in listed_ids
    assert [item["id"] for item in own_filter_response.data["results"]] == [own_staff_leave.id]
    assert other_filter_response.data["count"] == 0


@pytest.mark.django_db
def test_doctor_cannot_read_another_doctors_or_staff_exception(doctor_client, other_doctor_user, staff_user, availability_exception_factory):
    exception = availability_exception_factory(doctor=other_doctor_user)
    staff_leave = availability_exception_factory(
        doctor=None,
        staff=staff_user,
        reason="Staff leave",
        start_datetime="2026-07-11T09:00:00+03:00",
        end_datetime="2026-07-11T10:00:00+03:00",
    )

    response = doctor_client.get(f"/api/availability-exceptions/{exception.id}/")
    staff_response = doctor_client.get(f"/api/availability-exceptions/{staff_leave.id}/")

    assert response.status_code == 404
    assert staff_response.status_code == 404


@pytest.mark.django_db
def test_admin_can_create_update_and_cancel_leave(admin_client, doctor_user):
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(target_id=doctor_user.id),
        format="json",
    )
    update_response = admin_client.patch(
        f"/api/availability-exceptions/{create_response.data['id']}/",
        {"reason": "Updated admin leave"},
        format="json",
    )
    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert update_response.data["reason"] == "Updated admin leave"
    assert cancel_response.status_code == 200
    assert cancel_response.data["is_cancelled"] is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        exception_payload(target_id=None, start_datetime="2026-07-12T10:00:00+03:00", end_datetime="2026-07-12T09:00:00+03:00"),
        exception_payload(target_id=None, start_datetime="2026-07-12T09:00:00+03:00", end_datetime="2026-07-12T09:00:00+03:00"),
        exception_payload(target_id=None, type="VACATION"),
        {"start_datetime": "2026-07-12T09:00:00+03:00", "end_datetime": "2026-07-12T10:00:00+03:00", "type": "UNAVAILABLE"},
    ],
)
def test_invalid_exception_payloads_rejected(admin_client, doctor_user, payload):
    if "doctor_id" in payload and payload["doctor_id"] is None:
        payload["doctor_id"] = doctor_user.id

    response = admin_client.post("/api/availability-exceptions/", payload, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_non_doctor_and_non_staff_targets_rejected(admin_client, admin_user):
    response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(target_id=admin_user.id),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_staff_target_exception_is_valid(admin_client, staff_user):
    response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(target_key="staff_id", target_id=staff_user.id),
        format="json",
    )

    assert response.status_code == 201
    assert response.data["staff"]["id"] == staff_user.id


@pytest.mark.django_db
def test_doctor_unavailable_exception_marks_future_overlapping_appointments_needs_reschedule(
    admin_client,
    doctor_user,
    appointment_factory,
    visit_factory,
):
    overlapping = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    overlapping_checked_in = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T09:30:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
    )
    second_overlap = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T10:30:00+03:00",
        end_datetime="2026-07-20T11:00:00+03:00",
    )
    non_overlapping = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T12:00:00+03:00",
        end_datetime="2026-07-20T12:30:00+03:00",
    )
    completed = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    cancelled = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.CANCELLED,
        start_datetime="2026-07-20T09:30:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
    )
    no_show = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.NO_SHOW,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    active = appointment_factory(
        doctor=doctor_user,
        status=Appointment.Status.ACTIVE,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    visit_factory(appointment=active, status=Visit.Status.ACTIVE)

    response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T11:00:00+03:00",
        ),
        format="json",
    )

    assert response.status_code == 201
    for appointment in (overlapping, overlapping_checked_in, second_overlap):
        appointment.refresh_from_db()
        assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
        assert appointment.reschedule_source_exception_id == response.data["id"]
        assert appointment.reschedule_previous_status in {Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN}
    for appointment, expected_status in (
        (non_overlapping, Appointment.Status.UPCOMING),
        (completed, Appointment.Status.COMPLETED),
        (cancelled, Appointment.Status.CANCELLED),
        (no_show, Appointment.Status.NO_SHOW),
        (active, Appointment.Status.ACTIVE),
    ):
        appointment.refresh_from_db()
        assert appointment.status == expected_status
    assert ActivityLog.objects.filter(action="availability_exception_created", entity_id=str(response.data["id"])).exists()
    assert ActivityLog.objects.filter(action="appointment_marked_needs_reschedule").count() == 3


@pytest.mark.django_db
def test_cancel_doctor_leave_restores_still_unrescheduled_appointment(admin_client, doctor_user, appointment_factory):
    add_working_hour(doctor_user, weekday=0, start="09:00", end="12:00")
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert cancel_response.status_code == 200
    assert cancel_response.data["is_cancelled"] is True
    assert cancel_response.data["restored_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert appointment.reschedule_source_exception_id is None
    assert appointment.reschedule_previous_status is None
    assert ActivityLog.objects.filter(action="availability_exception_cancelled", entity_id=str(create_response.data["id"])).exists()
    assert ActivityLog.objects.filter(action="appointment_restored_from_reschedule", entity_id=str(appointment.id)).exists()


@pytest.mark.django_db
def test_cancelled_leave_no_longer_blocks_scheduling(admin_client, staff_client, doctor_user, patient):
    add_working_hour(doctor_user, weekday=0, start="09:00", end="12:00")
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )
    admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    response = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient.id,
            "doctor_id": doctor_user.id,
            "start_datetime": "2026-07-20T09:00:00+03:00",
            "duration_minutes": 30,
        },
        format="json",
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_cancel_leave_after_staff_reschedule_does_not_move_appointment_back(
    admin_client,
    staff_client,
    doctor_user,
    appointment_factory,
):
    add_working_hour(doctor_user, weekday=0, start="09:00", end="12:00")
    add_working_hour(doctor_user, weekday=1, start="09:00", end="12:00")
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    reschedule_response = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"start_datetime": "2026-07-21T09:00:00+03:00", "duration_minutes": 30},
        format="json",
    )
    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert reschedule_response.status_code == 200
    assert cancel_response.status_code == 200
    assert cancel_response.data["restored_appointments_count"] == 0
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING
    assert timezone.localtime(appointment.start_datetime).isoformat().startswith("2026-07-21T09:00:00")
    assert appointment.reschedule_source_exception_id is None


@pytest.mark.django_db
def test_cancel_leave_keeps_needs_reschedule_when_another_active_leave_blocks_slot(
    admin_client,
    doctor_user,
    appointment_factory,
    availability_exception_factory,
):
    add_working_hour(doctor_user, weekday=0, start="09:00", end="12:00")
    appointment = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )
    availability_exception_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
    )

    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert cancel_response.status_code == 200
    assert cancel_response.data["restored_appointments_count"] == 0
    assert cancel_response.data["still_blocked_appointments_count"] == 1
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
    assert appointment.reschedule_source_exception_id == create_response.data["id"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "appointment_status",
    [Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW],
)
def test_cancel_leave_does_not_affect_completed_cancelled_or_no_show_appointments(
    admin_client,
    doctor_user,
    appointment_factory,
    appointment_status,
):
    appointment = appointment_factory(
        doctor=doctor_user,
        status=appointment_status,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert cancel_response.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == appointment_status


@pytest.mark.django_db
def test_staff_leave_cancel_does_not_affect_appointments(admin_client, staff_user, appointment_factory):
    appointment = appointment_factory(
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_key="staff_id",
            target_id=staff_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    cancel_response = admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    assert cancel_response.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING


@pytest.mark.django_db
def test_updating_cancelled_leave_is_rejected(admin_client, doctor_user):
    create_response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(target_id=doctor_user.id),
        format="json",
    )
    admin_client.post(f"/api/availability-exceptions/{create_response.data['id']}/cancel/")

    response = admin_client.patch(
        f"/api/availability-exceptions/{create_response.data['id']}/",
        {"reason": "Should not update"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_doctor_unavailable_exception_does_not_mark_past_appointments(admin_client, doctor_user, appointment_factory):
    past = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-08T09:00:00+03:00",
        end_datetime="2026-07-08T09:30:00+03:00",
    )

    response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_id=doctor_user.id,
            start_datetime="2026-07-08T09:00:00+03:00",
            end_datetime="2026-07-08T10:00:00+03:00",
        ),
        format="json",
    )

    assert response.status_code == 201
    past.refresh_from_db()
    assert past.status == Appointment.Status.UPCOMING


@pytest.mark.django_db
def test_staff_availability_exception_is_visibility_only(admin_client, staff_user, appointment_factory):
    appointment = appointment_factory(
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )

    response = admin_client.post(
        "/api/availability-exceptions/",
        exception_payload(
            target_key="staff_id",
            target_id=staff_user.id,
            start_datetime="2026-07-20T09:00:00+03:00",
            end_datetime="2026-07-20T10:00:00+03:00",
        ),
        format="json",
    )

    assert response.status_code == 201
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.UPCOMING


@pytest.mark.django_db
def test_availability_exception_update_marks_newly_overlapping_without_auto_restore(
    admin_client,
    doctor_user,
    availability_exception_factory,
    appointment_factory,
):
    exception = availability_exception_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    already_marked = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    newly_overlapping = appointment_factory(
        doctor=doctor_user,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )

    expand_response = admin_client.patch(
        f"/api/availability-exceptions/{exception.id}/",
        {"end_datetime": "2026-07-20T10:30:00+03:00"},
        format="json",
    )
    shrink_response = admin_client.patch(
        f"/api/availability-exceptions/{exception.id}/",
        {"end_datetime": "2026-07-20T09:15:00+03:00"},
        format="json",
    )

    assert expand_response.status_code == 200
    assert shrink_response.status_code == 200
    already_marked.refresh_from_db()
    newly_overlapping.refresh_from_db()
    assert already_marked.status == Appointment.Status.NEEDS_RESCHEDULE
    assert newly_overlapping.status == Appointment.Status.NEEDS_RESCHEDULE
    assert ActivityLog.objects.filter(action="availability_exception_updated", entity_id=str(exception.id)).count() == 2


@pytest.mark.django_db
def test_exception_filters_by_target_date_range_and_type(admin_client, doctor_user, other_doctor_user, availability_exception_factory):
    matching = availability_exception_factory(
        doctor=doctor_user,
        start_datetime="2026-07-15T09:00:00+03:00",
        end_datetime="2026-07-15T10:00:00+03:00",
    )
    availability_exception_factory(
        doctor=other_doctor_user,
        start_datetime="2026-07-16T09:00:00+03:00",
        end_datetime="2026-07-16T10:00:00+03:00",
    )

    response = admin_client.get(
        f"/api/availability-exceptions/?doctor_id={doctor_user.id}&start_from=2026-07-15T00:00:00%2B03:00&end_to=2026-07-15T23:00:00%2B03:00&type=UNAVAILABLE"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [matching.id]
