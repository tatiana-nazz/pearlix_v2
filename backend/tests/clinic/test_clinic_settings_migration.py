import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


pytestmark = pytest.mark.django_db(transaction=True)


def targets(clinic_target):
    executor = MigrationExecutor(connection)
    return [
        node
        for node in executor.loader.graph.leaf_nodes()
        if node[0] != "clinic"
    ] + [clinic_target]


def migrate(target):
    executor = MigrationExecutor(connection)
    executor.migrate(target)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(target).apps


def test_weekly_closed_days_migration_defaults_existing_settings_to_friday():
    before = targets(("clinic", "0001_initial"))
    after = targets(("clinic", "0002_clinicsettings_weekly_closed_days"))
    apps = migrate(before)
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")
    settings = ClinicSettings.objects.create(clinic_name="Existing clinic")

    apps = migrate(after)
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")

    assert ClinicSettings.objects.get(pk=settings.pk).weekly_closed_days == [4]
    # Leave the shared migration database at the current clinic leaf so later
    # historical migration tests never receive a mixed forward/backward plan.
    migrate(targets(("clinic", "0003_remove_clinicsettings_ai_service_url")))
