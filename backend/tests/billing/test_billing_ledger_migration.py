from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.models import Sum
from django.utils import timezone


pytestmark = pytest.mark.django_db(transaction=True)


def targets_with_billing(target):
    executor = MigrationExecutor(connection)
    return [node for node in executor.loader.graph.leaf_nodes() if node[0] != "billing"] + [target]


def migrate_to(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(targets).apps


def test_ledger_migration_preserves_non_demo_debt_and_payment_history():
    before = targets_with_billing(("billing", "0004_invoice_description_origin_unique_visit"))
    after = targets_with_billing(("billing", "0005_handoff_bill_invoice_ledger"))
    apps = migrate_to(before)
    User = apps.get_model("accounts", "User")
    Patient = apps.get_model("patients", "Patient")
    Appointment = apps.get_model("scheduling", "Appointment")
    Visit = apps.get_model("visits", "Visit")
    Handoff = apps.get_model("billing", "BillingHandoff")
    Invoice = apps.get_model("billing", "Invoice")
    Payment = apps.get_model("billing", "Payment")

    staff = User.objects.create(email="migration-staff@example.com", full_name="Migration Staff", role="STAFF", is_active=True)
    doctor = User.objects.create(email="migration-doctor@example.com", full_name="Migration Doctor", role="DOCTOR", is_active=True)
    patient = Patient.objects.create(first_name="Non-demo", last_name="Ledger", gender="Female", national_id_or_passport="NON-DEMO-LEDGER", created_by=staff, updated_by=staff)
    appointment = Appointment.objects.create(patient=patient, doctor=doctor, start_datetime=timezone.now(), end_datetime=timezone.now() + timezone.timedelta(minutes=30), duration_minutes=30, status="COMPLETED", created_by=staff, updated_by=staff)
    visit = Visit.objects.create(appointment=appointment, patient=patient, doctor=doctor, status="COMPLETED", started_at=timezone.now() - timezone.timedelta(hours=1), completed_at=timezone.now(), created_by=doctor, updated_by=doctor)
    provenance = Handoff.objects.create(patient=patient, visit=visit, doctor=doctor, description="Legacy root canal", note="Preserve bill", suggested_amount="300.00", currency="USD", status="CONVERTED_TO_INVOICE", created_by=doctor, updated_by=doctor)
    debt = Invoice.objects.create(invoice_number="LEGACY-DEBT-001", patient=patient, appointment=appointment, visit=visit, billing_handoff=provenance, description="Legacy root canal", origin="VISIT_COMPLETION", currency="USD", total_amount="300.00", notes="Legacy debt", status="PARTIALLY_PAID", created_by=staff)
    Payment.objects.create(invoice=debt, amount="100.00", currency="USD", payment_date=timezone.now() - timezone.timedelta(days=2), notes="First legacy payment", created_by=staff)
    Payment.objects.create(invoice=debt, amount="75.00", currency="USD", payment_date=timezone.now() - timezone.timedelta(days=1), notes="Second legacy payment", created_by=staff)

    manual_debt = Invoice.objects.create(invoice_number="LEGACY-MANUAL-001", patient=patient, description="Legacy manual bill", origin="MANUAL", currency="SYP", total_amount="90000.00", notes="No payments yet", status="UNPAID", created_by=staff)
    ids = {"patient": patient.id, "visit": visit.id, "provenance": provenance.id, "manual_debt": manual_debt.id}

    apps = migrate_to(after)
    Handoff = apps.get_model("billing", "BillingHandoff")
    Invoice = apps.get_model("billing", "Invoice")
    migrated = Handoff.objects.get(pk=ids["provenance"])
    receipts = Invoice.objects.filter(billing_handoff_id=migrated.id)
    assert migrated.patient_id == ids["patient"]
    assert migrated.visit_id == ids["visit"]
    assert migrated.total_amount == Decimal("300.00")
    assert migrated.status == "PARTIALLY_PAID"
    assert receipts.count() == 2
    assert receipts.aggregate(total=Sum("amount"))["total"] == Decimal("175.00")
    assert set(receipts.values_list("notes", flat=True)) == {"First legacy payment", "Second legacy payment"}
    manual = Handoff.objects.get(patient_id=ids["patient"], description="Legacy manual bill")
    assert manual.visit_id is None
    assert manual.total_amount == Decimal("90000.00")
    assert manual.status == "OPEN"
    assert not Invoice.objects.filter(billing_handoff_id=manual.id).exists()
    assert "Legacy debt Invoice" in migrated.legacy_reference
    with pytest.raises(LookupError):
        apps.get_model("billing", "Payment")
