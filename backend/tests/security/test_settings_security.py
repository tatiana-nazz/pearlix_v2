from datetime import timedelta

from django.conf import settings

from apps.xrays.services import MAX_XRAY_SIZE_BYTES
from config.env import env_bool, env_list


def test_rest_framework_auth_permission_and_pagination_defaults_are_secure():
    drf = settings.REST_FRAMEWORK

    assert drf["DEFAULT_AUTHENTICATION_CLASSES"] == [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ]
    assert drf["DEFAULT_PERMISSION_CLASSES"] == [
        "rest_framework.permissions.IsAuthenticated",
    ]
    assert "rest_framework.permissions.AllowAny" not in drf["DEFAULT_PERMISSION_CLASSES"]
    assert drf["DEFAULT_PAGINATION_CLASS"] == "rest_framework.pagination.PageNumberPagination"
    assert drf["PAGE_SIZE"] == 20


def test_jwt_and_upload_limits_are_explicit_for_mvp():
    simple_jwt = settings.SIMPLE_JWT

    assert simple_jwt["AUTH_HEADER_TYPES"] == ("Bearer",)
    assert simple_jwt["ACCESS_TOKEN_LIFETIME"] <= timedelta(hours=1)
    assert simple_jwt["REFRESH_TOKEN_LIFETIME"] <= timedelta(days=1)
    assert simple_jwt["ROTATE_REFRESH_TOKENS"] is False
    assert settings.FILE_UPLOAD_MAX_MEMORY_SIZE == MAX_XRAY_SIZE_BYTES


def test_environment_helpers_drive_security_relevant_settings(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("ALLOWED_HOSTS", "localhost,127.0.0.1")

    assert env_bool("DEBUG", False) is True
    assert env_list("ALLOWED_HOSTS") == ["localhost", "127.0.0.1"]
    assert isinstance(settings.DEBUG, bool)
    assert settings.SECRET_KEY
    assert settings.ALLOWED_HOSTS
    assert "*" not in settings.CORS_ALLOWED_ORIGINS
    assert "*" not in settings.CSRF_TRUSTED_ORIGINS


def test_production_settings_source_has_safe_defaults():
    production_path = settings.BASE_DIR / "config" / "settings" / "production.py"
    production_source = production_path.read_text(encoding="utf-8")

    assert "DEBUG = False" in production_source
    assert "CORS_ALLOW_ALL_ORIGINS = False" in production_source
    assert "SESSION_COOKIE_SECURE = True" in production_source
    assert "CSRF_COOKIE_SECURE = True" in production_source
    assert "SECURE_PROXY_SSL_HEADER" in production_source
    assert "SECURE_HSTS_SECONDS" in production_source
    assert "CORS_ALLOWED_ORIGINS must not contain wildcard" in production_source


def test_production_settings_require_private_remote_media_storage():
    production_path = settings.BASE_DIR / "config" / "settings" / "production.py"
    production_source = production_path.read_text(encoding="utf-8")

    assert "storages.backends.s3.S3Storage" in production_source
    assert "SUPABASE_S3_ENDPOINT_URL" in production_source
    assert "SUPABASE_S3_ACCESS_KEY_ID" in production_source
    assert "SUPABASE_S3_SECRET_ACCESS_KEY" in production_source
    assert "SUPABASE_S3_BUCKET_NAME" in production_source
    assert "SUPABASE_S3_REGION" in production_source
    assert '"addressing_style": "path"' in production_source
    assert '"signature_version": "s3v4"' in production_source
    assert "Private Supabase media storage is required in production" in production_source
    assert "whitenoise.storage.CompressedManifestStaticFilesStorage" in production_source
