from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from django.contrib.auth.hashers import make_password
from django.db import close_old_connections, connection

from apps.accounts.models import User
from apps.accounts.serializers import PreferencesSerializer, UserManagementSerializer


@pytest.mark.django_db
def test_management_serializer_benign_edit_is_column_limited(admin_user):
    initial_version = admin_user.version
    serializer = UserManagementSerializer(admin_user, data={"full_name": "Updated"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    admin_user.refresh_from_db()
    assert admin_user.full_name == "Updated"
    assert admin_user.version == initial_version
    assert admin_user.is_active and admin_user.is_staff


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL stale-snapshot concurrency proof requires PostgreSQL.",
)
@pytest.mark.parametrize("lifecycle", ["password", "role", "deactivate"])
def test_postgresql_stale_preference_save_cannot_undo_security_lifecycle(lifecycle):
    initial_role = User.Role.ADMIN if lifecycle == "role" else User.Role.STAFF
    user = User.objects.create_user(
        email=f"phase63-{lifecycle}@example.com",
        password="Temp0rary!4567",
        full_name="Phase 6.3",
        role=initial_role,
        is_staff=lifecycle == "role",
        is_superuser=lifecycle == "role",
    )
    loaded = Event()
    release = Event()

    def stale_preference_write():
        close_old_connections()
        stale = User.objects.get(pk=user.pk)
        serializer = PreferencesSerializer(
            stale,
            data={"theme_preference": User.ThemePreference.DARK},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors
        loaded.set()
        assert release.wait(timeout=5)
        serializer.save()
        close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(stale_preference_write)
        assert loaded.wait(timeout=5)
        if lifecycle == "password":
            User.objects.filter(pk=user.pk).update(
                password=make_password("N3w-Credential!9472"),
                must_change_password=True,
                version=user.version + 1,
            )
        elif lifecycle == "role":
            User.objects.filter(pk=user.pk).update(
                role=User.Role.STAFF,
                is_staff=False,
                is_superuser=False,
                version=user.version + 1,
            )
        else:
            User.objects.filter(pk=user.pk).update(is_active=False, version=user.version + 1)
        release.set()
        future.result(timeout=5)

    user.refresh_from_db()
    assert user.theme_preference == User.ThemePreference.DARK
    assert user.version == 2
    if lifecycle == "password":
        assert user.must_change_password and user.check_password("N3w-Credential!9472")
    elif lifecycle == "role":
        assert user.role == User.Role.STAFF and not user.is_staff and not user.is_superuser
    else:
        assert user.is_active is False
