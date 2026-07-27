from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("billing", "0002_invoicesequence")]

    operations = [
        migrations.AddField(
            model_name="billinghandoff",
            name="description",
            field=models.TextField(blank=True),
        ),
    ]
