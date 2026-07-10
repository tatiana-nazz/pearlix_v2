import pytest

from apps.audit.models import ActivityLog


@pytest.mark.django_db
def test_authenticated_user_can_change_password(staff_client, staff_user, api_client):
    staff_user.must_change_password = True
    staff_user.save(update_fields=["must_change_password", "updated_at"])

    response = staff_client.post(
        "/api/auth/change-password/",
        {
            "current_password": "password123",
            "new_password": "NewStr0ngPass!4567",
        },
        format="json",
    )

    assert response.status_code == 200
    staff_user.refresh_from_db()
    assert staff_user.must_change_password is False
    assert staff_user.password_changed_at is not None
    assert staff_user.check_password("NewStr0ngPass!4567")
    assert "password" not in response.data
    assert response.data["must_change_password"] is False
    assert response.data["password_changed_at"] is not None
    assert ActivityLog.objects.filter(action="user_password_changed", entity_id=str(staff_user.id)).exists()

    old_login = api_client.post("/api/auth/login/", {"email": staff_user.email, "password": "password123"}, format="json")
    new_login = api_client.post("/api/auth/login/", {"email": staff_user.email, "password": "NewStr0ngPass!4567"}, format="json")
    assert old_login.status_code == 401
    assert new_login.status_code == 200
    assert new_login.data["user"]["must_change_password"] is False


@pytest.mark.django_db
def test_change_password_rejects_wrong_current_password(staff_client, staff_user):
    response = staff_client.post(
        "/api/auth/change-password/",
        {
            "current_password": "wrong-password",
            "new_password": "NewStr0ngPass!4567",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "current_password" in response.data["details"]
    staff_user.refresh_from_db()
    assert staff_user.check_password("password123")


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"new_password": "NewStr0ngPass!4567"}, "current_password"),
        ({"current_password": "password123"}, "new_password"),
        ({"current_password": "password123", "new_password": "password"}, "new_password"),
    ],
)
def test_change_password_rejects_missing_or_weak_values(staff_client, payload, field):
    response = staff_client.post("/api/auth/change-password/", payload, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert field in response.data["details"]


@pytest.mark.django_db
def test_change_password_requires_authentication(api_client):
    response = api_client.post(
        "/api/auth/change-password/",
        {
            "current_password": "password123",
            "new_password": "NewStr0ngPass!4567",
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"
