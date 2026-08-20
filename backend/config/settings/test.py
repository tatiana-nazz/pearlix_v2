from .base import *  # noqa: F403


DEBUG = False
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}
MEDIA_ROOT = BASE_DIR / "test_media"  # noqa: F405
# Normal tests must never discover or deserialize developer-local model files.
PEARLIX_AI_MODEL_ROOT = ""
PEARLIX_ALLOW_MOCK_AI = True
PEARLIX_ALLOW_DEMO_COMMANDS = True
