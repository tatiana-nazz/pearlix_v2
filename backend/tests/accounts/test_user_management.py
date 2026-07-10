import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import ActivityLog


@pytest.mark.django_db
def test_admin_can_list_users(admin_client, admin_user, staff_user):
    response = admin_client.get("/api/users/")

    assert response.status_code == 200
    assert set(response.data) == {"count", "next", "previous", "results"}
    emails = {item["email"] for item in response.data["results"]}
    assert {admin_user.email, staff_user.email}.issubset(emails)
    assert all("password" not in item for item in response.data["results"])


@pytest.mark.django_db
@pytest.mark.parametrize("role", [User.Role.STAFF, User.Role.DOCTOR, User.Role.ADMIN])
def test_admin_can_create_users_by_role(admin_client, role):
    response = admin_client.post(
        "/api/users/",
        {
            "email": f"{role.lower()}-new@example.com",
            "password": "Str0ngTemp!4567",
            "full_name": f"New {role.title()}",
            "role": role,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["role"] == role
    assert response.data["must_change_password"] is True
    assert response.data["password_changed_at"] is None
    assert "password" not in response.data
    created_user = User.objects.get(email=f"{role.lower()}-new@example.com", role=role)
    assert created_user.must_change_password is True
    assert created_user.check_password("Str0ngTemp!4567")


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
@pytest.mark.parametrize("method,path", [
    ("get", "/api/users/"),
    ("post", "/api/users/"),
    ("patch", "/api/users/{id}/"),
    ("post", "/api/users/{id}/deactivate/"),
])
def test_staff_and_doctor_cannot_manage_users(request, client_fixture, method, path, staff_user):
    client = request.getfixturevalue(client_fixture)
    url = path.format(id=staff_user.id)
    payload = {
        "email": "blocked@example.com",
        "password": "Str0ngTemp!4567",
        "full_name": "Blocked User",
        "role": User.Role.STAFF,
    }

    response = getattr(client, method)(url, payload, format="json")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_admin_can_deactivate_another_user(admin_client, staff_user):
    response = admin_client.post(f"/api/users/{staff_user.id}/deactivate/")

    assert response.status_code == 200
    staff_user.refresh_from_db()
    assert staff_user.is_active is False
    assert response.data["is_active"] is False
    assert ActivityLog.objects.filter(action="user_deactivated", entity_id=str(staff_user.id)).exists()


@pytest.mark.django_db
def test_deactivated_user_cannot_log_in(api_client, admin_client, staff_user):
    admin_client.post(f"/api/users/{staff_user.id}/deactivate/")

    response = api_client.post(
        "/api/auth/login/",
        {"email": staff_user.email, "password": "password123"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "INVALID_CREDENTIALS"


@pytest.mark.django_db
def test_invalid_role_cannot_be_created(admin_client):
    response = admin_client.post(
        "/api/users/",
        {
            "email": "invalid-role@example.com",
            "password": "Str0ngTemp!4567",
            "full_name": "Invalid Role",
            "role": "MANAGER",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "role" in response.data["details"]


@pytest.mark.django_db
def test_admin_can_create_user_with_temporary_password_alias(admin_client):
    response = admin_client.post(
        "/api/users/",
        {
            "email": "temporary-alias@example.com",
            "temporary_password": "AliasTemp!4567",
            "full_name": "Temporary Alias",
            "role": User.Role.STAFF,
        },
        format="json",
    )

    assert response.status_code == 201
    created_user = User.objects.get(email="temporary-alias@example.com")
    assert created_user.check_password("AliasTemp!4567")
    assert created_user.must_change_password is True
    assert "password" not in response.data
    assert "temporary_password" not in response.data


@pytest.mark.django_db
def test_admin_create_user_rejects_weak_password(admin_client):
    response = admin_client.post(
        "/api/users/",
        {
            "email": "weak-password@example.com",
            "password": "password",
            "full_name": "Weak Password",
            "role": User.Role.STAFF,
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "password" in response.data["details"]


@pytest.mark.django_db
def test_admin_can_reset_user_password(admin_client, staff_user):
    old_password_hash = staff_user.password

    response = admin_client.post(
        f"/api/users/{staff_user.id}/reset-password/",
        {"temporary_password": "ResetTemp!4567"},
        format="json",
    )

    assert response.status_code == 200
    staff_user.refresh_from_db()
    assert staff_user.password != old_password_hash
    assert staff_user.check_password("ResetTemp!4567")
    assert staff_user.check_password("password123") is False
    assert staff_user.must_change_password is True
    assert staff_user.password_changed_at is None
    assert response.data["must_change_password"] is True
    assert "password" not in response.data
    assert "temporary_password" not in response.data
    assert ActivityLog.objects.filter(action="user_password_reset", entity_id=str(staff_user.id)).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_staff_and_doctor_cannot_reset_password(request, client_fixture, staff_user):
    client = request.getfixturevalue(client_fixture)

    response = client.post(
        f"/api/users/{staff_user.id}/reset-password/",
        {"temporary_password": "ResetTemp!4567"},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_unauthenticated_user_cannot_reset_password(api_client, staff_user):
    response = api_client.post(
        f"/api/users/{staff_user.id}/reset-password/",
        {"temporary_password": "ResetTemp!4567"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_reset_password_rejects_weak_or_missing_password(admin_client, staff_user):
    missing = admin_client.post(f"/api/users/{staff_user.id}/reset-password/", {}, format="json")
    weak = admin_client.post(
        f"/api/users/{staff_user.id}/reset-password/",
        {"temporary_password": "password"},
        format="json",
    )

    assert missing.status_code == 400
    assert "temporary_password" in missing.data["details"]
    assert weak.status_code == 400
    assert "temporary_password" in weak.data["details"]


@pytest.mark.django_db
def test_reset_temporary_password_can_login_and_old_password_fails(api_client, admin_client, staff_user):
    reset_response = admin_client.post(
        f"/api/users/{staff_user.id}/reset-password/",
        {"temporary_password": "LoginReset!4567"},
        format="json",
    )
    old_login = api_client.post("/api/auth/login/", {"email": staff_user.email, "password": "password123"}, format="json")
    new_login = api_client.post("/api/auth/login/", {"email": staff_user.email, "password": "LoginReset!4567"}, format="json")

    assert reset_response.status_code == 200
    assert old_login.status_code == 401
    assert old_login.data["code"] == "INVALID_CREDENTIALS"
    assert new_login.status_code == 200
    assert new_login.data["user"]["must_change_password"] is True


@pytest.mark.django_db
def test_admin_cannot_deactivate_self(admin_client, admin_user):
    response = admin_client.post(f"/api/users/{admin_user.id}/deactivate/")

    assert response.status_code == 400
    assert response.data["code"] == "INVALID_OPERATION"
    admin_user.refresh_from_db()
    assert admin_user.is_active is True


@pytest.mark.django_db
def test_admin_cannot_deactivate_last_active_admin(admin_client, admin_user, staff_user):
    assert User.objects.filter(role=User.Role.ADMIN, is_active=True).count() == 1

    response = admin_client.post(f"/api/users/{staff_user.id}/deactivate/")
    last_admin_response = admin_client.post(f"/api/users/{admin_user.id}/deactivate/")

    assert response.status_code == 200
    assert last_admin_response.status_code == 400
    assert last_admin_response.data["code"] == "INVALID_OPERATION"
    admin_user.refresh_from_db()
    assert admin_user.is_active is True


@pytest.mark.django_db
def test_last_active_admin_cannot_be_deactivated_even_by_different_admin_user(admin_user):
    inactive_admin = User.objects.create_user(
        email="inactive-admin-actor@example.com",
        password="password123",
        full_name="Inactive Admin Actor",
        role=User.Role.ADMIN,
        is_active=False,
        is_staff=True,
        is_superuser=True,
    )
    client = APIClient()
    client.force_authenticate(user=inactive_admin)

    response = client.post(f"/api/users/{admin_user.id}/deactivate/")

    assert response.status_code == 409
    assert response.data["code"] == "INVALID_OPERATION"
    admin_user.refresh_from_db()
    assert admin_user.is_active is True


@pytest.mark.django_db
def test_admin_can_deactivate_another_admin_when_one_active_admin_remains(admin_client, admin_user):
    other_admin = User.objects.create_user(
        email="other-admin@example.com",
        password="password123",
        full_name="Other Admin",
        role=User.Role.ADMIN,
        is_staff=True,
        is_superuser=True,
    )

    response = admin_client.post(f"/api/users/{other_admin.id}/deactivate/")

    assert response.status_code == 200
    other_admin.refresh_from_db()
    assert other_admin.is_active is False
    assert User.objects.filter(role=User.Role.ADMIN, is_active=True).count() == 1


@pytest.mark.django_db
def test_admin_can_deactivate_doctor(admin_client, doctor_user):
    response = admin_client.post(f"/api/users/{doctor_user.id}/deactivate/")

    assert response.status_code == 200
    doctor_user.refresh_from_db()
    assert doctor_user.is_active is False
