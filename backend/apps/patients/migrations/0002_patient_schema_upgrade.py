from django.db import migrations, models


def migrate_patient_schema(apps, schema_editor):
    Patient = apps.get_model("patients", "Patient")

    unsafe_patients = list(
        Patient.objects.exclude(gender__in=["MALE", "Male", "FEMALE", "Female"]).values_list("id", "gender")
    )
    if unsafe_patients:
        formatted = ", ".join(f"id={patient_id} gender={gender}" for patient_id, gender in unsafe_patients)
        raise RuntimeError(
            "Patient gender migration blocked. Resolve OTHER/UNSPECIFIED/unsafe gender values before applying "
            f"patients.0002_patient_schema_upgrade. Affected patients: {formatted}"
        )

    gender_map = {
        "MALE": "Male",
        "Male": "Male",
        "FEMALE": "Female",
        "Female": "Female",
    }
    for patient in Patient.objects.all().iterator():
        patient.first_name = (patient.full_name or "").strip()
        patient.last_name = ""
        patient.gender = gender_map[patient.gender]
        patient.date_of_birth = patient.birth_date
        patient.phone_number = patient.phone
        patient.medical_conditions_history = patient.medical_summary
        patient.national_id_or_passport = None
        patient.version = patient.version or 1
        patient.save(
            update_fields=[
                "first_name",
                "last_name",
                "gender",
                "date_of_birth",
                "phone_number",
                "medical_conditions_history",
                "national_id_or_passport",
                "version",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="first_name",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="patient",
            name="last_name",
            field=models.CharField(blank=True, default="", max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="patient",
            name="date_of_birth",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="phone_number",
            field=models.CharField(blank=True, default="", max_length=50),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="patient",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="patient",
            name="national_id_or_passport",
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="emergency_contact",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="patient",
            name="blood_group",
            field=models.CharField(
                blank=True,
                choices=[
                    ("A+", "A+"),
                    ("A-", "A-"),
                    ("B+", "B+"),
                    ("B-", "B-"),
                    ("AB+", "AB+"),
                    ("AB-", "AB-"),
                    ("O+", "O+"),
                    ("O-", "O-"),
                ],
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="medical_conditions_history",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="insurance_info",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="version",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.RunPython(migrate_patient_schema, migrations.RunPython.noop),
        migrations.RemoveIndex(
            model_name="patient",
            name="patients_pa_phone_fc49bb_idx",
        ),
        migrations.RemoveIndex(
            model_name="patient",
            name="patients_pa_full_na_b75abe_idx",
        ),
        migrations.RemoveField(
            model_name="patient",
            name="birth_date",
        ),
        migrations.RemoveField(
            model_name="patient",
            name="full_name",
        ),
        migrations.RemoveField(
            model_name="patient",
            name="medical_summary",
        ),
        migrations.RemoveField(
            model_name="patient",
            name="phone",
        ),
        migrations.AlterField(
            model_name="patient",
            name="address",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="patient",
            name="gender",
            field=models.CharField(choices=[("Male", "Male"), ("Female", "Female")], max_length=10),
        ),
        migrations.AlterModelOptions(
            name="patient",
            options={"ordering": ["first_name", "last_name", "id"]},
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["first_name", "last_name"], name="patients_pa_first_n_a142c0_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["phone_number"], name="patients_pa_phone_n_933975_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["email"], name="patients_pa_email_bb026d_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["national_id_or_passport"], name="patients_pa_nationa_72e44c_idx"),
        ),
    ]
