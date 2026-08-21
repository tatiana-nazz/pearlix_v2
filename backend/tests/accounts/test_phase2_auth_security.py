from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.contrib import admin
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.test import Client, RequestFactory, override_settings
from rest_framework.test import APIClient

from apps.accounts.admin import UserAdmin
from apps.accounts.models import AccountSecurityState, User
from apps.accounts.team_services import (
    TeamRuleError,
    confirm_transition,
    deactivate_user,
    transition_preview,
)
from apps.accounts.throttling import (
    LoginIdentifierThrottle,
    LoginSourceThrottle,
    LogoutSourceThrottle,
    RefreshSourceThrottle,
)


PASSWORD = "Temp0rary!4567"
NEW_PASSWORD = "N3w-Credential!9472"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def _login(client, user, password=PASSWORD, **extra):
    return client.post(
        "/api/auth/login/",
        {"email": user.email, "password": password},
        format="json",
        **extra,
    )


def _assert_pair_rejected(access, refresh):
    access_client = APIClient()
    access_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert access_client.get("/api/me/").status_code == 401

    refresh_response = APIClient().post(
        "/api/auth/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert refresh_response.status_code == 401


@pytest.mark.django_db
def test_normal_password_change_revokes_old_pair_but_not_replacement():
    user = User.objects.create_user(
        email="normal-change@example.com",
        password=PASSWORD,
        full_name="Normal Change",
        role=User.Role.STAFF,
    )
    client = APIClient()
    login = _login(client, user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    changed = client.post(
        "/api/auth/change-password/",
        {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        format="json",
    )

    assert changed.status_code == 200
    _assert_pair_rejected(login.data["access"], login.data["refresh"])
    replacement = APIClient()
    replacement.credentials(HTTP_AUTHORIZATION=f"Bearer {changed.data['access']}")
    assert replacement.get("/api/me/").status_code == 200
    assert APIClient().post(
        "/api/auth/refresh/",
        {"refresh": changed.data["refresh"]},
        format="json",
    ).status_code == 200


@pytest.mark.django_db
def test_admin_password_reset_revokes_old_access_and_refresh(admin_client):
    user = User.objects.create_user(
        email="admin-reset-session@example.com",
        password=PASSWORD,
        full_name="Admin Reset Session",
        role=User.Role.STAFF,
    )
    login = _login(APIClient(), user)
    initial_version = user.version

    reset = admin_client.post(
        f"/api/users/{user.id}/reset-password/",
        {"temporary_password": NEW_PASSWORD},
        format="json",
    )

    assert reset.status_code == 200
    user.refresh_from_db()
    assert user.version == initial_version + 1
    assert user.must_change_password is True
    _assert_pair_rejected(login.data["access"], login.data["refresh"])
    replacement_login = _login(APIClient(), user, NEW_PASSWORD)
    assert replacement_login.status_code == 200
    assert replacement_login.data["user"]["must_change_password"] is True


@pytest.mark.django_db
def test_deactivation_and_reactivation_never_restore_pre_deactivation_tokens(admin_client):
    user = User.objects.create_superuser(
        email="reactivation-session@example.com",
        password=PASSWORD,
        full_name="Reactivation Session",
    )
    initial_version = user.version
    login = _login(APIClient(), user)

    deactivated = admin_client.post(f"/api/users/{user.id}/deactivate/")
    assert deactivated.status_code == 200
    user.refresh_from_db()
    assert user.version == initial_version + 1
    _assert_pair_rejected(login.data["access"], login.data["refresh"])

    reactivated = admin_client.post(f"/api/users/{user.id}/reactivate/")
    assert reactivated.status_code == 200
    user.refresh_from_db()
    assert user.version == initial_version + 2
    _assert_pair_rejected(login.data["access"], login.data["refresh"])
    assert _login(APIClient(), user).status_code == 200


@pytest.mark.django_db
def test_direct_user_patch_cannot_bypass_password_reset_lifecycle(admin_client):
    user = User.objects.create_user(
        email="patch-password@example.com",
        password=PASSWORD,
        full_name="Patch Password",
        role=User.Role.STAFF,
    )
    initial_version = user.version

    response = admin_client.patch(
        f"/api/users/{user.id}/",
        {"password": NEW_PASSWORD},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["details"]["password"] == ["Use the reset-password action."]
    user.refresh_from_db()
    assert user.version == initial_version
    assert user.check_password(PASSWORD)


@pytest.mark.django_db
def test_login_unknown_wrong_password_and_disabled_are_publicly_identical():
    active = User.objects.create_user(
        email="enumeration-active@example.com",
        password=PASSWORD,
        full_name="Enumeration Active",
        role=User.Role.STAFF,
    )
    disabled = User.objects.create_user(
        email="enumeration-disabled@example.com",
        password=PASSWORD,
        full_name="Enumeration Disabled",
        role=User.Role.STAFF,
        is_active=False,
    )

    responses = [
        _login(APIClient(), active, "incorrect-password"),
        APIClient().post(
            "/api/auth/login/",
            {"email": "unknown-enumeration@example.com", "password": PASSWORD},
            format="json",
        ),
        _login(APIClient(), disabled),
    ]

    assert [response.status_code for response in responses] == [401, 401, 401]
    assert [response.data for response in responses] == [
        {
            "code": "INVALID_CREDENTIALS",
            "message": "Invalid email or password.",
            "details": {},
        }
    ] * 3


@pytest.mark.django_db
def test_login_source_throttle_allows_limit_then_returns_429(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "2/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "100/min", raising=False)
    payloads = [
        {"email": f"unknown-{index}@example.com", "password": PASSWORD}
        for index in range(3)
    ]

    responses = [
        APIClient().post(
            "/api/auth/login/",
            payload,
            format="json",
            REMOTE_ADDR="192.0.2.10",
        )
        for payload in payloads
    ]

    assert [response.status_code for response in responses] == [401, 401, 429]
    assert responses[-1].data["code"] == "THROTTLED"


@pytest.mark.django_db
def test_login_identifier_throttle_is_temporary_and_cross_source(monkeypatch):
    clock = [1_000.0]
    monkeypatch.setattr(LoginSourceThrottle, "rate", "100/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "2/min", raising=False)
    monkeypatch.setattr(
        LoginIdentifierThrottle,
        "timer",
        staticmethod(lambda: clock[0]),
    )
    payload = {"email": "targeted@example.com", "password": PASSWORD}

    first = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="192.0.2.1"
    )
    second = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="192.0.2.2"
    )
    limited = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="192.0.2.3"
    )
    clock[0] += 61
    reset = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="192.0.2.3"
    )

    assert [first.status_code, second.status_code, limited.status_code] == [401, 401, 429]
    assert reset.status_code == 401


@pytest.mark.django_db
def test_login_throttle_ignores_untrusted_forwarding_and_accepts_trusted_chain(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "1/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "100/min", raising=False)

    direct_first = APIClient().post(
        "/api/auth/login/",
        {"email": "direct-one@example.com", "password": PASSWORD},
        format="json",
        REMOTE_ADDR="192.0.2.20",
        HTTP_X_FORWARDED_FOR="198.51.100.1",
    )
    direct_spoof = APIClient().post(
        "/api/auth/login/",
        {"email": "direct-two@example.com", "password": PASSWORD},
        format="json",
        REMOTE_ADDR="192.0.2.20",
        HTTP_X_FORWARDED_FOR="198.51.100.2",
    )
    assert [direct_first.status_code, direct_spoof.status_code] == [401, 429]

    cache.clear()
    with override_settings(TRUSTED_PROXY_CIDRS=["10.0.0.0/8"]):
        trusted_first = APIClient().post(
            "/api/auth/login/",
            {"email": "trusted-one@example.com", "password": PASSWORD},
            format="json",
            REMOTE_ADDR="10.0.0.5",
            HTTP_X_FORWARDED_FOR="198.51.100.1, 10.0.0.4",
        )
        trusted_second = APIClient().post(
            "/api/auth/login/",
            {"email": "trusted-two@example.com", "password": PASSWORD},
            format="json",
            REMOTE_ADDR="10.0.0.5",
            HTTP_X_FORWARDED_FOR="198.51.100.2, 10.0.0.4",
        )
    assert [trusted_first.status_code, trusted_second.status_code] == [401, 401]


@pytest.mark.django_db
def test_refresh_source_throttle_is_bounded(monkeypatch):
    user = User.objects.create_user(
        email="refresh-throttle@example.com",
        password=PASSWORD,
        full_name="Refresh Throttle",
        role=User.Role.STAFF,
    )
    login = _login(APIClient(), user)
    cache.clear()
    monkeypatch.setattr(RefreshSourceThrottle, "rate", "2/min", raising=False)

    responses = [
        APIClient().post(
            "/api/auth/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
            REMOTE_ADDR="192.0.2.30",
        )
        for _ in range(3)
    ]

    assert [response.status_code for response in responses] == [200, 200, 429]
    assert responses[-1].data["code"] == "THROTTLED"


@pytest.mark.django_db
def test_valid_refresh_can_logout_without_access_header_and_is_blacklisted():
    user = User.objects.create_user(
        email="refresh-only-logout@example.com",
        password=PASSWORD,
        full_name="Refresh Only Logout",
        role=User.Role.STAFF,
    )
    login = _login(APIClient(), user)
    anonymous_client = APIClient()

    logout = anonymous_client.post(
        "/api/auth/logout/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    rejected_refresh = anonymous_client.post(
        "/api/auth/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )

    assert logout.status_code == 204
    assert rejected_refresh.status_code == 401


@pytest.mark.django_db
def test_logout_source_throttle_bounds_invalid_token_abuse(monkeypatch):
    monkeypatch.setattr(LogoutSourceThrottle, "rate", "2/min", raising=False)

    responses = [
        APIClient().post(
            "/api/auth/logout/",
            {"refresh": "not-a-token"},
            format="json",
            REMOTE_ADDR="192.0.2.40",
        )
        for _ in range(3)
    ]

    assert [response.status_code for response in responses] == [400, 400, 429]
    assert responses[-1].data["code"] == "THROTTLED"


def _make_admin(email):
    return User.objects.create_superuser(
        email=email,
        password=PASSWORD,
        full_name=email.split("@", 1)[0],
    )


def _demotion_kwargs(target, actor):
    preview = transition_preview(
        user=target,
        target_role=User.Role.STAFF,
        actor=actor,
    )
    assert preview["allowed"] is True
    return {
        "user_id": target.id,
        "actor": actor,
        "target_role": User.Role.STAFF,
        "token": preview["confirmation_token"],
        "version": target.version,
        "profile": {"position": "Former Admin", "phone": ""},
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("first_kind", "second_kind"),
    [
        ("demote", "demote"),
        ("deactivate", "deactivate"),
        ("demote", "deactivate"),
    ],
)
def test_admin_removal_paths_serialize_and_reject_stale_actor(first_kind, second_kind):
    admin_a = _make_admin(f"scope-a-{first_kind}-{second_kind}@example.com")
    admin_b = _make_admin(f"scope-b-{first_kind}-{second_kind}@example.com")
    demote_a = _demotion_kwargs(admin_a, admin_b)
    demote_b = _demotion_kwargs(admin_b, admin_a)

    if first_kind == "demote":
        confirm_transition(**demote_a)
    else:
        deactivate_user(user_id=admin_a.id, actor_id=admin_b.id)

    with pytest.raises(TeamRuleError) as exc_info:
        if second_kind == "demote":
            confirm_transition(**demote_b)
        else:
            deactivate_user(user_id=admin_b.id, actor_id=admin_a.id)

    assert exc_info.value.code == "PERMISSION_DENIED"
    assert User.objects.filter(role=User.Role.ADMIN, is_active=True).count() == 1


@pytest.mark.django_db
def test_account_security_scope_row_exists_and_is_locked_by_both_removal_paths(monkeypatch):
    import apps.accounts.team_services as services

    admin_a = _make_admin("lock-a@example.com")
    admin_b = _make_admin("lock-b@example.com")
    assert AccountSecurityState.objects.filter(pk=1).exists()
    calls = []
    original = services._lock_account_security_scope

    def record_lock():
        calls.append("scope")
        return original()

    monkeypatch.setattr(services, "_lock_account_security_scope", record_lock)
    confirm_transition(**_demotion_kwargs(admin_a, admin_b))
    assert calls == ["scope"]

    admin_c = _make_admin("lock-c@example.com")
    deactivate_user(user_id=admin_c.id, actor_id=admin_b.id)
    assert calls == ["scope", "scope"]


@pytest.mark.django_db
def test_role_transition_rolls_back_when_required_audit_write_fails(monkeypatch, admin_client, admin_user):
    target = _make_admin("rollback-transition@example.com")
    initial_version = target.version
    preview = transition_preview(
        user=target,
        target_role=User.Role.STAFF,
        actor=admin_user,
    )

    def fail_audit(**kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("apps.accounts.views.log_activity", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        admin_client.post(
            f"/api/users/{target.id}/transition-role/",
            {
                "target_role": User.Role.STAFF,
                "mode": "CONFIRM",
                "confirmation_token": preview["confirmation_token"],
                "profile": {"position": "Former Admin", "phone": ""},
                "version": target.version,
            },
            format="json",
        )

    target.refresh_from_db()
    assert target.role == User.Role.ADMIN
    assert target.version == initial_version


@pytest.mark.django_db
def test_account_creation_rolls_back_when_required_audit_write_fails(
    monkeypatch,
    admin_client,
):
    def fail_audit(**kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("apps.accounts.views.log_activity", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        admin_client.post(
            "/api/users/",
            {
                "email": "rollback-create@example.com",
                "full_name": "Rollback Create",
                "role": User.Role.ADMIN,
                "password": NEW_PASSWORD,
            },
            format="json",
        )

    assert not User.objects.filter(email="rollback-create@example.com").exists()


@pytest.mark.django_db
def test_django_user_admin_routes_authority_and_credentials_to_audited_api():
    maintenance_admin = _make_admin("django-maintenance@example.com")
    target = _make_admin("django-target@example.com")
    initial_version = target.version
    request = RequestFactory().get("/admin/accounts/user/")
    request.user = maintenance_admin
    model_admin = UserAdmin(User, admin.site)

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_delete_permission(request, target) is False
    assert {
        "email",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "must_change_password",
        "password_changed_at",
        "version",
    }.issubset(set(model_admin.get_readonly_fields(request, target)))

    client = Client()
    client.force_login(maintenance_admin)
    change_url = f"/admin/accounts/user/{target.id}/change/"
    page = client.get(change_url)
    assert page.status_code == 200
    assert b"audited account-lifecycle API" in page.content
    assert f"/admin/accounts/user/{target.id}/password/".encode() not in page.content

    password_url = f"/admin/accounts/user/{target.id}/password/"
    assert client.get(password_url).status_code == 403
    assert client.post(
        password_url,
        {
            "password1": NEW_PASSWORD,
            "password2": NEW_PASSWORD,
            "set_usable_password": "true",
        },
    ).status_code == 403
    target.refresh_from_db()
    assert target.version == initial_version
    assert target.check_password(PASSWORD)

    response = client.post(
        change_url,
        {
            "full_name": "Safely Edited Name",
            "theme_preference": User.ThemePreference.DARK,
            "language_preference": User.LanguagePreference.AR,
            "role": User.Role.STAFF,
            "is_active": "",
            "password": "attacker-selected",
            "_save": "Save",
        },
    )
    assert response.status_code == 302
    target.refresh_from_db()
    assert target.full_name == "Safely Edited Name"
    assert target.role == User.Role.ADMIN
    assert target.is_active is True
    assert target.version == initial_version
    assert target.check_password(PASSWORD)


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
@pytest.mark.parametrize(
    ("first_kind", "second_kind"),
    [
        ("demote", "demote"),
        ("deactivate", "deactivate"),
        ("demote", "deactivate"),
    ],
)
def test_postgresql_concurrent_admin_removals_leave_one_active_admin(
    first_kind,
    second_kind,
):
    # Transactional tests flush data between parametrized cases; restore the
    # migration-created singleton that production retains for its lifetime.
    AccountSecurityState.objects.get_or_create(pk=1)
    admin_a = _make_admin(f"pg-a-{first_kind}-{second_kind}@example.com")
    admin_b = _make_admin(f"pg-b-{first_kind}-{second_kind}@example.com")
    demote_a = _demotion_kwargs(admin_a, admin_b)
    demote_b = _demotion_kwargs(admin_b, admin_a)
    barrier = Barrier(2)

    def run(kind, target, actor, demotion):
        close_old_connections()
        barrier.wait(timeout=10)
        try:
            if kind == "demote":
                confirm_transition(**demotion)
            else:
                deactivate_user(user_id=target.id, actor_id=actor.id)
            return "ok"
        except TeamRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda args: run(*args),
                [
                    (first_kind, admin_a, admin_b, demote_a),
                    (second_kind, admin_b, admin_a, demote_b),
                ],
            )
        )

    assert results.count("ok") == 1
    assert User.objects.filter(role=User.Role.ADMIN, is_active=True).count() == 1
