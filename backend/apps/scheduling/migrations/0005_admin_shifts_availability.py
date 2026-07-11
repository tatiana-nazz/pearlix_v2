from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def copy_working_hours(apps, schema_editor):
    WorkingHour = apps.get_model("scheduling", "WorkingHour")
    WorkingShift = apps.get_model("scheduling", "WorkingShift")
    for row in WorkingHour.objects.order_by("id"):
        WorkingShift.objects.create(
            employee_id=row.doctor_id,
            name="Existing Shift",
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            is_active=row.is_active,
            version=1,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0002_patient_schema_upgrade"),
        ("scheduling", "0004_appointment_reschedule_previous_status_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ClinicDefaultShift",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=100)),
                ("weekday", models.PositiveSmallIntegerField(choices=[(0, "Monday"), (1, "Tuesday"), (2, "Wednesday"), (3, "Thursday"), (4, "Friday"), (5, "Saturday"), (6, "Sunday")])),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("is_active", models.BooleanField(default=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="default_shifts_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="default_shifts_updated", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["weekday", "start_time", "id"]},
        ),
        migrations.CreateModel(
            name="WorkingShift",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=100)),
                ("weekday", models.PositiveSmallIntegerField(choices=[(0, "Monday"), (1, "Tuesday"), (2, "Wednesday"), (3, "Thursday"), (4, "Friday"), (5, "Saturday"), (6, "Sunday")])),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("is_active", models.BooleanField(default=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="working_shifts_created", to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="working_shifts", to=settings.AUTH_USER_MODEL)),
                ("source_default_shift", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="applied_working_shifts", to="scheduling.clinicdefaultshift")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="working_shifts_updated", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["weekday", "start_time", "id"]},
        ),
        migrations.AddField(model_name="availabilityexception", name="version", field=models.PositiveIntegerField(default=1)),
        migrations.AddField(model_name="appointment", name="reschedule_source_working_shift", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reschedule_appointments", to="scheduling.workingshift")),
        migrations.RunPython(copy_working_hours, migrations.RunPython.noop),
        migrations.AddIndex(model_name="appointment", index=models.Index(fields=["reschedule_source_working_shift", "status"], name="scheduling__resched_983f5b_idx")),
        migrations.AddIndex(model_name="clinicdefaultshift", index=models.Index(fields=["weekday", "is_active"], name="scheduling__weekday_9119de_idx")),
        migrations.AddIndex(model_name="workingshift", index=models.Index(fields=["employee", "weekday", "is_active"], name="scheduling__employe_2fef81_idx")),
        migrations.RemoveIndex(model_name="workinghour", name="scheduling__doctor__09e215_idx"),
        migrations.DeleteModel(name="WorkingHour"),
    ]
