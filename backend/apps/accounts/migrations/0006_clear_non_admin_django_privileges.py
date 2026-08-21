from django.db import migrations, models


def clear_non_admin_django_privileges(apps, schema_editor):
    user_model = apps.get_model("accounts", "User")
    user_model.objects.exclude(role="ADMIN").update(is_staff=False, is_superuser=False)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_doctorprofile_version_staffprofile_version_and_more"),
    ]

    operations = [
        migrations.RunPython(clear_non_admin_django_privileges, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(role="ADMIN")
                | models.Q(is_staff=False, is_superuser=False),
                name="accounts_non_admin_no_django_privilege",
            ),
        ),
    ]
