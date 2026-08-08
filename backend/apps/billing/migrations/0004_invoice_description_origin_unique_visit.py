from django.db import migrations, models
from django.db.models import Q


def populate_invoice_descriptions(apps, schema_editor):
    Invoice = apps.get_model("billing", "Invoice")
    for invoice in Invoice.objects.select_related("billing_handoff").all().iterator():
        handoff = invoice.billing_handoff
        description = ""
        if handoff is not None:
            description = (handoff.description or "").strip()
        if not description:
            description = (invoice.notes or "").strip()
        if not description:
            description = "Dental services"
        invoice.description = description
        invoice.origin = "LEGACY_HANDOFF" if invoice.billing_handoff_id else "MANUAL"
        invoice.save(update_fields=["description", "origin"])


class Migration(migrations.Migration):
    dependencies = [("billing", "0003_billinghandoff_description")]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="description",
            field=models.TextField(default="Dental services"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="invoice",
            name="origin",
            field=models.CharField(
                choices=[
                    ("MANUAL", "Manual"),
                    ("VISIT_COMPLETION", "Visit completion"),
                    ("LEGACY_HANDOFF", "Legacy handoff"),
                ],
                default="MANUAL",
                max_length=30,
            ),
        ),
        migrations.RunPython(populate_invoice_descriptions, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="invoice",
            constraint=models.UniqueConstraint(
                fields=("visit",),
                condition=Q(visit__isnull=False),
                name="unique_invoice_per_visit",
            ),
        ),
    ]
