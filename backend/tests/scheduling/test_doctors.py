import pytest

from apps.accounts.models import DoctorProfile, User


@pytest.mark.django_db
def test_unauthenticated_user_cannot_list_doctors(api_client):
    response = api_client.get("/api/doctors/")

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client", "doctor_client"])
def test_authenticated_roles_can_list_active_doctors(request, client_fixture, doctor_user):
    DoctorProfile.objects.create(user=doctor_user, specialty="Orthodontics", phone="0999000000")
    client = request.getfixturevalue(client_fixture)

    response = client.get("/api/doctors/")

    assert response.status_code == 200
    assert response.data == [
        {
            "id": doctor_user.id,
            "full_name": doctor_user.full_name,
            "email": doctor_user.email,
            "role": User.Role.DOCTOR,
            "is_active": True,
            "doctor_profile": {
                "id": doctor_user.doctor_profile.id,
                "specialty": "Orthodontics",
                "phone": "0999000000",
                "bio": "",
                "is_active": True,
            },
        }
    ]
    assert "password" not in response.data[0]


@pytest.mark.django_db
def test_inactive_doctors_and_non_doctor_users_are_not_returned(admin_client, doctor_user, staff_user):
    inactive_doctor = User.objects.create_user(
        email="inactive-doctor@example.com",
        password="password123",
        full_name="Inactive Doctor",
        role=User.Role.DOCTOR,
        is_active=False,
    )

    response = admin_client.get("/api/doctors/")

    ids = {doctor["id"] for doctor in response.data}
    assert doctor_user.id in ids
    assert inactive_doctor.id not in ids
    assert staff_user.id not in ids
