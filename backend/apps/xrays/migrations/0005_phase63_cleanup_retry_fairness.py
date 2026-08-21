from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("xrays", "0004_imagingdeletiontask_quota_attribution")]

    operations = [
        migrations.AddField(model_name="externalxraycase", name="purge_attempts", field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name="externalxraycase", name="purge_last_error", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="externalxraycase", name="purge_last_attempt_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="externalxraycase", name="purge_next_attempt_at", field=models.DateTimeField(blank=True, db_index=True, null=True)),
        migrations.AddField(model_name="imagingdeletiontask", name="last_attempt_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="imagingdeletiontask", name="next_attempt_at", field=models.DateTimeField(blank=True, db_index=True, null=True)),
    ]
