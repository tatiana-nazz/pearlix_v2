import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.common.demo_safety import assert_demo_environment_safe


@pytest.mark.parametrize(
    ("command", "arguments"),
    [
        ("seed_demo", ("--password", "LocalOnlyCredential!2026")),
        ("populate_demo_analytics", ()),
        ("populate_demo_analytics_realistic", ()),
        ("finalize_demo_seed", ()),
        ("seed_demo_clinic_story", ("--password", "LocalOnlyCredential!2026")),
        ("seed_dev_qa_users", ("--password", "LocalOnlyCredential!2026")),
    ],
)
def test_every_demo_and_qa_command_refuses_deployed_vercel_environment(
    monkeypatch,
    command,
    arguments,
):
    monkeypatch.setenv("VERCEL_ENV", "production")

    with pytest.raises(CommandError, match="disabled in deployed Vercel environments"):
        call_command(command, *arguments)


def test_demo_guard_allows_explicit_test_configuration(monkeypatch):
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.delenv("PEARLIX_ENVIRONMENT", raising=False)
    monkeypatch.delenv("DJANGO_ENV", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    assert_demo_environment_safe()


def test_demo_guard_defaults_to_denied_without_explicit_opt_in(monkeypatch):
    monkeypatch.setattr(settings, "PEARLIX_ALLOW_DEMO_COMMANDS", False)

    with pytest.raises(CommandError, match="explicitly enabled local/test environment"):
        assert_demo_environment_safe()


def test_demo_guard_rejects_clearly_live_supabase_database_host(monkeypatch):
    monkeypatch.setitem(
        settings.DATABASES["default"],
        "HOST",
        "aws-0-eu-west-1.pooler.supabase.com",
    )

    with pytest.raises(CommandError, match="live Supabase database targets"):
        assert_demo_environment_safe()
