from django.db import migrations, models


def create_account_security_state(apps, schema_editor):
    state_model = apps.get_model("accounts", "AccountSecurityState")
    state_model.objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_clear_non_admin_django_privileges"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountSecurityState",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
            ],
            options={
                "verbose_name": "account security state",
            },
        ),
        migrations.RunPython(
            create_account_security_state,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
