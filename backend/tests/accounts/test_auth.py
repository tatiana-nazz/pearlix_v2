import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("email", "role"),
    [
        ("admin@example.com", User.Role.ADMIN),
        ("staff@example.com", User.Role.STAFF),
        ("doctor@example.com", User.Role.DOCTOR),
    ],
)
def test_active_user_login_succeeds(api_client, admin_user, staff_user, doctor_user, email, role):
    response = api_client.post(
        "/api/auth/login/",
        {"email": email, "password": "password123"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["access"]
    assert response.data["refresh"]
    assert response.data["user"]["email"] == email
    assert response.data["user"]["role"] == role
    assert response.data["user"]["must_change_password"] is False
    assert response.data["user"]["password_changed_at"] is None
    assert "password" not in response.data["user"]
    assert "is_staff" not in response.data["user"]
    assert "is_superuser" not in response.data["user"]


@pytest.mark.django_db
def test_inactive_user_login_fails(api_client, inactive_user):
    response = api_client.post(
        "/api/auth/login/",
        {"email": inactive_user.email, "password": "password123"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "INVALID_CREDENTIALS"


@pytest.mark.django_db
def test_wrong_password_login_fails(api_client, staff_user):
    response = api_client.post(
        "/api/auth/login/",
        {"email": staff_user.email, "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "INVALID_CREDENTIALS"


@pytest.mark.django_db
def test_me_requires_authentication(api_client):
    response = api_client.get("/api/me/")

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_authenticated_user_can_fetch_me(staff_client, staff_user):
    response = staff_client.get("/api/me/")

    assert response.status_code == 200
    assert response.data == {
        "id": staff_user.id,
        "email": staff_user.email,
        "full_name": staff_user.full_name,
        "role": User.Role.STAFF,
        "is_active": True,
        "theme_preference": User.ThemePreference.SYSTEM,
        "language_preference": User.LanguagePreference.EN,
            "must_change_password": False,
            "password_changed_at": None,
            "operational_status": None,
        }


@pytest.mark.django_db
def test_user_can_update_own_preferences(staff_client, staff_user):
    response = staff_client.patch(
        "/api/me/preferences/",
        {"theme_preference": "DARK", "language_preference": "AR"},
        format="json",
    )

    assert response.status_code == 200
    staff_user.refresh_from_db()
    assert staff_user.theme_preference == "DARK"
    assert staff_user.language_preference == "AR"
    assert response.data["theme_preference"] == "DARK"
    assert response.data["language_preference"] == "AR"


@pytest.mark.django_db
def test_invalid_theme_preference_rejected(staff_client):
    response = staff_client.patch(
        "/api/me/preferences/",
        {"theme_preference": "BLUE"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "theme_preference" in response.data["details"]


@pytest.mark.django_db
def test_invalid_language_preference_rejected(staff_client):
    response = staff_client.patch(
        "/api/me/preferences/",
        {"language_preference": "FR"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "language_preference" in response.data["details"]


@pytest.mark.django_db
def test_refresh_and_logout_endpoints(api_client, staff_user):
    login_response = api_client.post(
        "/api/auth/login/",
        {"email": staff_user.email, "password": "password123"},
        format="json",
    )
    refresh = login_response.data["refresh"]

    refresh_response = api_client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
    assert refresh_response.status_code == 200
    assert refresh_response.data["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
    logout_response = api_client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert logout_response.status_code == 204


@pytest.mark.django_db
def test_refresh_for_deleted_user_is_rejected(api_client, staff_user):
    refresh = str(RefreshToken.for_user(staff_user))
    staff_user.delete()

    response = api_client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")

    assert response.status_code == 401
    assert response.data["code"] == "TOKEN_NOT_VALID"
