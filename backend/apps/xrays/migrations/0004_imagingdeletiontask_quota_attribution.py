from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("xrays", "0003_phase4_storage_policy")]

    operations = [
        migrations.AddField(
            model_name="imagingdeletiontask",
            name="patient_id",
            field=models.PositiveBigIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="imagingdeletiontask",
            name="size_bytes",
            field=models.PositiveBigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="imagingdeletiontask",
            name="uploader_id",
            field=models.PositiveBigIntegerField(blank=True, db_index=True, null=True),
        ),
    ]
