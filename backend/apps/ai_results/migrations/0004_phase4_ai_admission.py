from django.db import migrations, models


def create_execution_state(apps, schema_editor):
    apps.get_model("ai_results", "AIExecutionState").objects.get_or_create(pk=1)


def estimate_existing_overlay_sizes(apps, schema_editor):
    AIResult = apps.get_model("ai_results", "AIResult")
    for result in AIResult.objects.exclude(overlay_file="").iterator():
        source = result.xray_attachment if result.xray_attachment_id else result.external_xray_case
        result.overlay_size_bytes = int(source.size_bytes or 0)
        result.save(update_fields=["overlay_size_bytes"])


class Migration(migrations.Migration):
    dependencies = [
        ("xrays", "0003_phase4_storage_policy"),
        ("ai_results", "0003_airesult_external_xray_case_and_more"),
    ]
    operations = [
        migrations.AddField(model_name="airesult", name="overlay_size_bytes", field=models.PositiveIntegerField(default=0)),
        migrations.RunPython(estimate_existing_overlay_sizes, migrations.RunPython.noop),
        migrations.CreateModel(
            name="AIExecutionState",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.RunPython(create_execution_state, migrations.RunPython.noop),
    ]
