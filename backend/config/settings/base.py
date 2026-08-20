from datetime import timedelta
from pathlib import Path

from config.env import database_config, env, env_bool, env_list, load_env_file


BASE_DIR = Path(__file__).resolve().parents[2]
load_env_file(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", "dev-only-insecure-secret-key-for-local-development")
DEBUG = env_bool("DEBUG", False)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "apps.common",
    "apps.accounts",
    "apps.clinic",
    "apps.patients",
    "apps.scheduling",
    "apps.visits",
    "apps.xrays",
    "apps.ai_results",
    "apps.billing",
    "apps.dashboard",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.MandatoryPasswordChangeMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": database_config(BASE_DIR / "db.sqlite3"),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", "Asia/Damascus")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Local/test defaults remain filesystem-backed. Production replaces the default
# storage with the private Supabase S3-compatible backend while keeping Django's
# protected-media endpoints as the only browser-facing file access path.
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", [])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", [])
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173")
AI_SERVICE_URL = env("AI_SERVICE_URL", "")
AI_SERVICE_TOKEN = env("AI_SERVICE_TOKEN", "")
# Real adapters resolve artifacts from this trusted root. Paths remain configurable,
# while hashes and inference policy stay locked in application code.
PEARLIX_AI_MODEL_ROOT = env("PEARLIX_AI_MODEL_ROOT", "")
PEARLIX_AI_DETECTOR_PATH = env(
    "PEARLIX_AI_DETECTOR_PATH", "weights/detector_yolo_fdi_seg_v1-3_best.pt"
)
PEARLIX_AI_CLASSIFIER_PATH = env("PEARLIX_AI_CLASSIFIER_PATH", "weights/classifier_exp1_epoch12.pt")
PEARLIX_AI_FDI_MAP_PATH = env("PEARLIX_AI_FDI_MAP_PATH", "contract/fdi_class_map.json")
PEARLIX_AI_DEVICE = env("PEARLIX_AI_DEVICE", "cpu")
PEARLIX_AI_MAX_CONCURRENT_INFERENCES = int(
    env("PEARLIX_AI_MAX_CONCURRENT_INFERENCES", "1") or "1"
)
# The deterministic adapter is a test harness. Production and ordinary local
# runtime paths fail closed even if the persisted clinic mode still names it.
PEARLIX_ALLOW_MOCK_AI = env_bool("PEARLIX_ALLOW_MOCK_AI", False)
# A bounded lease allows a later request to recover work abandoned by a dead worker.
PEARLIX_AI_PROCESSING_STALE_SECONDS = int(
    env("PEARLIX_AI_PROCESSING_STALE_SECONDS", "900") or "900"
)
FILE_UPLOAD_MAX_MEMORY_SIZE = int(env("FILE_UPLOAD_MAX_MEMORY_SIZE", str(10 * 1024 * 1024)) or str(10 * 1024 * 1024))

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.PasswordLifecycleJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.common.exceptions.standard_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
