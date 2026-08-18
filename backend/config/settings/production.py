from django.core.exceptions import ImproperlyConfigured

from config.env import env, env_bool

from .base import *  # noqa: F403


DEBUG = False
CORS_ALLOW_ALL_ORIGINS = False

if SECRET_KEY == "dev-only-insecure-secret-key-for-local-development":  # noqa: F405
    raise ImproperlyConfigured("SECRET_KEY must be configured in production.")

if not env("DATABASE_URL"):
    raise ImproperlyConfigured("DATABASE_URL must be configured in production.")

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
