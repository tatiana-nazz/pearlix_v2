import uuid

import django.db.models.deletion
from django.db import migrations, models


THROTTLE_LOCK_SHARDS = 64


def create_throttle_locks(apps, schema_editor):
    lock_model = apps.get_model("accounts", "AuthenticationThrottleLock")
    lock_model.objects.bulk_create(
        [lock_model(id=shard) for shard in range(THROTTLE_LOCK_SHARDS)],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_accountsecuritystate"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuthenticationThrottleLock",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("next_cleanup_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name="AuthenticationThrottleBucket",
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
                ("scope", models.CharField(max_length=64)),
                ("key_digest", models.CharField(max_length=64)),
                ("request_count", models.PositiveIntegerField(default=1)),
                ("window_started_at", models.DateTimeField()),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("scope", "key_digest"),
                        name="accounts_auth_throttle_scope_key_unique",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("request_count__gte", 1)),
                        name="accounts_auth_throttle_count_positive",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="AuthSession",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("account_version", models.PositiveIntegerField()),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("revoked_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="auth_sessions",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["user", "revoked_at", "expires_at"],
                        name="accounts_as_user_rev_exp_idx",
                    ),
                ],
            },
        ),
        migrations.RunPython(
            create_throttle_locks,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
