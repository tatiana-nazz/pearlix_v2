from __future__ import annotations

import os
from urllib.parse import urlparse

from django.conf import settings
from django.core.management.base import CommandError


_LIVE_ENVIRONMENT_VALUES = {"prod", "production", "live"}
_DEPLOYED_VERCEL_VALUES = {"preview", "production"}
_SUPABASE_DATABASE_HOST_SUFFIXES = (".supabase.com", ".supabase.co")


def _normalized(value) -> str:
    return str(value or "").strip().lower()


def _is_production_settings_module(value) -> bool:
    normalized = _normalized(value)
    return normalized == "config.settings.production" or normalized.endswith(".production")


def _configured_database_host() -> str:
    database = settings.DATABASES.get("default", {})
    host = _normalized(database.get("HOST")).rstrip(".")
    if host:
        return host

    # Some custom test/deployment settings retain a URL in NAME. The normal
    # Pearlix parser expands DATABASE_URL, but recognizing this representation
    # closes the same clearly-live Supabase target without opening a connection.
    name = str(database.get("NAME") or "").strip()
    if "://" in name:
        return _normalized(urlparse(name).hostname).rstrip(".")
    return ""


def assert_demo_environment_safe() -> None:
    """Fail before any demo/QA command reads or mutates application rows."""

    settings_modules = {
        os.environ.get("DJANGO_SETTINGS_MODULE", ""),
        getattr(settings, "SETTINGS_MODULE", ""),
    }
    if any(_is_production_settings_module(value) for value in settings_modules):
        raise CommandError("Demo and QA seed commands are disabled in production environments.")

    environment_values = {
        _normalized(os.environ.get("PEARLIX_ENVIRONMENT")),
        _normalized(os.environ.get("DJANGO_ENV")),
        _normalized(os.environ.get("ENVIRONMENT")),
        _normalized(getattr(settings, "PEARLIX_RUNTIME_ENVIRONMENT", "")),
    }
    if environment_values & _LIVE_ENVIRONMENT_VALUES:
        raise CommandError("Demo and QA seed commands are disabled in production environments.")

    if _normalized(os.environ.get("VERCEL_ENV")) in _DEPLOYED_VERCEL_VALUES:
        raise CommandError("Demo and QA seed commands are disabled in deployed Vercel environments.")

    database_host = _configured_database_host()
    if database_host and (
        database_host == "supabase.com"
        or database_host == "supabase.co"
        or database_host.endswith(_SUPABASE_DATABASE_HOST_SUFFIXES)
    ):
        raise CommandError("Demo and QA seed commands are disabled for live Supabase database targets.")

    if getattr(settings, "PEARLIX_ALLOW_DEMO_COMMANDS", False) is not True:
        raise CommandError(
            "Demo and QA seed commands require an explicitly enabled local/test environment."
        )
