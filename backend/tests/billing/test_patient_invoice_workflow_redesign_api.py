from decimal import Decimal

import pytest

from apps.billing.models import Invoice


@pytest.mark.django_db
def test_patient_filter_and_summary_are_scoped_to_exact_patient(
    staff_client,
    patient,
    patient_factory,
    invoice_factory,
):
    other_patient = patient_factory(first_name="Other", last_name="Patient")
    first = invoice_factory(patient=patient, description="Patient one treatment", total_amount="125.00")
    invoice_factory(patient=other_patient, invoice_number="INV-OTHER-000001", description="Other treatment", total_amount="900.00")

    list_response = staff_client.get(f"/api/invoices/?patient_id={patient.id}")
    summary_response = staff_client.get(f"/api/invoices/summary/?patient_id={patient.id}")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data["results"]] == [first.id]
    assert list_response.data["results"][0]["description"] == "Patient one treatment"
    assert summary_response.status_code == 200
    assert summary_response.data["invoice_count"] == 1
    assert summary_response.data["open_invoice_count"] == 1
    assert summary_response.data["currency_totals"]["SYP"]["outstanding"] == Decimal("125.00")


@pytest.mark.django_db
def test_payment_transitions_and_non_financial_edit_policy(staff_client, invoice_factory):
    invoice = invoice_factory(description="Original service", total_amount="100.00", currency=Invoice.Currency.USD)
    partial = staff_client.post(
        f"/api/invoices/{invoice.id}/payments/",
        {"amount": "40.00", "currency": "USD", "notes": "Deposit"},
        format="json",
    )
    assert partial.status_code == 201
    assert partial.data["invoice"]["status"] == Invoice.Status.PARTIALLY_PAID

    financial_edit = staff_client.patch(f"/api/invoices/{invoice.id}/", {"total_amount": "110.00"}, format="json")
    description_edit = staff_client.patch(
        f"/api/invoices/{invoice.id}/",
        {"description": "Updated service description", "notes": "Updated note"},
        format="json",
    )
    assert financial_edit.status_code == 409
    assert description_edit.status_code == 200
    assert description_edit.data["description"] == "Updated service description"

    final = staff_client.post(
        f"/api/invoices/{invoice.id}/payments/",
        {"amount": "60.00", "currency": "USD"},
        format="json",
    )
    assert final.status_code == 201
    assert final.data["invoice"]["status"] == Invoice.Status.PAID
    assert final.data["invoice"]["remaining_amount"] == "0.00"


@pytest.mark.django_db
def test_print_data_has_description_patient_source_and_financial_record(
    staff_client,
    invoice_factory,
    completed_visit,
):
    invoice = invoice_factory(
        patient=completed_visit.patient,
        visit=completed_visit,
        appointment=completed_visit.appointment,
        description="Completed visit treatment",
        total_amount="75.00",
    )
    response = staff_client.get(f"/api/invoices/{invoice.id}/print-data/")
    assert response.status_code == 200
    assert response.data["description"] == "Completed visit treatment"
    assert response.data["patient"]["id"] == completed_visit.patient_id
    assert response.data["visit"]["id"] == completed_visit.id
    assert response.data["appointment"]["id"] == completed_visit.appointment_id
    assert response.data["total_amount"] == Decimal("75.00")
    assert response.data["paid_amount"] == Decimal("0.00")
    assert response.data["remaining_amount"] == Decimal("75.00")
