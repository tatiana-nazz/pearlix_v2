from django.db import migrations, models
import apps.xrays.models


def create_storage_state(apps, schema_editor):
    apps.get_model("xrays", "XrayStorageState").objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("xrays", "0002_xrayattachment_source_externalxraycase")]
    operations = [
        migrations.AlterField(
            model_name="externalxraycase",
            name="original_file",
            field=models.FileField(blank=True, upload_to=apps.xrays.models.external_xray_upload_path),
        ),
        migrations.AddField(model_name="externalxraycase", name="purge_after", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="externalxraycase", name="artifacts_purged_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="XrayStorageState",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="ImagingDeletionTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("storage_name", models.CharField(max_length=1024, unique=True)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("last_error", models.CharField(blank=True, max_length=255)),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.RunPython(create_storage_state, migrations.RunPython.noop),
    ]
