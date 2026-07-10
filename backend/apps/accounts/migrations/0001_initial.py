import apps.accounts.models
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.", verbose_name="superuser status")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("full_name", models.CharField(max_length=255)),
                ("role", models.CharField(choices=[("ADMIN", "Admin"), ("STAFF", "Staff"), ("DOCTOR", "Doctor")], max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("is_staff", models.BooleanField(default=False)),
                ("theme_preference", models.CharField(choices=[("LIGHT", "Light"), ("DARK", "Dark"), ("SYSTEM", "System")], default="SYSTEM", max_length=20)),
                ("language_preference", models.CharField(choices=[("EN", "English"), ("AR", "Arabic")], default="EN", max_length=10)),
                ("groups", models.ManyToManyField(blank=True, help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.", related_name="user_set", related_query_name="user", to="auth.group", verbose_name="groups")),
                ("user_permissions", models.ManyToManyField(blank=True, help_text="Specific permissions for this user.", related_name="user_set", related_query_name="user", to="auth.permission", verbose_name="user permissions")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["email"], name="accounts_us_email_74c8d6_idx"),
                    models.Index(fields=["role"], name="accounts_us_role_1fa9a5_idx"),
                ],
            },
            managers=[
                ("objects", apps.accounts.models.UserManager()),
            ],
        ),
    ]
