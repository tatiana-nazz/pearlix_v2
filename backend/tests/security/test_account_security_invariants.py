import pytest
from django.core.exceptions import FieldDoesNotExist, ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import Client
from rest_framework.test import APIClient

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.accounts.team_services import confirm_transition, transition_preview


TEMPORARY_PASSWORD = "Temp0rary!4567"
CHANGED_PASSWORD = "N3w-Credential!9472"


def _login(client, user, password=TEMPORARY_PASSWORD):
    return client.post(
        "/api/auth/login/",
        {"email": user.email, "password": password},
        format="json",
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("target_role", "profile"),
    [
        (User.Role.DOCTOR, {"specialty": "General", "phone": "1", "bio": ""}),
        (User.Role.STAFF, {"position": "Reception", "phone": "2"}),
    ],
)
def test_admin_demotion_atomically_revokes_django_and_token_authority(
    api_client,
    admin_client,
    target_role,
    profile,
):
    target = User.objects.create_superuser(
        email=f"demoted-{target_role.lower()}@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Maintenance Admin",
    )
    initial_version = target.version

    login = _login(api_client, target)
    assert login.status_code == 200
    old_access = login.data["access"]
    old_refresh = login.data["refresh"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert api_client.get("/api/users/").status_code == 200

    django_session = Client()
    django_session.force_login(target)
    assert django_session.get("/admin/").status_code == 200

    preview = admin_client.post(
        f"/api/users/{target.id}/transition-role/",
        {"target_role": target_role, "mode": "PREVIEW"},
        format="json",
    )
    assert preview.status_code == 200
    assert preview.data["allowed"] is True

    confirmed = admin_client.post(
        f"/api/users/{target.id}/transition-role/",
        {
            "target_role": target_role,
            "mode": "CONFIRM",
            "confirmation_token": preview.data["confirmation_token"],
            "profile": profile,
            "version": initial_version,
        },
        format="json",
    )
    assert confirmed.status_code == 200

    target.refresh_from_db()
    assert target.role == target_role
    assert target.version == initial_version + 1
    assert target.is_staff is False
    assert target.is_superuser is False
    assert target.has_perm("accounts.change_user") is False
    assert target.has_module_perms("accounts") is False
    assert django_session.get("/admin/").status_code == 302
    if target_role == User.Role.DOCTOR:
        assert DoctorProfile.objects.filter(user=target, is_active=True).exists()
    else:
        assert StaffProfile.objects.filter(user=target, is_active=True).exists()

    stale_access = api_client.get("/api/me/")
    assert stale_access.status_code == 401
    assert stale_access.data["code"] == "ACCOUNT_AUTHORITY_CHANGED"

    refresh_client = APIClient()
    stale_refresh = refresh_client.post(
        "/api/auth/refresh/",
        {"refresh": old_refresh},
        format="json",
    )
    assert stale_refresh.status_code == 401
    assert stale_refresh.data["code"] == "ACCOUNT_AUTHORITY_CHANGED"

    relogin = _login(refresh_client, target)
    assert relogin.status_code == 200
    assert relogin.data["user"]["role"] == target_role


@pytest.mark.django_db
def test_role_and_privilege_reconciliation_roll_back_together(monkeypatch, admin_user):
    target = User.objects.create_superuser(
        email="atomic-target@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Atomic Target",
    )
    preview = transition_preview(
        user=target,
        target_role=User.Role.STAFF,
        actor=admin_user,
    )

    def fail_profile_creation(**kwargs):
        raise RuntimeError("profile creation failed")

    monkeypatch.setattr(StaffProfile.objects, "create", fail_profile_creation)
    with pytest.raises(RuntimeError, match="profile creation failed"):
        confirm_transition(
            user_id=target.id,
            actor=admin_user,
            target_role=User.Role.STAFF,
            token=preview["confirmation_token"],
            version=target.version,
            profile={"position": "Reception", "phone": "2"},
        )

    target.refresh_from_db()
    assert target.role == User.Role.ADMIN
    assert target.is_staff is True
    assert target.is_superuser is True
    assert not StaffProfile.objects.filter(user=target).exists()


@pytest.mark.django_db
def test_last_active_admin_cannot_transition_away_from_admin():
    target = User.objects.create_superuser(
        email="last-admin@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Last Admin",
    )
    inactive_actor = User.objects.create_user(
        email="inactive-admin@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Inactive Admin",
        role=User.Role.ADMIN,
        is_active=False,
    )

    preview = transition_preview(
        user=target,
        target_role=User.Role.DOCTOR,
        actor=inactive_actor,
    )

    assert preview["allowed"] is False
    assert preview["confirmation_token"] is None
    assert preview["blockers"][0]["code"] == "LAST_ACTIVE_ADMIN"
    target.refresh_from_db()
    assert target.role == User.Role.ADMIN
    assert target.is_staff is True
    assert target.is_superuser is True


@pytest.mark.django_db
@pytest.mark.parametrize("role", [User.Role.DOCTOR, User.Role.STAFF])
def test_ordinary_professional_accounts_cannot_gain_django_privileges(role):
    user = User.objects.create_user(
        email=f"ordinary-{role.lower()}@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Ordinary Professional",
        role=role,
    )
    user.is_staff = True
    user.is_superuser = True

    with pytest.raises(ValidationError, match="reserved for ADMIN"):
        user.save(update_fields=["is_staff", "is_superuser", "updated_at"])

    user.refresh_from_db()
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.has_perm("accounts.change_user") is False
    with pytest.raises(FieldDoesNotExist):
        User._meta.get_field("groups")
    with pytest.raises(FieldDoesNotExist):
        User._meta.get_field("user_permissions")


@pytest.mark.django_db
def test_database_rejects_bulk_non_admin_privilege_grants():
    user = User.objects.create_user(
        email="bulk-privilege@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Bulk Privilege",
        role=User.Role.DOCTOR,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=user.pk).update(is_staff=True, is_superuser=True)

    user.refresh_from_db()
    assert user.is_staff is False
    assert user.is_superuser is False


@pytest.mark.django_db(transaction=True)
def test_privilege_cleanup_migration_repairs_preexisting_non_admin_rows():
    executor = MigrationExecutor(connection)
    old_target = (
        "accounts",
        "0005_doctorprofile_version_staffprofile_version_and_more",
    )
    executor.migrate([old_target])
    old_apps = executor.loader.project_state([old_target]).apps
    old_user_model = old_apps.get_model("accounts", "User")
    user = old_user_model.objects.create(
        email="legacy-privilege@example.com",
        password="!unusable-for-migration-test",
        full_name="Legacy Privilege",
        role="STAFF",
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )

    new_target = (
        "accounts",
        "0007_accountsecuritystate",
    )
    executor = MigrationExecutor(connection)
    executor.migrate([new_target])
    new_apps = executor.loader.project_state([new_target]).apps
    migrated_user = new_apps.get_model("accounts", "User").objects.get(pk=user.pk)
    security_state_model = new_apps.get_model("accounts", "AccountSecurityState")

    assert migrated_user.is_staff is False
    assert migrated_user.is_superuser is False
    assert security_state_model.objects.filter(pk=1).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "method", "path", "payload", "success_status"),
    [
        (User.Role.ADMIN, "get", "/api/users/", None, 200),
        (
            User.Role.STAFF,
            "post",
            "/api/patients/",
            {
                "first_name": "Direct",
                "last_name": "Bypass",
                "phone_number": "0900000021",
                "gender": "Female",
            },
            201,
        ),
        (User.Role.DOCTOR, "get", "/api/patients/", None, 200),
    ],
)
def test_temporary_password_accounts_are_backend_gated_until_change(
    api_client,
    role,
    method,
    path,
    payload,
    success_status,
):
    user = User.objects.create_user(
        email=f"must-change-{role.lower()}@example.com",
        password=TEMPORARY_PASSWORD,
        full_name=f"Must Change {role.title()}",
        role=role,
        must_change_password=True,
        is_staff=role == User.Role.ADMIN,
        is_superuser=role == User.Role.ADMIN,
    )
    login = _login(api_client, user)
    assert login.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    identity = api_client.get("/api/me/")
    assert identity.status_code == 200
    assert identity.data["must_change_password"] is True

    blocked = getattr(api_client, method)(path, payload, format="json")
    assert blocked.status_code == 403
    assert blocked.data["code"] == "PASSWORD_CHANGE_REQUIRED"

    changed = api_client.post(
        "/api/auth/change-password/",
        {
            "current_password": TEMPORARY_PASSWORD,
            "new_password": CHANGED_PASSWORD,
        },
        format="json",
    )
    assert changed.status_code == 200
    assert changed.data["user"]["must_change_password"] is False
    assert changed.data["access"]
    assert changed.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {changed.data['access']}")
    allowed = getattr(api_client, method)(path, payload, format="json")
    assert allowed.status_code == success_status
    user.refresh_from_db()
    assert user.must_change_password is False
    assert user.check_password(CHANGED_PASSWORD)


@pytest.mark.django_db
def test_password_change_rotates_authority_for_all_existing_sessions(api_client):
    user = User.objects.create_user(
        email="two-session-password@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Two Session Password",
        role=User.Role.STAFF,
        must_change_password=True,
    )
    initial_version = user.version
    first_session = _login(api_client, user)
    second_client = APIClient()
    second_session = _login(second_client, user)
    assert first_session.status_code == 200
    assert second_session.status_code == 200

    first_old_access = first_session.data["access"]
    first_old_refresh = first_session.data["refresh"]
    second_old_access = second_session.data["access"]
    second_old_refresh = second_session.data["refresh"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {first_old_access}")
    changed = api_client.post(
        "/api/auth/change-password/",
        {
            "current_password": TEMPORARY_PASSWORD,
            "new_password": CHANGED_PASSWORD,
        },
        format="json",
    )
    assert changed.status_code == 200
    assert changed.data["access"] not in {first_old_access, second_old_access}
    assert changed.data["refresh"] not in {first_old_refresh, second_old_refresh}

    user.refresh_from_db()
    assert user.version == initial_version + 1
    assert user.must_change_password is False

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {first_old_access}")
    first_stale_access = api_client.get("/api/me/")
    assert first_stale_access.status_code == 401
    assert first_stale_access.data["code"] == "ACCOUNT_AUTHORITY_CHANGED"

    second_client.credentials(HTTP_AUTHORIZATION=f"Bearer {second_old_access}")
    second_stale_access = second_client.get("/api/me/")
    assert second_stale_access.status_code == 401
    assert second_stale_access.data["code"] == "ACCOUNT_AUTHORITY_CHANGED"

    for old_refresh in (first_old_refresh, second_old_refresh):
        stale_refresh = APIClient().post(
            "/api/auth/refresh/",
            {"refresh": old_refresh},
            format="json",
        )
        assert stale_refresh.status_code == 401
        assert stale_refresh.data["code"] == "ACCOUNT_AUTHORITY_CHANGED"

    replacement_client = APIClient()
    replacement_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {changed.data['access']}"
    )
    assert replacement_client.get("/api/clinic/settings/").status_code == 200
    replacement_refresh = APIClient().post(
        "/api/auth/refresh/",
        {"refresh": changed.data["refresh"]},
        format="json",
    )
    assert replacement_refresh.status_code == 200
    assert replacement_refresh.data["access"]


@pytest.mark.django_db
def test_must_change_superuser_cannot_bypass_gate_through_django_admin():
    user = User.objects.create_superuser(
        email="temporary-maintenance@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Temporary Maintenance",
        must_change_password=True,
    )
    session_client = Client()
    assert session_client.login(email=user.email, password=TEMPORARY_PASSWORD)

    blocked = session_client.get("/admin/")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PASSWORD_CHANGE_REQUIRED"

    User.objects.filter(pk=user.pk).update(must_change_password=False)
    assert session_client.get("/admin/").status_code == 200


@pytest.mark.django_db
def test_anonymous_user_cannot_use_a_normal_business_endpoint(api_client):
    response = api_client.get("/api/patients/")

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_temporary_password_account_can_refresh_and_logout(api_client):
    user = User.objects.create_user(
        email="must-change-lifecycle@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Lifecycle User",
        role=User.Role.STAFF,
        must_change_password=True,
    )
    login = _login(api_client, user)
    assert login.status_code == 200

    refreshed = api_client.post(
        "/api/auth/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert refreshed.status_code == 200
    assert refreshed.data["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    logout = api_client.post(
        "/api/auth/logout/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert logout.status_code == 204

    api_client.credentials()
    rejected_refresh = api_client.post(
        "/api/auth/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert rejected_refresh.status_code == 401


@pytest.mark.django_db
def test_password_change_rejects_the_current_temporary_password(api_client):
    user = User.objects.create_user(
        email="same-password@example.com",
        password=TEMPORARY_PASSWORD,
        full_name="Same Password",
        role=User.Role.DOCTOR,
        must_change_password=True,
    )
    login = _login(api_client, user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api_client.post(
        "/api/auth/change-password/",
        {
            "current_password": TEMPORARY_PASSWORD,
            "new_password": TEMPORARY_PASSWORD,
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert response.data["details"]["new_password"] == [
        "New password must be different from the current password."
    ]
    user.refresh_from_db()
    assert user.must_change_password is True
    assert user.check_password(TEMPORARY_PASSWORD)
    assert api_client.get("/api/patients/").status_code == 403
