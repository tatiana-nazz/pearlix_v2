"""Bounded public-authentication abuse controls."""

from collections.abc import Mapping

from django.utils.crypto import salted_hmac
from rest_framework.throttling import SimpleRateThrottle

from apps.common.client_ip import get_request_ip


class _RequestSourceThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        source = get_request_ip(request) or "unknown-source"
        return self.cache_format % {"scope": self.scope, "ident": source}


class LoginSourceThrottle(_RequestSourceThrottle):
    scope = "auth_login_source"


class LoginIdentifierThrottle(SimpleRateThrottle):
    """Temporarily bound attacks on one identifier without storing raw email."""

    scope = "auth_login_identifier"

    def get_cache_key(self, request, view):
        value = request.data.get("email", "") if isinstance(request.data, Mapping) else ""
        normalized = str(value).strip().casefold()[:320]
        digest = salted_hmac(
            "pearlix.auth.login-throttle",
            normalized or "missing-identifier",
        ).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}


class RefreshSourceThrottle(_RequestSourceThrottle):
    scope = "auth_refresh_source"


class LogoutSourceThrottle(_RequestSourceThrottle):
    scope = "auth_logout_source"
