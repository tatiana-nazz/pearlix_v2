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

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "31536000") or "31536000")
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
