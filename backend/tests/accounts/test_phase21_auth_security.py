from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as datetime_timezone
from threading import Barrier

import pytest
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.db.models.query import QuerySet
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.authentication import ACCOUNT_VERSION_CLAIM, AUTH_SESSION_CLAIM
from apps.accounts.models import (
    AuthSession,
    AuthenticationThrottleBucket,
    AuthenticationThrottleLock,
    User,
)
from apps.accounts.throttling import (
    LoginIdentifierThrottle,
    LoginSourceThrottle,
    RefreshIdentifierThrottle,
    RefreshSourceThrottle,
    _bucket_digest,
    _consume_bucket,
    _delete_expired_auth_state_batches,
    cleanup_expired_auth_state,
)


PASSWORD = "Temp0rary!4567"
NEW_PASSWORD = "N3w-Credential!9472"


def _make_user(email="phase21-auth@example.com"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        full_name="Phase 2.1 Auth",
        role=User.Role.STAFF,
    )


def _login(user, *, source="192.0.2.10", password=PASSWORD):
    return APIClient().post(
        "/api/auth/login/",
        {"email": user.email, "password": password},
        format="json",
        REMOTE_ADDR=source,
    )


@pytest.mark.django_db
def test_database_source_throttle_is_shared_across_clients_and_cache_clear(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "1/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "100/min", raising=False)

    first = APIClient().post(
        "/api/auth/login/",
        {"email": "unknown-one@example.com", "password": PASSWORD},
        format="json",
        REMOTE_ADDR="192.0.2.77",
    )
    cache.clear()
    second = APIClient().post(
        "/api/auth/login/",
        {"email": "unknown-two@example.com", "password": PASSWORD},
        format="json",
        REMOTE_ADDR="192.0.2.77",
    )

    assert [first.status_code, second.status_code] == [401, 429]
    bucket = AuthenticationThrottleBucket.objects.get(scope="auth_login_source")
    assert len(bucket.key_digest) == 64
    assert "192.0.2.77" not in bucket.key_digest


@pytest.mark.django_db
def test_source_denial_short_circuits_fresh_identifier_bucket_flood(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "2/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "1000/min", raising=False)

    responses = [
        APIClient().post(
            "/api/auth/login/",
            {"email": f"rotating-{index}@example.com", "password": PASSWORD},
            format="json",
            REMOTE_ADDR="192.0.2.88",
        )
        for index in range(40)
    ]

    assert [response.status_code for response in responses[:3]] == [401, 401, 429]
    assert all(response.status_code == 429 for response in responses[2:])
    assert AuthenticationThrottleBucket.objects.filter(
        scope="auth_login_source"
    ).count() == 1
    assert AuthenticationThrottleBucket.objects.filter(
        scope="auth_login_identifier"
    ).count() == 2
    assert AuthenticationThrottleBucket.objects.count() == 3


@pytest.mark.django_db
def test_database_identifier_throttle_is_shared_across_sources(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "100/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "2/min", raising=False)
    payload = {"email": "TARGETED@example.com", "password": PASSWORD}

    responses = []
    for source in ("192.0.2.1", "192.0.2.2", "192.0.2.3"):
        cache.clear()
        responses.append(
            APIClient().post(
                "/api/auth/login/",
                payload,
                format="json",
                REMOTE_ADDR=source,
            )
        )

    assert [response.status_code for response in responses] == [401, 401, 429]
    bucket = AuthenticationThrottleBucket.objects.get(scope="auth_login_identifier")
    assert "targeted@example.com" not in bucket.key_digest


@pytest.mark.django_db
def test_refresh_has_shared_source_and_signed_identifier_dimensions(monkeypatch):
    user = _make_user("refresh-identifier@example.com")
    login = _login(user)
    monkeypatch.setattr(RefreshSourceThrottle, "rate", "100/min", raising=False)
    monkeypatch.setattr(RefreshIdentifierThrottle, "rate", "2/min", raising=False)

    responses = [
        APIClient().post(
            "/api/auth/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
            REMOTE_ADDR=source,
        )
        for source in ("198.51.100.1", "198.51.100.2", "198.51.100.3")
    ]

    assert [response.status_code for response in responses] == [200, 200, 429]
    assert AuthenticationThrottleBucket.objects.filter(
        scope="auth_refresh_identifier", request_count=2
    ).exists()


@pytest.mark.django_db
def test_fixed_window_resets_after_expiry(monkeypatch):
    clock = [1_000.0]
    monkeypatch.setattr(LoginSourceThrottle, "rate", "1/min", raising=False)
    monkeypatch.setattr(LoginSourceThrottle, "timer", staticmethod(lambda: clock[0]))
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "100/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "timer", staticmethod(lambda: clock[0]))

    payload = {"email": "window@example.com", "password": PASSWORD}
    first = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="203.0.113.4"
    )
    limited = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="203.0.113.4"
    )
    clock[0] += 61
    reset = APIClient().post(
        "/api/auth/login/", payload, format="json", REMOTE_ADDR="203.0.113.4"
    )

    assert [first.status_code, limited.status_code, reset.status_code] == [401, 429, 401]


@pytest.mark.django_db
def test_bucket_increment_locks_precreated_shard_before_absent_row(monkeypatch):
    calls = []
    original = QuerySet.select_for_update

    def tracked(queryset, *args, **kwargs):
        calls.append(queryset.model)
        return original(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "select_for_update", tracked)
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    allowed, _ = _consume_bucket(
        scope="auth_login_source",
        key_digest=_bucket_digest("auth_login_source", "192.0.2.99"),
        now=now,
        duration=60,
        limit=2,
    )

    assert allowed is True
    assert calls[:2] == [AuthenticationThrottleLock, AuthenticationThrottleBucket]


@pytest.mark.django_db
def test_cleanup_claims_bucket_then_session_with_skip_locked(monkeypatch):
    user = _make_user("cleanup-lock-order@example.com")
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    AuthenticationThrottleBucket.objects.create(
        scope="auth_login_source",
        key_digest="9" * 64,
        request_count=1,
        window_started_at=now - timedelta(minutes=2),
        expires_at=now - timedelta(minutes=1),
    )
    AuthSession.objects.create(
        user=user,
        account_version=user.version,
        expires_at=now - timedelta(seconds=1),
    )
    calls = []

    def instrumented_select_for_update(queryset, *args, **kwargs):
        calls.append((queryset.model, kwargs))
        # Instrument the PostgreSQL code path without emitting unsupported
        # FOR UPDATE SQL against the deterministic SQLite test database.
        return queryset

    monkeypatch.setattr(connection.features, "has_select_for_update", True)
    monkeypatch.setattr(
        connection.features, "has_select_for_update_skip_locked", True
    )
    monkeypatch.setattr(QuerySet, "select_for_update", instrumented_select_for_update)

    assert _delete_expired_auth_state_batches(
        now=now,
        bucket_batch_size=1,
        session_batch_size=1,
    ) == 2
    assert calls == [
        (AuthenticationThrottleBucket, {"skip_locked": True}),
        (AuthSession, {"skip_locked": True}),
    ]


@pytest.mark.django_db
def test_cleanup_sqlite_fallback_does_not_request_unsupported_row_locks(monkeypatch):
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    bucket = AuthenticationThrottleBucket.objects.create(
        scope="auth_login_source",
        key_digest="8" * 64,
        request_count=1,
        window_started_at=now - timedelta(minutes=2),
        expires_at=now - timedelta(minutes=1),
    )

    def unexpected_select_for_update(*args, **kwargs):
        raise AssertionError("SQLite cleanup must not request a row lock")

    monkeypatch.setattr(connection.features, "has_select_for_update", False)
    monkeypatch.setattr(QuerySet, "select_for_update", unexpected_select_for_update)

    assert _delete_expired_auth_state_batches(
        now=now,
        bucket_batch_size=1,
        session_batch_size=1,
    ) == 1
    assert not AuthenticationThrottleBucket.objects.filter(pk=bucket.pk).exists()


@pytest.mark.django_db
@override_settings(
    AUTH_THROTTLE_CLEANUP_INTERVAL_SECONDS=1,
    AUTH_THROTTLE_CLEANUP_BATCH_SIZE=1,
)
def test_expiry_cleanup_admission_drain_cannot_be_outpaced_by_bucket_creation():
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    expired = [
        AuthenticationThrottleBucket.objects.create(
            scope="auth_login_identifier",
            key_digest=character * 64,
            request_count=1,
            window_started_at=now - timedelta(minutes=3),
            expires_at=now - timedelta(minutes=2),
        )
        for character in "abcde"
    ]
    active = AuthenticationThrottleBucket.objects.create(
        scope="auth_login_identifier",
        key_digest="f" * 64,
        request_count=1,
        window_started_at=now,
        expires_at=now + timedelta(minutes=1),
    )
    # Keep the large leased maintenance pass disabled. The mandatory indexed
    # admission drain must still remove two stale rows per evaluation.
    AuthenticationThrottleLock.objects.filter(pk=0).update(
        next_cleanup_at=now + timedelta(hours=1)
    )

    assert cleanup_expired_auth_state(now=now) == 2
    assert not AuthenticationThrottleBucket.objects.filter(
        pk__in=[expired[0].pk, expired[1].pk]
    ).exists()
    assert cleanup_expired_auth_state(now=now) == 2
    assert cleanup_expired_auth_state(now=now) == 1
    assert not AuthenticationThrottleBucket.objects.filter(
        pk__in=[bucket.pk for bucket in expired]
    ).exists()
    assert AuthenticationThrottleBucket.objects.filter(pk=active.pk).exists()


@pytest.mark.django_db
@override_settings(
    AUTH_THROTTLE_CLEANUP_INTERVAL_SECONDS=1,
    AUTH_THROTTLE_CLEANUP_BATCH_SIZE=4,
    AUTH_SESSION_REVOKED_RETENTION_SECONDS=60,
)
def test_auth_session_cleanup_removes_only_expired_or_retained_revoked_rows():
    user = _make_user("session-cleanup@example.com")
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    expired = AuthSession.objects.create(
        user=user,
        account_version=user.version,
        expires_at=now - timedelta(seconds=1),
    )
    active = AuthSession.objects.create(
        user=user,
        account_version=user.version,
        expires_at=now + timedelta(hours=1),
    )
    old_revoked = AuthSession.objects.create(
        user=user,
        account_version=user.version,
        expires_at=now + timedelta(hours=1),
        revoked_at=now - timedelta(seconds=61),
    )
    recent_revoked = AuthSession.objects.create(
        user=user,
        account_version=user.version,
        expires_at=now + timedelta(hours=1),
        revoked_at=now - timedelta(seconds=59),
    )
    AuthenticationThrottleLock.objects.filter(pk=0).update(next_cleanup_at=None)

    assert cleanup_expired_auth_state(now=now) == 2
    assert not AuthSession.objects.filter(pk=expired.pk).exists()
    assert not AuthSession.objects.filter(pk=old_revoked.pk).exists()
    assert AuthSession.objects.filter(pk=active.pk).exists()
    assert AuthSession.objects.filter(pk=recent_revoked.pk).exists()


@pytest.mark.django_db
def test_login_issues_server_session_claim_in_access_and_refresh():
    user = _make_user("session-claims@example.com")
    login = _login(user)

    assert login.status_code == 200
    access_session_id = AccessToken(login.data["access"])[AUTH_SESSION_CLAIM]
    refresh_session_id = RefreshToken(login.data["refresh"])[AUTH_SESSION_CLAIM]
    assert access_session_id == refresh_session_id
    session = AuthSession.objects.get(pk=access_session_id)
    assert session.user == user
    assert session.account_version == user.version
    assert session.revoked_at is None
    refreshed = APIClient().post(
        "/api/auth/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert refreshed.status_code == 200
    assert AccessToken(refreshed.data["access"])[AUTH_SESSION_CLAIM] == access_session_id
    assert AuthSession.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_tokens_without_server_session_claim_cannot_bypass_authority_boundary():
    user = _make_user("missing-session-claim@example.com")
    legacy_refresh = RefreshToken.for_user(user)
    legacy_refresh[ACCOUNT_VERSION_CLAIM] = user.version
    legacy_access = legacy_refresh.access_token
    access_client = APIClient()
    access_client.credentials(HTTP_AUTHORIZATION=f"Bearer {legacy_access}")

    assert access_client.get("/api/me/").status_code == 401
    assert APIClient().post(
        "/api/auth/refresh/",
        {"refresh": str(legacy_refresh)},
        format="json",
    ).status_code == 401


@pytest.mark.django_db
def test_logout_revokes_access_and_refresh_for_only_submitted_token_family():
    user = _make_user("family-logout@example.com")
    session_a = _login(user, source="192.0.2.21")
    session_b = _login(user, source="192.0.2.22")
    session_a_id = AccessToken(session_a.data["access"])[AUTH_SESSION_CLAIM]
    session_b_id = AccessToken(session_b.data["access"])[AUTH_SESSION_CLAIM]

    logout = APIClient().post(
        "/api/auth/logout/",
        {"refresh": session_a.data["refresh"]},
        format="json",
        REMOTE_ADDR="192.0.2.21",
    )
    old_access = APIClient()
    old_access.credentials(HTTP_AUTHORIZATION=f"Bearer {session_a.data['access']}")
    independent_access = APIClient()
    independent_access.credentials(HTTP_AUTHORIZATION=f"Bearer {session_b.data['access']}")

    assert logout.status_code == 204
    assert AuthSession.objects.get(pk=session_a_id).revoked_at is not None
    assert old_access.get("/api/me/").status_code == 401
    assert APIClient().post(
        "/api/auth/refresh/",
        {"refresh": session_a.data["refresh"]},
        format="json",
    ).status_code == 401
    assert independent_access.get("/api/me/").status_code == 200
    assert APIClient().post(
        "/api/auth/refresh/",
        {"refresh": session_b.data["refresh"]},
        format="json",
    ).status_code == 200
    assert not AuthSession.objects.filter(
        pk=session_a_id, revoked_at__isnull=True
    ).exists()
    assert AuthSession.objects.get(pk=session_b_id).revoked_at is None


@pytest.mark.django_db
def test_password_change_invalidates_all_old_families_and_issues_fresh_family():
    user = _make_user("family-password-change@example.com")
    session_a = _login(user, source="192.0.2.31")
    session_b = _login(user, source="192.0.2.32")
    old_ids = {
        AccessToken(session_a.data["access"])[AUTH_SESSION_CLAIM],
        AccessToken(session_b.data["access"])[AUTH_SESSION_CLAIM],
    }
    changing_client = APIClient()
    changing_client.credentials(HTTP_AUTHORIZATION=f"Bearer {session_a.data['access']}")

    changed = changing_client.post(
        "/api/auth/change-password/",
        {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        format="json",
    )
    replacement_id = AccessToken(changed.data["access"])[AUTH_SESSION_CLAIM]

    assert changed.status_code == 200
    assert replacement_id not in old_ids
    for pair in (session_a.data, session_b.data):
        access_client = APIClient()
        access_client.credentials(HTTP_AUTHORIZATION=f"Bearer {pair['access']}")
        assert access_client.get("/api/me/").status_code == 401
        assert APIClient().post(
            "/api/auth/refresh/", {"refresh": pair["refresh"]}, format="json"
        ).status_code == 401
    replacement_client = APIClient()
    replacement_client.credentials(HTTP_AUTHORIZATION=f"Bearer {changed.data['access']}")
    assert replacement_client.get("/api/me/").status_code == 200


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_throttle_shard_serializes_concurrent_first_requests(monkeypatch):
    monkeypatch.setattr(LoginSourceThrottle, "rate", "1/min", raising=False)
    monkeypatch.setattr(LoginIdentifierThrottle, "rate", "100/min", raising=False)
    barrier = Barrier(2)

    def request(index):
        close_old_connections()
        barrier.wait(timeout=10)
        try:
            response = APIClient().post(
                "/api/auth/login/",
                {"email": f"pg-throttle-{index}@example.com", "password": PASSWORD},
                format="json",
                REMOTE_ADDR="203.0.113.88",
            )
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(request, range(2)))

    assert sorted(statuses) == [401, 429]


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL SKIP LOCKED cleanup requires a PostgreSQL test database.",
)
def test_postgresql_cleanup_workers_claim_disjoint_expired_batches():
    now = datetime(2026, 8, 20, tzinfo=datetime_timezone.utc)
    scope = "pg_cleanup_disjoint"
    for index in range(4):
        AuthenticationThrottleBucket.objects.create(
            scope=scope,
            key_digest=f"{index:064x}",
            request_count=1,
            window_started_at=now - timedelta(minutes=2),
            expires_at=now - timedelta(minutes=1),
        )
    barrier = Barrier(2)

    def cleanup_worker():
        close_old_connections()
        barrier.wait(timeout=10)
        try:
            return _delete_expired_auth_state_batches(
                now=now,
                bucket_batch_size=2,
                session_batch_size=1,
                bucket_scope=scope,
            )
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        deleted = list(executor.map(lambda _: cleanup_worker(), range(2)))

    assert sorted(deleted) == [2, 2]
    assert not AuthenticationThrottleBucket.objects.filter(scope=scope).exists()
