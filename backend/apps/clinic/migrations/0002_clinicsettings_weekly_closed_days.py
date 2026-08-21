import apps.clinic.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="clinicsettings",
            name="weekly_closed_days",
            field=models.JSONField(blank=True, default=apps.clinic.models.default_weekly_closed_days),
        ),
    ]
