from decimal import Decimal

import pytest

from apps.billing.models import BillingHandoff


@pytest.mark.django_db
def test_patient_filters_scope_handoffs_and_receipt_invoices_to_exact_patient(
    staff_client, patient, patient_factory, billing_handoff_factory, invoice_factory
):
    other = patient_factory(first_name="Other", last_name="Patient", national_id_or_passport="BILL-OTHER")
    target_bill = billing_handoff_factory(patient=patient, total_amount="125.00", currency="USD", description="Patient one treatment")
    target_invoice = invoice_factory(billing_handoff=target_bill, amount="25.00")
    other_bill = billing_handoff_factory(patient=other, total_amount="900.00")
    invoice_factory(billing_handoff=other_bill, invoice_number="INV-OTHER-000001")

    bills = staff_client.get(f"/api/billing-handoffs/?patient_id={patient.id}")
    bill_summary = staff_client.get(f"/api/billing-handoffs/summary/?patient_id={patient.id}")
    invoices = staff_client.get(f"/api/invoices/?patient_id={patient.id}")
    invoice_summary = staff_client.get(f"/api/invoices/summary/?patient_id={patient.id}")

    assert [item["id"] for item in bills.data["results"]] == [target_bill.id]
    assert bill_summary.data["currency_totals"]["USD"]["outstanding"] == Decimal("100.00")
    assert [item["id"] for item in invoices.data["results"]] == [target_invoice.id]
    assert invoice_summary.data["invoice_count"] == 1
    assert invoice_summary.data["collected_by_currency"]["USD"] == Decimal("25.00")


@pytest.mark.django_db
def test_cross_patient_invoice_association_is_impossible_by_derivation(billing_handoff_factory, invoice_factory, patient_factory):
    bill = billing_handoff_factory()
    receipt = invoice_factory(billing_handoff=bill)
    other = patient_factory(first_name="Cross", last_name="Patient", national_id_or_passport="CROSS-PATIENT")
    assert receipt.patient_id == bill.patient_id
    assert receipt.patient_id != other.id
    assert not hasattr(receipt, "patient_id") or receipt.patient_id == receipt.billing_handoff.patient_id
    assert BillingHandoff.objects.filter(pk=bill.pk, patient=bill.patient).exists()


@pytest.mark.django_db
def test_print_data_contains_one_payment_and_current_bill_context(staff_client, billing_handoff_factory, invoice_factory, completed_visit):
    bill = billing_handoff_factory(
        patient=completed_visit.patient,
        visit=completed_visit,
        doctor=completed_visit.doctor,
        description="Completed visit treatment",
        total_amount="75.00",
        origin=BillingHandoff.Origin.VISIT_COMPLETION,
    )
    receipt = invoice_factory(billing_handoff=bill, amount="25.00")
    response = staff_client.get(f"/api/invoices/{receipt.id}/print-data/")
    assert response.status_code == 200
    assert response.data["invoice"]["amount"] == Decimal("25.00")
    assert response.data["patient"]["id"] == completed_visit.patient_id
    assert response.data["visit"]["id"] == completed_visit.id
    assert response.data["appointment"]["id"] == completed_visit.appointment_id
    assert response.data["handoff"]["total_amount"] == Decimal("75.00")
    assert response.data["handoff"]["paid_amount"] == Decimal("25.00")
    assert response.data["handoff"]["remaining_amount"] == Decimal("50.00")
