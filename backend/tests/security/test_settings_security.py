import json
import os
import subprocess
import sys
from datetime import timedelta

import pytest
from django.conf import settings

from apps.xrays.services import MAX_XRAY_SIZE_BYTES
from config.env import env_bool, env_list


def _run_backend_python(
    *arguments: str,
    environment: dict[str, str],
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, *arguments],
        cwd=settings.BASE_DIR,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def _environment_without_settings_module() -> dict[str, str]:
    environment = os.environ.copy()
    environment.pop("DJANGO_SETTINGS_MODULE", None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return environment


def _configured_production_environment(database_url: str) -> dict[str, str]:
    environment = _environment_without_settings_module()
    environment.update(
        {
            "DJANGO_SETTINGS_MODULE": "config.settings.production",
            "SECRET_KEY": "deployment-test-secret-key-that-is-not-a-runtime-secret",
            "DATABASE_URL": database_url,
            "ALLOWED_HOSTS": "testserver",
            "CORS_ALLOWED_ORIGINS": "https://frontend.example.test",
            "CSRF_TRUSTED_ORIGINS": "https://frontend.example.test",
            "FRONTEND_URL": "https://frontend.example.test",
            "PEARLIX_ALLOW_MOCK_AI": "false",
            "SUPABASE_S3_ENDPOINT_URL": "https://storage.example.test/s3",
            "SUPABASE_S3_ACCESS_KEY_ID": "deployment-test-access-key",
            "SUPABASE_S3_SECRET_ACCESS_KEY": "deployment-test-secret-key",
            "SUPABASE_S3_BUCKET_NAME": "deployment-test-bucket",
            "SUPABASE_S3_REGION": "deployment-test-region",
            "TRUSTED_PROXY_CIDRS": "10.0.0.0/8,2001:db8::/32",
        }
    )
    return environment


def test_rest_framework_auth_permission_and_pagination_defaults_are_secure():
    drf = settings.REST_FRAMEWORK

    assert drf["DEFAULT_AUTHENTICATION_CLASSES"] == [
        "apps.accounts.authentication.PasswordLifecycleJWTAuthentication",
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


def test_deployable_entrypoints_fail_closed_without_settings_selection():
    for module_name in ("config.wsgi", "config.asgi"):
        result = _run_backend_python(
            "-c",
            f"import {module_name}",
            environment=_environment_without_settings_module(),
        )

        assert result.returncode != 0
        assert "DJANGO_SETTINGS_MODULE" in f"{result.stdout}\n{result.stderr}"


def test_management_commands_require_an_explicit_settings_route():
    missing_settings = _run_backend_python(
        "manage.py",
        "check",
        environment=_environment_without_settings_module(),
    )
    assert missing_settings.returncode != 0
    assert "DJANGO_SETTINGS_MODULE" in f"{missing_settings.stdout}\n{missing_settings.stderr}"

    explicit_local = _run_backend_python(
        "manage.py",
        "check",
        "--settings=config.settings.local",
        environment=_environment_without_settings_module(),
    )
    assert explicit_local.returncode == 0, explicit_local.stderr
    assert "System check identified no issues" in explicit_local.stdout


def test_production_entrypoint_fails_fast_when_required_values_are_missing(tmp_path):
    valid_environment = _configured_production_environment(
        "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=require"
    )
    missing_value_cases = (
        ("SECRET_KEY", "SECRET_KEY must be configured in production"),
        ("DATABASE_URL", "DATABASE_URL must be configured in production"),
        (
            "SUPABASE_S3_ACCESS_KEY_ID",
            "Private Supabase media storage is required in production",
        ),
    )

    for missing_name, expected_error in missing_value_cases:
        environment = valid_environment.copy()
        environment[missing_name] = ""

        result = _run_backend_python(
            "-c",
            "import config.wsgi",
            environment=environment,
        )

        assert result.returncode != 0
        assert expected_error in f"{result.stdout}\n{result.stderr}"


def test_configured_production_entrypoint_uses_hardened_settings(tmp_path):
    environment = _configured_production_environment(
        "postgresql://deployment:placeholder@db.example.test/pearlix"
    )

    result = _run_backend_python(
        "-c",
        (
            "import config.wsgi; "
            "from django.conf import settings; "
            "assert settings.SETTINGS_MODULE == 'config.settings.production'; "
            "assert settings.DEBUG is False; "
            "assert settings.SECRET_KEY != 'dev-only-insecure-secret-key-for-local-development'; "
            "assert settings.DATABASES['default']['OPTIONS']['sslmode'] == 'require'; "
            "assert settings.PEARLIX_ALLOW_MOCK_AI is False; "
            "assert settings.PEARLIX_ALLOW_DEMO_COMMANDS is False; "
            "assert settings.PEARLIX_RUNTIME_ENVIRONMENT == 'production'; "
            "assert settings.TRUSTED_PROXY_CIDRS == ['10.0.0.0/8', '2001:db8::/32']"
        ),
        environment=environment,
    )

    assert result.returncode == 0, result.stderr


def test_vercel_manifest_pins_production_settings():
    manifest_path = settings.BASE_DIR / "vercel.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["env"]["DJANGO_SETTINGS_MODULE"] == "config.settings.production"


def test_retired_staging_seed_script_cannot_target_live_database():
    script = (settings.BASE_DIR / "seed_staging.ps1").read_text(encoding="utf-8")

    assert "This command is retired" in script
    assert "DATABASE_URL" not in script
    assert "seed_demo" not in script


@pytest.mark.parametrize(
    ("database_url", "expected_error"),
    [
        (
            "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=disable",
            "Production database transport must require TLS",
        ),
        (
            "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=prefer",
            "Production database transport must require TLS",
        ),
        (
            "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=require&sslmode=verify-full",
            "must configure sslmode exactly once",
        ),
        (
            "sqlite:///deployment.sqlite3",
            "Production DATABASE_URL must use PostgreSQL",
        ),
    ],
)
def test_production_rejects_unsafe_database_transport(database_url, expected_error):
    result = _run_backend_python(
        "-c",
        "import config.wsgi",
        environment=_configured_production_environment(database_url),
    )

    assert result.returncode != 0
    assert expected_error in f"{result.stdout}\n{result.stderr}"


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://storage.example.test/s3",
        "ftp://storage.example.test/s3",
        "https://embedded:credential@storage.example.test/s3",
    ],
)
def test_production_rejects_unsafe_storage_transport(endpoint):
    environment = _configured_production_environment(
        "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=require"
    )
    environment["SUPABASE_S3_ENDPOINT_URL"] = endpoint

    result = _run_backend_python("-c", "import config.wsgi", environment=environment)

    assert result.returncode != 0
    assert "Production storage endpoint must use credential-free HTTPS" in f"{result.stdout}\n{result.stderr}"


def test_production_accepts_supabase_pooler_and_private_s3_contract():
    environment = _configured_production_environment(
        "postgresql://postgres.project:placeholder@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
    )
    environment["SUPABASE_S3_ENDPOINT_URL"] = (
        "https://project.storage.supabase.co/storage/v1/s3"
    )

    result = _run_backend_python(
        "-c",
        (
            "import config.wsgi; "
            "from django.conf import settings; "
            "assert settings.DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql'; "
            "assert settings.DATABASES['default']['OPTIONS']['sslmode'] == 'require'; "
            "assert settings.STORAGES['default']['OPTIONS']['endpoint_url'].startswith('https://')"
        ),
        environment=environment,
    )

    assert result.returncode == 0, result.stderr


def test_production_rejects_runtime_mock_ai_enablement():
    environment = _configured_production_environment(
        "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=require"
    )
    environment["PEARLIX_ALLOW_MOCK_AI"] = "true"

    result = _run_backend_python("-c", "import config.wsgi", environment=environment)

    assert result.returncode != 0
    assert "Mock AI cannot be enabled in production" in f"{result.stdout}\n{result.stderr}"


def test_production_demo_command_fails_before_database_access_and_hides_password():
    supplied_password = "NeverEchoThisDemoCredential!2026"
    environment = _configured_production_environment(
        "postgresql://deployment:placeholder@db.example.test/pearlix?sslmode=require"
    )

    result = _run_backend_python(
        "manage.py",
        "seed_demo",
        "--password",
        supplied_password,
        environment=environment,
    )

    combined_output = f"{result.stdout}\n{result.stderr}"
    assert result.returncode != 0
    assert "disabled in production environments" in combined_output
    assert supplied_password not in combined_output
