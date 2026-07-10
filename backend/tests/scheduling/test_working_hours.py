import pytest

from apps.accounts.models import User
from apps.scheduling.models import WorkingHour


def working_hours_payload(*items):
    return {
        "working_hours": list(items)
        or [
            {"weekday": 0, "start_time": "09:00", "end_time": "13:00", "is_active": True},
        ]
    }


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "put"])
def test_unauthenticated_user_cannot_read_or_update_working_hours(api_client, doctor_user, method):
    response = getattr(api_client, method)(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        working_hours_payload(),
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client", "doctor_client"])
def test_allowed_roles_can_read_doctor_working_hours(request, client_fixture, doctor_user, working_hour_factory):
    working_hour_factory(doctor=doctor_user)
    client = request.getfixturevalue(client_fixture)

    response = client.get(f"/api/doctors/{doctor_user.id}/working-hours/")

    assert response.status_code == 200
    assert len(response.data["working_hours"]) == 1
    assert response.data["working_hours"][0]["weekday"] == 0


@pytest.mark.django_db
def test_doctor_cannot_read_other_doctor_working_hours(doctor_client, other_doctor_user):
    response = doctor_client.get(f"/api/doctors/{other_doctor_user.id}/working-hours/")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_staff_and_doctor_cannot_update_working_hours(request, client_fixture, doctor_user):
    client = request.getfixturevalue(client_fixture)

    response = client.put(f"/api/doctors/{doctor_user.id}/working-hours/", working_hours_payload(), format="json")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_admin_can_replace_working_hours(admin_client, doctor_user):
    response = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        working_hours_payload(
            {"weekday": 0, "start_time": "09:00", "end_time": "13:00", "is_active": True},
            {"weekday": 0, "start_time": "16:00", "end_time": "20:00", "is_active": True},
        ),
        format="json",
    )

    assert response.status_code == 200
    assert WorkingHour.objects.filter(doctor=doctor_user).count() == 2
    assert [item["start_time"] for item in response.data["working_hours"]] == ["09:00:00", "16:00:00"]


@pytest.mark.django_db
def test_admin_cannot_set_working_hours_for_non_doctor_user(admin_client, staff_user):
    response = admin_client.put(f"/api/doctors/{staff_user.id}/working-hours/", working_hours_payload(), format="json")

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        working_hours_payload({"weekday": 0, "start_time": "13:00", "end_time": "09:00", "is_active": True}),
        working_hours_payload({"weekday": 0, "start_time": "09:00", "end_time": "09:00", "is_active": True}),
        working_hours_payload({"weekday": 7, "start_time": "09:00", "end_time": "13:00", "is_active": True}),
    ],
)
def test_invalid_working_hour_payload_rejected(admin_client, doctor_user, payload):
    response = admin_client.put(f"/api/doctors/{doctor_user.id}/working-hours/", payload, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_overlapping_active_hours_rejected(admin_client, doctor_user):
    response = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        working_hours_payload(
            {"weekday": 1, "start_time": "09:00", "end_time": "13:00", "is_active": True},
            {"weekday": 1, "start_time": "12:00", "end_time": "14:00", "is_active": True},
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_invalid_put_payload_does_not_partially_update_schedule(admin_client, doctor_user, working_hour_factory):
    existing = working_hour_factory(doctor=doctor_user, weekday=2, start_time="08:00", end_time="10:00")

    response = admin_client.put(
        f"/api/doctors/{doctor_user.id}/working-hours/",
        working_hours_payload({"weekday": 3, "start_time": "10:00", "end_time": "09:00", "is_active": True}),
        format="json",
    )

    assert response.status_code == 400
    assert list(WorkingHour.objects.filter(doctor=doctor_user).values_list("id", flat=True)) == [existing.id]
