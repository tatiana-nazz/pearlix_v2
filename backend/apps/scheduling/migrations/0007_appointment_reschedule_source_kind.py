from django.db import migrations, models


def backfill_reschedule_source_kind(apps, schema_editor):
    Appointment = apps.get_model("scheduling", "Appointment")
    Appointment.objects.filter(
        reschedule_source_clinic_weekday__isnull=False,
    ).update(reschedule_source_kind="CLINIC_WEEKLY_CLOSURE")
    Appointment.objects.filter(
        reschedule_source_kind__isnull=True,
        reschedule_source_exception__isnull=False,
    ).update(reschedule_source_kind="LEAVE")
    Appointment.objects.filter(
        reschedule_source_kind__isnull=True,
        reschedule_source_working_shift__isnull=False,
    ).update(reschedule_source_kind="WORKING_SCHEDULE_CHANGE")


class Migration(migrations.Migration):
    dependencies = [
        ("scheduling", "0006_appointment_reschedule_source_clinic_weekday"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="version",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="appointment",
            name="reschedule_source_kind",
            field=models.CharField(
                blank=True,
                choices=[
                    ("LEAVE", "Leave"),
                    ("WORKING_SCHEDULE_CHANGE", "Working schedule change"),
                    ("CLINIC_WEEKLY_CLOSURE", "Clinic weekly closure"),
                    ("SCHEDULING_RULE_CONFLICT", "Scheduling rule conflict"),
                ],
                max_length=40,
                null=True,
            ),
        ),
        migrations.RunPython(
            backfill_reschedule_source_kind,
            migrations.RunPython.noop,
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(
                fields=["reschedule_source_kind", "status"],
                name="sched_appt_rskind_stat_idx",
            ),
        ),
    ]
