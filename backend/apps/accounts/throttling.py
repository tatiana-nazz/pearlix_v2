"""Database-shared, bounded public-authentication abuse controls."""

import math
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone as datetime_timezone

from django.conf import settings
from django.db import connections, transaction
from django.db.models import Q
from django.utils.crypto import salted_hmac
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import UntypedToken

from apps.accounts.models import (
    AuthSession,
    AuthenticationThrottleBucket,
    AuthenticationThrottleLock,
)
from apps.common.client_ip import get_request_ip


THROTTLE_LOCK_SHARDS = 64
MAX_CLEANUP_BATCH = 1_000
ADMISSION_BUCKET_DRAIN = 2
ADMISSION_SESSION_DRAIN = 1
THROTTLE_DENIED_REQUEST_ATTRIBUTE = "_pearlix_auth_throttle_denied"


def _bucket_digest(scope, identity):
    # Neither raw client addresses nor identifiers are persisted.
    return salted_hmac(
        "pearlix.auth.database-throttle",
        f"{scope}:{identity}",
        algorithm="sha256",
    ).hexdigest()


def _consume_bucket(*, scope, key_digest, now, duration, limit):
    """Atomically consume one request from a shared fixed-window bucket."""

    shard = int(key_digest[:8], 16) % THROTTLE_LOCK_SHARDS
    expires_at = now + timedelta(seconds=duration)
    with transaction.atomic():
        # The pre-created shard lock serializes both absent-row creation and
        # existing-row increments across PostgreSQL application instances.
        AuthenticationThrottleLock.objects.select_for_update().get(pk=shard)
        bucket = (
            AuthenticationThrottleBucket.objects.select_for_update()
            .filter(scope=scope, key_digest=key_digest)
            .first()
        )
        if bucket is None:
            bucket = AuthenticationThrottleBucket.objects.create(
                scope=scope,
                key_digest=key_digest,
                request_count=1,
                window_started_at=now,
                expires_at=expires_at,
            )
            return True, bucket.expires_at

        if bucket.expires_at <= now:
            bucket.request_count = 1
            bucket.window_started_at = now
            bucket.expires_at = expires_at
            bucket.save(
                update_fields=[
                    "request_count",
                    "window_started_at",
                    "expires_at",
                    "updated_at",
                ]
            )
            return True, bucket.expires_at

        if bucket.request_count >= limit:
            return False, bucket.expires_at

        bucket.request_count += 1
        bucket.save(update_fields=["request_count", "updated_at"])
        return True, bucket.expires_at


def _delete_expired_auth_state_batches(
    *, now, bucket_batch_size, session_batch_size, bucket_scope=None
):
    """Atomically claim and delete indexed, explicitly capped expiry batches."""

    def claim(queryset):
        features = connections[queryset.db].features
        if not features.has_select_for_update:
            # SQLite's deterministic test path has no row-lock primitive.
            return queryset
        return queryset.select_for_update(
            skip_locked=features.has_select_for_update_skip_locked
        )

    # Every cleaner claims buckets before sessions. PostgreSQL callers skip
    # rows already claimed by peers instead of collapsing onto the same batch.
    with transaction.atomic():
        expired_buckets = AuthenticationThrottleBucket.objects.filter(
            expires_at__lte=now
        )
        if bucket_scope is not None:
            expired_buckets = expired_buckets.filter(scope=bucket_scope)
        expired_ids = list(
            claim(expired_buckets)
            .order_by("expires_at", "pk")
            .values_list("pk", flat=True)[:bucket_batch_size]
        )
        deleted = 0
        if expired_ids:
            deleted, _ = AuthenticationThrottleBucket.objects.filter(
                pk__in=expired_ids,
                expires_at__lte=now,
            ).delete()

        revoked_retention = max(
            0,
            int(getattr(settings, "AUTH_SESSION_REVOKED_RETENTION_SECONDS", 86_400)),
        )
        revoked_before = now - timedelta(seconds=revoked_retention)
        expired_sessions = AuthSession.objects.filter(
            Q(expires_at__lte=now) | Q(revoked_at__lte=revoked_before)
        )
        expired_session_ids = list(
            claim(expired_sessions)
            .order_by("expires_at", "pk")
            .values_list("pk", flat=True)[:session_batch_size]
        )
        if expired_session_ids:
            session_deleted, _ = AuthSession.objects.filter(
                pk__in=expired_session_ids
            ).filter(
                Q(expires_at__lte=now) | Q(revoked_at__lte=revoked_before)
            ).delete()
            deleted += session_deleted
        return deleted


def cleanup_expired_auth_state(*, now, bucket_scope=None):
    """Drain admission growth, then optionally run one leased maintenance batch."""

    # One throttle evaluation can persist at most one new bucket. Draining two
    # expired buckets and one expired session on every evaluation means stale
    # backlog shrinks under admitted traffic even when identifiers rotate.
    deleted = _delete_expired_auth_state_batches(
        now=now,
        bucket_batch_size=ADMISSION_BUCKET_DRAIN,
        session_batch_size=ADMISSION_SESSION_DRAIN,
        bucket_scope=bucket_scope,
    )

    interval = max(
        1,
        int(getattr(settings, "AUTH_THROTTLE_CLEANUP_INTERVAL_SECONDS", 60)),
    )
    batch_size = min(
        MAX_CLEANUP_BATCH,
        max(1, int(getattr(settings, "AUTH_THROTTLE_CLEANUP_BATCH_SIZE", 256))),
    )
    lease_until = now + timedelta(seconds=interval)
    claimed = (
        AuthenticationThrottleLock.objects.filter(pk=0)
        .filter(Q(next_cleanup_at__isnull=True) | Q(next_cleanup_at__lte=now))
        .update(next_cleanup_at=lease_until)
    )
    if claimed != 1:
        return deleted

    return deleted + _delete_expired_auth_state_batches(
        now=now,
        bucket_batch_size=batch_size,
        session_batch_size=batch_size,
    )


class DatabaseAuthenticationThrottle(SimpleRateThrottle):
    """DRF throttle backed by the deployment's shared relational database."""

    def get_bucket_identity(self, request, view):
        raise NotImplementedError

    def get_cache_key(self, request, view):
        identity = self.get_bucket_identity(request, view)
        if identity is None:
            return None
        return _bucket_digest(self.scope, identity)

    def allow_request(self, request, view):
        # DRF deliberately evaluates every configured throttle even after one
        # denies. Avoid creating attacker-selected later-dimension rows while
        # preserving the earlier throttle's 429 and Retry-After result.
        if getattr(request, THROTTLE_DENIED_REQUEST_ATTRIBUTE, False):
            return True
        if self.rate is None:
            return True
        key_digest = self.get_cache_key(request, view)
        if key_digest is None:
            return True

        self.now = self.timer()
        now = datetime.fromtimestamp(self.now, tz=datetime_timezone.utc)
        allowed, self._bucket_expires_at = _consume_bucket(
            scope=self.scope,
            key_digest=key_digest,
            now=now,
            duration=self.duration,
            limit=self.num_requests,
        )
        cleanup_expired_auth_state(now=now, bucket_scope=self.scope)
        if not allowed:
            setattr(request, THROTTLE_DENIED_REQUEST_ATTRIBUTE, True)
        return allowed

    def wait(self):
        expires_at = getattr(self, "_bucket_expires_at", None)
        if expires_at is None:
            return None
        now = datetime.fromtimestamp(self.now, tz=datetime_timezone.utc)
        return max(1, math.ceil((expires_at - now).total_seconds()))


class _RequestSourceThrottle(DatabaseAuthenticationThrottle):
    def get_bucket_identity(self, request, view):
        return get_request_ip(request) or "unknown-source"


class LoginSourceThrottle(_RequestSourceThrottle):
    scope = "auth_login_source"


class LoginIdentifierThrottle(DatabaseAuthenticationThrottle):
    """Temporarily bound attacks on one identifier without storing raw email."""

    scope = "auth_login_identifier"

    def get_bucket_identity(self, request, view):
        value = request.data.get("email", "") if isinstance(request.data, Mapping) else ""
        return str(value).strip().casefold()[:320] or "missing-identifier"


class RefreshSourceThrottle(_RequestSourceThrottle):
    scope = "auth_refresh_source"


class RefreshIdentifierThrottle(DatabaseAuthenticationThrottle):
    """Bound refresh attempts per signed user identity without storing tokens."""

    scope = "auth_refresh_identifier"

    def get_bucket_identity(self, request, view):
        value = request.data.get("refresh", "") if isinstance(request.data, Mapping) else ""
        try:
            token = UntypedToken(str(value))
        except (TokenError, TypeError):
            return "invalid-refresh"
        user_id = token.payload.get(api_settings.USER_ID_CLAIM)
        return f"user:{user_id}" if user_id is not None else "invalid-refresh"


class LogoutSourceThrottle(_RequestSourceThrottle):
    scope = "auth_logout_source"
