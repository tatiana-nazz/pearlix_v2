from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("clinic", "0002_clinicsettings_weekly_closed_days")]
    operations = [migrations.RemoveField(model_name="clinicsettings", name="ai_service_url")]
