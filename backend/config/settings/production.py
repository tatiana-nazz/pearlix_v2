from urllib.parse import parse_qs, urlparse

from django.core.exceptions import ImproperlyConfigured

from config.env import env, env_bool, env_list

from .base import *  # noqa: F403


DEBUG = False
CORS_ALLOW_ALL_ORIGINS = False

if (
    not SECRET_KEY  # noqa: F405
    or SECRET_KEY == "dev-only-insecure-secret-key-for-local-development"  # noqa: F405
):
    raise ImproperlyConfigured("SECRET_KEY must be configured in production.")

_database_url = env("DATABASE_URL")
if not _database_url:
    raise ImproperlyConfigured("DATABASE_URL must be configured in production.")

_parsed_database_url = urlparse(_database_url)
if _parsed_database_url.scheme.lower() not in {"postgres", "postgresql"}:
    raise ImproperlyConfigured("Production DATABASE_URL must use PostgreSQL.")

_database_ssl_values = parse_qs(
    _parsed_database_url.query,
    keep_blank_values=True,
).get("sslmode", [])
if len(_database_ssl_values) > 1:
    raise ImproperlyConfigured("Production DATABASE_URL must configure sslmode exactly once.")
_database_ssl_mode = (_database_ssl_values[0] if _database_ssl_values else "require").strip().lower()
if _database_ssl_mode not in {"require", "verify-ca", "verify-full"}:
    raise ImproperlyConfigured("Production database transport must require TLS.")

# Supabase Session Pooler accepts the standard libpq sslmode contract. Default
# an omitted mode to `require` so Supabase-generated URLs remain compatible,
# while an explicitly downgrade-capable value is rejected above.
DATABASES = {  # noqa: F405
    **DATABASES,  # noqa: F405
    "default": {
        **DATABASES["default"],  # noqa: F405
        "OPTIONS": {
            **DATABASES["default"].get("OPTIONS", {}),  # noqa: F405
            "sslmode": _database_ssl_mode,
        },
    },
}

if "*" in CORS_ALLOWED_ORIGINS:  # noqa: F405
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must not contain wildcard origins in production.")

_required_storage_env = {
    "SUPABASE_S3_ENDPOINT_URL": env("SUPABASE_S3_ENDPOINT_URL"),
    "SUPABASE_S3_ACCESS_KEY_ID": env("SUPABASE_S3_ACCESS_KEY_ID"),
    "SUPABASE_S3_SECRET_ACCESS_KEY": env("SUPABASE_S3_SECRET_ACCESS_KEY"),
    "SUPABASE_S3_BUCKET_NAME": env("SUPABASE_S3_BUCKET_NAME"),
    "SUPABASE_S3_REGION": env("SUPABASE_S3_REGION"),
}
_missing_storage_env = [name for name, value in _required_storage_env.items() if not value]
if _missing_storage_env:
    raise ImproperlyConfigured(
        "Private Supabase media storage is required in production. Missing: "
        + ", ".join(sorted(_missing_storage_env))
    )

_storage_endpoint = urlparse(_required_storage_env["SUPABASE_S3_ENDPOINT_URL"])
if (
    _storage_endpoint.scheme.lower() != "https"
    or not _storage_endpoint.hostname
    or _storage_endpoint.username is not None
    or _storage_endpoint.password is not None
):
    raise ImproperlyConfigured("Production storage endpoint must use credential-free HTTPS.")

# The deterministic adapter exists strictly for explicit local/test harnesses.
# Keep both startup configuration and the runtime adapter boundary fail-closed.
if PEARLIX_ALLOW_MOCK_AI:  # noqa: F405
    raise ImproperlyConfigured("Mock AI cannot be enabled in production.")
PEARLIX_ALLOW_MOCK_AI = False
PEARLIX_ALLOW_DEMO_COMMANDS = False
PEARLIX_RUNTIME_ENVIRONMENT = "production"
TRUSTED_PROXY_CIDRS = env_list("TRUSTED_PROXY_CIDRS", [])

_positive_resource_limits = {
    "PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL": PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL,  # noqa: F405
    "PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER": PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER,  # noqa: F405
    "PEARLIX_AI_INVOCATION_WINDOW_SECONDS": PEARLIX_AI_INVOCATION_WINDOW_SECONDS,  # noqa: F405
    "PEARLIX_AI_MAX_INVOCATIONS_PER_USER": PEARLIX_AI_MAX_INVOCATIONS_PER_USER,  # noqa: F405
    "PEARLIX_AI_MAX_INVOCATIONS_GLOBAL": PEARLIX_AI_MAX_INVOCATIONS_GLOBAL,  # noqa: F405
    "PEARLIX_XRAY_PATIENT_QUOTA_BYTES": PEARLIX_XRAY_PATIENT_QUOTA_BYTES,  # noqa: F405
    "PEARLIX_XRAY_USER_QUOTA_BYTES": PEARLIX_XRAY_USER_QUOTA_BYTES,  # noqa: F405
    "PEARLIX_XRAY_GLOBAL_QUOTA_BYTES": PEARLIX_XRAY_GLOBAL_QUOTA_BYTES,  # noqa: F405
}
if any(value <= 0 for value in _positive_resource_limits.values()):
    raise ImproperlyConfigured(
        "Production imaging and AI resource limits must all be positive."
    )

# Supabase Storage exposes an S3-compatible API. Generated S3 credentials are
# server-only and bypass Storage RLS, so the bucket stays private and browser
# access continues through Pearlix's authenticated protected-media endpoints.
STORAGES = {  # noqa: F405
    **STORAGES,  # noqa: F405
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "endpoint_url": _required_storage_env["SUPABASE_S3_ENDPOINT_URL"],
            "access_key": _required_storage_env["SUPABASE_S3_ACCESS_KEY_ID"],
            "secret_key": _required_storage_env["SUPABASE_S3_SECRET_ACCESS_KEY"],
            "bucket_name": _required_storage_env["SUPABASE_S3_BUCKET_NAME"],
            "region_name": _required_storage_env["SUPABASE_S3_REGION"],
            "addressing_style": "path",
            "signature_version": "s3v4",
            "file_overwrite": False,
        },
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MIDDLEWARE = MIDDLEWARE.copy()  # noqa: F405
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "31536000") or "31536000")
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
