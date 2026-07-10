from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import DoctorProfile, StaffProfile, User


QA_PASSWORD = "PearlixDev123!"
ADMIN_EMAIL = "admin.qa@pearlix.local"
STAFF_EMAIL = "staff.qa@pearlix.local"
DOCTOR_EMAIL = "doctor.qa@pearlix.local"
MUST_CHANGE_EMAIL = "doctor.mustchange@pearlix.local"
QA_EMAILS = {ADMIN_EMAIL, STAFF_EMAIL, DOCTOR_EMAIL}


def run_command(*args):
    stdout = StringIO()
    call_command("seed_dev_qa_users", *args, stdout=stdout)
    return stdout.getvalue()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_command_creates_admin_staff_and_doctor_users():
    output = run_command("--password", QA_PASSWORD)

    users = {user.email: user for user in User.objects.filter(email__in=QA_EMAILS)}
    assert set(users) == QA_EMAILS
    assert users[ADMIN_EMAIL].role == User.Role.ADMIN
    assert users[STAFF_EMAIL].role == User.Role.STAFF
    assert users[DOCTOR_EMAIL].role == User.Role.DOCTOR
    assert all(user.is_active for user in users.values())
    assert all(user.must_change_password is False for user in users.values())
    assert all(user.check_password(QA_PASSWORD) for user in users.values())
    assert "created: admin.qa@pearlix.local" in output
    assert "profile=staff created" in output
    assert "profile=doctor created" in output


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_command_is_idempotent_and_does_not_duplicate_users():
    run_command("--password", QA_PASSWORD)
    first_ids = set(User.objects.filter(email__in=QA_EMAILS).values_list("id", flat=True))

    output = run_command("--password", QA_PASSWORD)

    assert User.objects.filter(email__in=QA_EMAILS).count() == 3
    assert set(User.objects.filter(email__in=QA_EMAILS).values_list("id", flat=True)) == first_ids
    assert "updated: admin.qa@pearlix.local" in output
    assert "profile=staff present" in output
    assert "profile=doctor present" in output


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_existing_password_is_preserved_without_reset_passwords():
    run_command("--password", QA_PASSWORD)

    output = run_command("--password", "AnotherDev123!")

    user = User.objects.get(email=STAFF_EMAIL)
    assert user.check_password(QA_PASSWORD)
    assert user.check_password("AnotherDev123!") is False
    assert "updated: staff.qa@pearlix.local" in output


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_existing_password_changes_with_reset_passwords():
    run_command("--password", QA_PASSWORD)

    run_command("--password", "AnotherDev123!", "--reset-passwords")

    user = User.objects.get(email=STAFF_EMAIL)
    assert user.check_password("AnotherDev123!")
    assert user.check_password(QA_PASSWORD) is False


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_environment_variable_password_works(monkeypatch):
    monkeypatch.setenv("PEARLIX_DEV_QA_PASSWORD", "EnvDev123!")

    run_command()

    assert User.objects.get(email=DOCTOR_EMAIL).check_password("EnvDev123!")


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_fallback_password_works_when_no_arg_or_env_password_exists(monkeypatch):
    monkeypatch.delenv("PEARLIX_DEV_QA_PASSWORD", raising=False)

    output = run_command()

    assert "Using local development fallback password. Never use this password in production." in output
    assert User.objects.get(email=ADMIN_EMAIL).check_password(QA_PASSWORD)


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_include_must_change_user_creates_doctor_with_required_password_change():
    run_command("--password", QA_PASSWORD, "--include-must-change-user")

    user = User.objects.get(email=MUST_CHANGE_EMAIL)
    assert user.full_name == "Pearlix Must Change Doctor"
    assert user.role == User.Role.DOCTOR
    assert user.is_active is True
    assert user.must_change_password is True
    assert user.check_password(QA_PASSWORD)


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_doctor_and_staff_profiles_are_created_if_required():
    run_command("--password", QA_PASSWORD, "--include-must-change-user")

    doctor = User.objects.get(email=DOCTOR_EMAIL)
    must_change_doctor = User.objects.get(email=MUST_CHANGE_EMAIL)
    staff = User.objects.get(email=STAFF_EMAIL)
    assert DoctorProfile.objects.filter(user=doctor).exists()
    assert DoctorProfile.objects.filter(user=must_change_doctor).exists()
    assert StaffProfile.objects.filter(user=staff).exists()


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_command_refuses_when_debug_false_without_allow_non_debug():
    with pytest.raises(CommandError, match="Refusing to seed QA users when DEBUG is false"):
        run_command("--password", QA_PASSWORD)


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_command_can_run_when_debug_false_with_allow_non_debug():
    output = run_command("--password", QA_PASSWORD, "--allow-non-debug")

    assert "intended only for controlled QA/dev environments" in output
    assert User.objects.filter(email=ADMIN_EMAIL).exists()


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_show_passwords_is_rejected_when_debug_false_even_with_allow_non_debug():
    with pytest.raises(CommandError, match="--show-passwords is only allowed when DEBUG is true"):
        run_command("--password", QA_PASSWORD, "--allow-non-debug", "--show-passwords")


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_show_passwords_prints_credentials_in_debug_mode():
    output = run_command("--password", QA_PASSWORD, "--include-must-change-user", "--show-passwords")

    assert "Local-only credentials:" in output
    assert f"{ADMIN_EMAIL} / {QA_PASSWORD}" in output
    assert f"{MUST_CHANGE_EMAIL} / {QA_PASSWORD}" in output


@pytest.mark.django_db
def test_no_account_model_migration_changes_are_introduced():
    call_command("makemigrations", "accounts", dry_run=True, check=True, verbosity=0)
