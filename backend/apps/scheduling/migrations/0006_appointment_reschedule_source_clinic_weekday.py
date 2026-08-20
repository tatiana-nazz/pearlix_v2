from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0005_admin_shifts_availability"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="reschedule_source_clinic_weekday",
            field=models.PositiveSmallIntegerField(
                blank=True,
                choices=[
                    (0, "Monday"),
                    (1, "Tuesday"),
                    (2, "Wednesday"),
                    (3, "Thursday"),
                    (4, "Friday"),
                    (5, "Saturday"),
                    (6, "Sunday"),
                ],
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(
                fields=["reschedule_source_clinic_weekday", "status"],
                name="sched_appt_clday_stat_idx",
            ),
        ),
    ]
