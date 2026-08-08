from decimal import Decimal

import pytest

from apps.billing.models import BillingHandoff, Invoice


@pytest.mark.django_db
def test_handoff_endpoints_require_authentication(api_client, billing_handoff_factory):
    handoff = billing_handoff_factory()
    assert api_client.get("/api/billing-handoffs/").status_code == 401
    assert api_client.get(f"/api/billing-handoffs/{handoff.id}/").status_code == 401
    assert api_client.post(f"/api/billing-handoffs/{handoff.id}/invoices/", {"amount": "1.00"}, format="json").status_code == 401


@pytest.mark.django_db
def test_staff_creates_manual_open_bill_with_no_invoice(staff_client, patient):
    response = staff_client.post(
        "/api/billing-handoffs/",
        {"patient_id": patient.id, "description": "Manual restorative bill", "total_amount": "300.00", "currency": "USD", "note": "Reception"},
        format="json",
    )
    assert response.status_code == 201
    handoff = BillingHandoff.objects.get(pk=response.data["id"])
    assert handoff.patient_id == patient.id
    assert handoff.visit_id is None
    assert handoff.status == BillingHandoff.Status.OPEN
    assert handoff.origin == BillingHandoff.Origin.MANUAL
    assert response.data["paid_amount"] == "0.00"
    assert response.data["remaining_amount"] == "300.00"
    assert response.data["invoice_count"] == 0
    assert Invoice.objects.filter(billing_handoff=handoff).count() == 0


@pytest.mark.django_db
def test_only_staff_can_create_manual_bill(admin_client, doctor_client, patient):
    payload = {"patient_id": patient.id, "description": "Manual bill", "total_amount": "100.00", "currency": "SYP"}
    assert admin_client.post("/api/billing-handoffs/", payload, format="json").status_code == 403
    assert doctor_client.post("/api/billing-handoffs/", payload, format="json").status_code == 403


@pytest.mark.django_db
def test_manual_bill_rejects_archived_patient(staff_client, patient_factory):
    archived = patient_factory(is_archived=True, national_id_or_passport="ARCHIVED-BILL-PATIENT")
    response = staff_client.post(
        "/api/billing-handoffs/",
        {"patient_id": archived.id, "description": "Manual bill", "total_amount": "100.00", "currency": "SYP"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_patient_and_workflow_fields_are_never_mutable(staff_client, billing_handoff_factory, patient_factory):
    handoff = billing_handoff_factory()
    other = patient_factory(national_id_or_passport="HANDOFF-OTHER")
    response = staff_client.patch(
        f"/api/billing-handoffs/{handoff.id}/",
        {"patient_id": other.id, "status": "PAID", "origin": "VISIT_COMPLETION"},
        format="json",
    )
    assert response.status_code == 400
    handoff.refresh_from_db()
    assert handoff.patient_id != other.id
    assert handoff.status == BillingHandoff.Status.OPEN


@pytest.mark.django_db
def test_financial_fields_lock_after_first_invoice_but_description_and_note_remain_editable(staff_client, billing_handoff_factory, invoice_factory):
    handoff = billing_handoff_factory(total_amount="100.00", currency="USD")
    invoice_factory(billing_handoff=handoff, amount="25.00")
    locked = staff_client.patch(f"/api/billing-handoffs/{handoff.id}/", {"total_amount": "120.00", "currency": "SYP"}, format="json")
    assert locked.status_code == 409
    updated = staff_client.patch(f"/api/billing-handoffs/{handoff.id}/", {"description": "Corrected treatment", "note": "Audited note"}, format="json")
    assert updated.status_code == 200
    handoff.refresh_from_db()
    assert handoff.total_amount == Decimal("100.00")
    assert handoff.currency == "USD"
    assert handoff.description == "Corrected treatment"


@pytest.mark.django_db
def test_zero_invoice_bill_can_cancel_but_paid_history_cannot(staff_client, billing_handoff_factory, invoice_factory):
    empty = billing_handoff_factory()
    cancelled = staff_client.post(f"/api/billing-handoffs/{empty.id}/cancel/", {"cancelled_reason": "Entered twice"}, format="json")
    assert cancelled.status_code == 200
    assert cancelled.data["status"] == BillingHandoff.Status.CANCELLED
    assert cancelled.data["cancelled_reason"] == "Entered twice"

    with_history = billing_handoff_factory(total_amount="100.00")
    invoice_factory(billing_handoff=with_history, amount="20.00")
    rejected = staff_client.post(f"/api/billing-handoffs/{with_history.id}/cancel/", format="json")
    assert rejected.status_code == 409


@pytest.mark.django_db
def test_handoff_history_filters_include_all_canonical_statuses(staff_client, billing_handoff_factory):
    for status in BillingHandoff.Status.values:
        billing_handoff_factory(status=status, cancelled_at="2026-08-08T09:00:00Z" if status == "CANCELLED" else None)
    all_rows = staff_client.get("/api/billing-handoffs/")
    assert all_rows.status_code == 200
    assert set(item["status"] for item in all_rows.data["results"]) == set(BillingHandoff.Status.values)
    for status in BillingHandoff.Status.values:
        filtered = staff_client.get(f"/api/billing-handoffs/?status={status}")
        assert filtered.data["count"] == 1


@pytest.mark.django_db
def test_handoff_summary_uses_complete_filtered_queryset(staff_client, billing_handoff_factory, invoice_factory):
    open_bill = billing_handoff_factory(total_amount="300.00", currency="SYP")
    partial = billing_handoff_factory(total_amount="100.00", currency="USD", status=BillingHandoff.Status.PARTIALLY_PAID)
    invoice_factory(billing_handoff=partial, amount="25.00")
    response = staff_client.get("/api/billing-handoffs/summary/")
    assert response.status_code == 200
    assert response.data["open_count"] >= 1
    assert response.data["partially_paid_count"] >= 1
    assert Decimal(response.data["currency_totals"]["SYP"]["outstanding"]) >= Decimal(open_bill.total_amount)
    assert response.data["currency_totals"]["USD"]["paid"] == Decimal("25.00")


@pytest.mark.django_db
def test_doctor_handoff_summary_is_scoped_to_own_bills(
    doctor_client,
    doctor_user,
    other_doctor_user,
    billing_handoff_factory,
):
    billing_handoff_factory(doctor=doctor_user, total_amount="125.00", currency="USD")
    billing_handoff_factory(doctor=other_doctor_user, total_amount="900.00", currency="SYP")

    response = doctor_client.get("/api/billing-handoffs/summary/")

    assert response.status_code == 200
    assert response.data["open_count"] == 1
    assert response.data["currency_totals"]["USD"]["bill_total"] == Decimal("125.00")
    assert response.data["currency_totals"]["SYP"]["bill_total"] == Decimal("0.00")
