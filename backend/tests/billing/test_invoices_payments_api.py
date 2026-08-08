from decimal import Decimal

import pytest

from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice


@pytest.mark.django_db
def test_invoice_is_read_only_receipt_resource(admin_client, staff_client, doctor_client, invoice_factory):
    invoice = invoice_factory()
    assert admin_client.get(f"/api/invoices/{invoice.id}/").status_code == 200
    assert staff_client.get(f"/api/invoices/{invoice.id}/").status_code == 200
    assert doctor_client.get(f"/api/invoices/{invoice.id}/").status_code == 403
    assert staff_client.post("/api/invoices/", {"amount": "10.00"}, format="json").status_code in {403, 405}
    assert staff_client.patch(f"/api/invoices/{invoice.id}/", {"amount": "5.00"}, format="json").status_code in {403, 405}
    assert staff_client.get(f"/api/invoices/{invoice.id}/payments/").status_code == 404


@pytest.mark.django_db
def test_staff_partial_and_final_payments_create_multiple_invoices(staff_client, billing_handoff_factory):
    handoff = billing_handoff_factory(total_amount="300.00", currency="SYP")
    first = staff_client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "100.00", "notes": "Deposit"}, format="json")
    assert first.status_code == 201
    assert first.data["invoice"]["patient"]["id"] == handoff.patient_id
    assert first.data["invoice"]["currency"] == "SYP"
    assert first.data["handoff"]["status"] == BillingHandoff.Status.PARTIALLY_PAID
    assert first.data["handoff"]["paid_amount"] == "100.00"
    assert first.data["handoff"]["remaining_amount"] == "200.00"

    second = staff_client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "200.00", "notes": "Balance"}, format="json")
    assert second.status_code == 201
    assert second.data["handoff"]["status"] == BillingHandoff.Status.PAID
    assert second.data["handoff"]["paid_amount"] == "300.00"
    assert second.data["handoff"]["remaining_amount"] == "0.00"
    assert second.data["handoff"]["invoice_count"] == 2
    assert Invoice.objects.filter(billing_handoff=handoff).count() == 2
    assert sum(Invoice.objects.filter(billing_handoff=handoff).values_list("amount", flat=True), Decimal("0.00")) == Decimal("300.00")


@pytest.mark.django_db
def test_overpayment_and_payments_on_closed_bills_are_rejected(staff_client, billing_handoff_factory):
    handoff = billing_handoff_factory(total_amount="50.00")
    over = staff_client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "50.01"}, format="json")
    assert over.status_code == 400
    assert over.data["code"] == "OVERPAYMENT_NOT_ALLOWED"
    assert Invoice.objects.filter(billing_handoff=handoff).count() == 0
    cancelled = billing_handoff_factory(status=BillingHandoff.Status.CANCELLED, cancelled_at="2026-08-08T09:00:00Z")
    assert staff_client.post(f"/api/billing-handoffs/{cancelled.id}/invoices/", {"amount": "1.00"}, format="json").status_code == 409


@pytest.mark.django_db
def test_only_staff_can_issue_invoice(admin_client, doctor_client, staff_client, billing_handoff_factory):
    for client in (admin_client, doctor_client):
        handoff = billing_handoff_factory()
        response = client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "10.00"}, format="json")
        assert response.status_code == 403
        assert not Invoice.objects.filter(billing_handoff=handoff).exists()
    staff_handoff = billing_handoff_factory()
    assert staff_client.post(f"/api/billing-handoffs/{staff_handoff.id}/invoices/", {"amount": "10.00"}, format="json").status_code == 201


@pytest.mark.django_db
def test_invoice_context_is_inherited_and_conflicting_payload_is_rejected(staff_client, billing_handoff_factory, patient_factory):
    handoff = billing_handoff_factory(total_amount="100.00", currency="USD", description="Root canal")
    other = patient_factory(national_id_or_passport="INVOICE-OTHER")
    response = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {"amount": "25.00", "patient_id": other.id, "currency": "SYP", "description": "Wrong"},
        format="json",
    )
    assert response.status_code == 400
    assert set(response.data["details"]) == {"patient_id", "currency", "description"}
    assert Invoice.objects.filter(billing_handoff=handoff).count() == 0


@pytest.mark.django_db
def test_invoice_number_audit_and_print_data(staff_client, billing_handoff_factory, staff_user):
    handoff = billing_handoff_factory(total_amount="80.00", currency="USD")
    response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "30.00", "notes": "Card"}, format="json")
    invoice_id = response.data["invoice"]["id"]
    invoice = Invoice.objects.get(pk=invoice_id)
    assert invoice.invoice_number.startswith("INV-")
    assert invoice.patient_id == handoff.patient_id
    assert invoice.currency == handoff.currency
    assert ActivityLog.objects.filter(action="invoice_issued", entity_id=str(invoice_id)).exists()
    printed = staff_client.get(f"/api/invoices/{invoice_id}/print-data/")
    assert printed.status_code == 200
    assert printed.data["invoice"]["amount"] == Decimal("30.00")
    assert printed.data["handoff"]["id"] == handoff.id
    assert printed.data["handoff"]["remaining_amount"] == Decimal("50.00")
