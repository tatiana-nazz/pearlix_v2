import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_requesters(apps, schema_editor):
    AIResult = apps.get_model("ai_results", "AIResult")
    for result in AIResult.objects.select_related(
        "xray_attachment",
        "external_xray_case",
    ).iterator():
        source = result.xray_attachment or result.external_xray_case
        result.requested_by_id = source.uploaded_by_id
        result.save(update_fields=["requested_by"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_auth_sessions_and_shared_throttles"),
        ("ai_results", "0004_phase4_ai_admission"),
    ]

    operations = [
        migrations.AddField(
            model_name="airesult",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="requested_ai_results",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_requesters, migrations.RunPython.noop),
        migrations.CreateModel(
            name="AIInvocationBucket",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "scope",
                    models.CharField(
                        choices=[("USER", "User"), ("CLINIC", "Clinic")],
                        max_length=20,
                    ),
                ),
                ("key", models.CharField(max_length=64)),
                ("request_count", models.PositiveIntegerField(default=0)),
                ("window_started_at", models.DateTimeField()),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("scope", "key"),
                        name="ai_invocation_bucket_scope_key_unique",
                    ),
                ],
            },
        ),
    ]
