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
def test_no_role_can_create_a_handoff_from_the_collection_api(staff_client, admin_client, doctor_client, patient):
    payload = {"patient_id": patient.id, "description": "Blocked direct bill", "total_amount": "100.00", "currency": "SYP"}
    for client in (staff_client, admin_client, doctor_client):
        response = client.post("/api/billing-handoffs/", payload, format="json")
        assert response.status_code in {403, 405}
    assert BillingHandoff.objects.count() == 0


@pytest.mark.django_db
def test_handoffs_cannot_be_patched_or_cancelled_by_any_role(
    staff_client,
    admin_client,
    doctor_client,
    billing_handoff_factory,
):
    handoff = billing_handoff_factory(description="Immutable visit bill", total_amount="100.00", currency="USD")
    for client in (staff_client, admin_client, doctor_client):
        patched = client.patch(
            f"/api/billing-handoffs/{handoff.id}/",
            {"description": "Blocked", "total_amount": "1.00", "currency": "SYP"},
            format="json",
        )
        assert patched.status_code in {403, 405}
    cancelled = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/cancel/",
        {"cancelled_reason": "Blocked"},
        format="json",
    )
    assert cancelled.status_code in {403, 404, 405}
    handoff.refresh_from_db()
    assert handoff.description == "Immutable visit bill"
    assert handoff.total_amount == Decimal("100.00")
    assert handoff.currency == "USD"
    assert handoff.status == BillingHandoff.Status.OPEN
    assert Invoice.objects.filter(billing_handoff=handoff).count() == 0


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
