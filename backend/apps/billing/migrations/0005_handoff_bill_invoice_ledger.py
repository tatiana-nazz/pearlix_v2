from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Count, Sum
from django.utils import timezone


ZERO = Decimal("0.00")


def _append_marker(current, marker):
    return "\n".join(part for part in ((current or "").strip(), marker.strip()) if part)


def migrate_financial_ledger(apps, schema_editor):
    Handoff = apps.get_model("billing", "BillingHandoff")
    Invoice = apps.get_model("billing", "Invoice")
    Payment = apps.get_model("billing", "Payment")
    now = timezone.now()

    # Normalize every legacy handoff first, including records that never became a debt-style invoice.
    for handoff in Handoff.objects.all().iterator():
        legacy_status = handoff.status
        handoff.description = (handoff.description or handoff.note or "Legacy financial obligation").strip()
        handoff.total_amount = handoff.suggested_amount or ZERO
        handoff.currency = handoff.currency or "SYP"
        handoff.origin = "LEGACY_MIGRATED"
        handoff.legacy_reference = _append_marker(
            handoff.legacy_reference,
            f"Migrated legacy BillingHandoff #{handoff.pk}; previous status={legacy_status}.",
        )
        if legacy_status == "DISMISSED" or handoff.total_amount <= ZERO:
            handoff.status = "CANCELLED"
            handoff.cancelled_at = now
            handoff.cancelled_reason = handoff.dismissed_reason or "Legacy handoff preserved without an actionable bill total."
        else:
            handoff.status = "OPEN"
        handoff.save(
            update_fields=[
                "description",
                "total_amount",
                "currency",
                "origin",
                "legacy_reference",
                "status",
                "cancelled_at",
                "cancelled_reason",
                "updated_at",
            ]
        )

    # Transform each debt-style invoice into a bill. Existing Payment rows become receipt Invoices.
    legacy_invoice_ids = list(Invoice.objects.order_by("id").values_list("id", flat=True))
    for invoice_id in legacy_invoice_ids:
        debt = Invoice.objects.get(pk=invoice_id)
        legacy_status = debt.status
        legacy_number = debt.invoice_number
        legacy_amount = debt.amount
        legacy_currency = debt.currency
        legacy_description = (debt.description or debt.notes or "Legacy financial obligation").strip()
        legacy_origin = debt.origin
        payments = list(Payment.objects.filter(invoice_id=debt.pk).order_by("payment_date", "id"))

        handoff = None
        if debt.billing_handoff_id:
            handoff = Handoff.objects.get(pk=debt.billing_handoff_id)
        elif debt.visit_id:
            handoff = Handoff.objects.filter(visit_id=debt.visit_id).order_by("id").first()

        if handoff is None:
            handoff = Handoff.objects.create(
                patient_id=debt.patient_id,
                visit_id=debt.visit_id,
                doctor_id=debt.visit.doctor_id if debt.visit_id else None,
                description=legacy_description,
                note=debt.notes,
                suggested_amount=legacy_amount,
                total_amount=legacy_amount,
                currency=legacy_currency,
                status="OPEN",
                origin="VISIT_COMPLETION" if legacy_origin == "VISIT_COMPLETION" else "MANUAL",
                legacy_reference=f"Created from legacy debt Invoice {legacy_number}.",
                created_by_id=debt.created_by_id,
                updated_by_id=debt.created_by_id,
            )

        handoff.description = legacy_description
        handoff.total_amount = legacy_amount
        handoff.currency = legacy_currency
        if legacy_origin == "VISIT_COMPLETION":
            handoff.origin = "VISIT_COMPLETION"
        elif legacy_origin == "MANUAL":
            handoff.origin = "MANUAL"
        else:
            handoff.origin = "LEGACY_MIGRATED"
        handoff.legacy_reference = _append_marker(
            handoff.legacy_reference,
            f"Legacy debt Invoice {legacy_number}; previous status={legacy_status}.",
        )

        paid_total = sum((payment.amount for payment in payments), ZERO)
        if paid_total > handoff.total_amount:
            handoff.total_amount = paid_total
            handoff.legacy_reference = _append_marker(
                handoff.legacy_reference,
                "Bill total raised to preserve legacy payments that exceeded the stored debt total.",
            )
        handoff.save(
            update_fields=[
                "description",
                "total_amount",
                "currency",
                "origin",
                "legacy_reference",
                "updated_at",
            ]
        )

        if payments:
            first_payment = payments[0]
            debt.billing_handoff_id = handoff.pk
            debt.amount = first_payment.amount
            debt.issued_at = first_payment.payment_date
            debt.notes = first_payment.notes
            debt.created_by_id = first_payment.created_by_id
            debt.save(
                update_fields=[
                    "billing_handoff",
                    "amount",
                    "issued_at",
                    "notes",
                    "created_by",
                    "updated_at",
                ]
            )
            for index, payment in enumerate(payments[1:], start=2):
                Invoice.objects.create(
                    invoice_number=f"MIG-{debt.pk}-{payment.pk}-{index}",
                    billing_handoff_id=handoff.pk,
                    amount=payment.amount,
                    issued_at=payment.payment_date,
                    notes=payment.notes,
                    created_by_id=payment.created_by_id,
                    patient_id=debt.patient_id,
                    appointment_id=debt.appointment_id,
                    visit_id=debt.visit_id,
                    origin=debt.origin,
                    description=debt.description,
                    currency=debt.currency,
                    status="PAID",
                    cancelled_at=None,
                    cancelled_reason="",
                )
            Payment.objects.filter(invoice_id=debt.pk).delete()
        elif legacy_status == "PAID":
            debt.billing_handoff_id = handoff.pk
            debt.amount = handoff.total_amount
            debt.issued_at = debt.created_at
            debt.notes = _append_marker(debt.notes, "Migrated paid legacy invoice without a separate Payment row.")
            debt.save(update_fields=["billing_handoff", "amount", "issued_at", "notes", "updated_at"])
            handoff.legacy_reference = _append_marker(
                handoff.legacy_reference,
                "A receipt was synthesized from the legacy PAID state because no Payment row existed.",
            )
            handoff.save(update_fields=["legacy_reference", "updated_at"])
        else:
            if legacy_status == "CANCELLED":
                handoff.cancelled_at = debt.cancelled_at or now
                handoff.cancelled_reason = debt.cancelled_reason or "Migrated cancelled legacy debt invoice."
                handoff.save(update_fields=["cancelled_at", "cancelled_reason", "updated_at"])
            debt.delete()

    # A Visit may have accumulated multiple historical provenance rows. Keep one canonical
    # Visit bill and preserve the others as explicitly detached legacy obligations.
    duplicate_visits = (
        Handoff.objects.exclude(visit_id=None)
        .values("visit_id")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )
    for row in duplicate_visits:
        candidates = list(Handoff.objects.filter(visit_id=row["visit_id"]).order_by("id"))
        candidates.sort(key=lambda item: (-Invoice.objects.filter(billing_handoff_id=item.pk).count(), item.pk))
        for duplicate in candidates[1:]:
            duplicate.legacy_reference = _append_marker(
                duplicate.legacy_reference,
                f"Detached from Visit #{row['visit_id']} during migration to enforce one bill per Visit.",
            )
            duplicate.visit_id = None
            duplicate.origin = "LEGACY_MIGRATED"
            duplicate.save(update_fields=["visit", "origin", "legacy_reference", "updated_at"])

    # Derive canonical bill state solely from receipt invoices.
    for handoff in Handoff.objects.all().iterator():
        paid = (
            Invoice.objects.filter(billing_handoff_id=handoff.pk).aggregate(total=Sum("amount"))["total"]
            or ZERO
        )
        if handoff.total_amount <= ZERO and paid > ZERO:
            handoff.total_amount = paid
        if handoff.cancelled_at and paid == ZERO:
            handoff.status = "CANCELLED"
        elif paid == ZERO:
            handoff.status = "OPEN"
        elif paid < handoff.total_amount:
            handoff.status = "PARTIALLY_PAID"
            handoff.cancelled_at = None
            handoff.cancelled_reason = ""
        else:
            handoff.status = "PAID"
            handoff.cancelled_at = None
            handoff.cancelled_reason = ""
        if handoff.total_amount <= ZERO:
            handoff.status = "CANCELLED"
            handoff.cancelled_at = handoff.cancelled_at or now
            handoff.cancelled_reason = handoff.cancelled_reason or "Legacy obligation had no recoverable positive total."
        handoff.save(
            update_fields=[
                "total_amount",
                "status",
                "cancelled_at",
                "cancelled_reason",
                "updated_at",
            ]
        )


class Migration(migrations.Migration):
    # PostgreSQL cannot drop the legacy circular foreign keys while the data
    # conversion has pending deferred trigger events in the same transaction.
    # Keep the data transform atomic, then commit before the schema cleanup.
    atomic = False
    dependencies = [("billing", "0004_invoice_description_origin_unique_visit")]

    operations = [
        migrations.RemoveConstraint(model_name="billinghandoff", name="unique_pending_billing_handoff_per_visit"),
        migrations.RemoveConstraint(model_name="invoice", name="unique_invoice_per_visit"),
        migrations.RemoveIndex(model_name="invoice", name="billing_inv_status_bfbaa4_idx"),
        migrations.RemoveIndex(model_name="invoice", name="billing_inv_patient_9fc9fa_idx"),
        migrations.RemoveIndex(model_name="invoice", name="billing_inv_visit_i_99ab6c_idx"),
        migrations.RemoveIndex(model_name="invoice", name="billing_inv_appoint_dbeae3_idx"),
        migrations.RemoveIndex(model_name="invoice", name="billing_inv_currenc_96f355_idx"),
        migrations.AddField(
            model_name="billinghandoff",
            name="total_amount",
            field=models.DecimalField(decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="billinghandoff",
            name="origin",
            field=models.CharField(
                choices=[
                    ("VISIT_COMPLETION", "Visit completion"),
                    ("MANUAL", "Manual"),
                    ("LEGACY_MIGRATED", "Legacy migrated"),
                ],
                default="MANUAL",
                max_length=30,
            ),
        ),
        migrations.AddField(model_name="billinghandoff", name="legacy_reference", field=models.TextField(blank=True)),
        migrations.AddField(model_name="billinghandoff", name="cancelled_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="billinghandoff", name="cancelled_reason", field=models.TextField(blank=True)),
        migrations.AlterField(
            model_name="billinghandoff",
            name="doctor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="billing_handoffs",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="billinghandoff",
            name="visit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="billing_handoffs",
                to="visits.visit",
            ),
        ),
        migrations.AlterField(
            model_name="invoice",
            name="billing_handoff",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="invoices",
                to="billing.billinghandoff",
            ),
        ),
        migrations.RenameField(model_name="invoice", old_name="total_amount", new_name="amount"),
        migrations.AddField(model_name="invoice", name="issued_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.RunPython(migrate_financial_ledger, migrations.RunPython.noop, atomic=True),
        migrations.DeleteModel(name="Payment"),
        migrations.RemoveField(model_name="billinghandoff", name="converted_invoice"),
        migrations.RemoveField(model_name="billinghandoff", name="dismissed_reason"),
        migrations.RemoveField(model_name="billinghandoff", name="suggested_amount"),
        migrations.RemoveField(model_name="invoice", name="appointment"),
        migrations.RemoveField(model_name="invoice", name="cancelled_at"),
        migrations.RemoveField(model_name="invoice", name="cancelled_reason"),
        migrations.RemoveField(model_name="invoice", name="currency"),
        migrations.RemoveField(model_name="invoice", name="description"),
        migrations.RemoveField(model_name="invoice", name="origin"),
        migrations.RemoveField(model_name="invoice", name="patient"),
        migrations.RemoveField(model_name="invoice", name="status"),
        migrations.RemoveField(model_name="invoice", name="visit"),
        migrations.AlterField(
            model_name="billinghandoff",
            name="currency",
            field=models.CharField(
                choices=[("SYP", "Syrian Pound"), ("USD", "US Dollar")],
                max_length=3,
            ),
        ),
        migrations.AlterField(model_name="billinghandoff", name="description", field=models.TextField()),
        migrations.AlterField(
            model_name="billinghandoff",
            name="status",
            field=models.CharField(
                choices=[
                    ("OPEN", "Open"),
                    ("PARTIALLY_PAID", "Partially paid"),
                    ("PAID", "Paid"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="OPEN",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="billinghandoff",
            name="total_amount",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name="invoice",
            name="billing_handoff",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="invoices",
                to="billing.billinghandoff",
            ),
        ),
        migrations.AlterField(model_name="invoice", name="issued_at", field=models.DateTimeField()),
        migrations.AlterModelOptions(name="invoice", options={"ordering": ["-issued_at", "-id"]}),
        migrations.AddIndex(
            model_name="billinghandoff",
            index=models.Index(fields=["currency"], name="billing_bil_currency_idx"),
        ),
        migrations.AddIndex(
            model_name="invoice",
            index=models.Index(fields=["billing_handoff", "issued_at"], name="billing_inv_handoff_issued_idx"),
        ),
        migrations.AddIndex(
            model_name="invoice",
            index=models.Index(fields=["issued_at"], name="billing_inv_issued_idx"),
        ),
        migrations.AddIndex(
            model_name="invoice",
            index=models.Index(fields=["created_by", "created_at"], name="billing_inv_creator_idx"),
        ),
        migrations.AddConstraint(
            model_name="billinghandoff",
            constraint=models.UniqueConstraint(
                condition=models.Q(("visit__isnull", False)),
                fields=("visit",),
                name="unique_billing_handoff_per_visit",
            ),
        ),
    ]
