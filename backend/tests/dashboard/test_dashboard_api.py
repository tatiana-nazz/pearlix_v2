from decimal import Decimal

import pytest
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice


@pytest.mark.django_db
def test_dashboard_role_permissions(admin_client, staff_client, doctor_client, api_client):
    assert admin_client.get("/api/dashboard/admin/").status_code == 200
    assert staff_client.get("/api/dashboard/admin/").status_code == 403
    assert staff_client.get("/api/dashboard/staff/").status_code == 200
    assert admin_client.get("/api/dashboard/staff/").status_code == 403
    assert doctor_client.get("/api/dashboard/doctor/").status_code == 200
    assert api_client.get("/api/dashboard/admin/").status_code == 401


@pytest.mark.django_db
def test_admin_dashboard_reports_bill_debt_and_receipt_collection(admin_client, billing_handoff_factory, invoice_factory):
    open_bill = billing_handoff_factory(total_amount="300.00", currency="SYP")
    partial = billing_handoff_factory(total_amount="100.00", currency="USD", status=BillingHandoff.Status.PARTIALLY_PAID)
    invoice_factory(billing_handoff=partial, amount="25.00", issued_at=timezone.now())
    paid = billing_handoff_factory(total_amount="50.00", status=BillingHandoff.Status.PAID)
    invoice_factory(billing_handoff=paid, amount="50.00", issued_at=timezone.now())
    response = admin_client.get("/api/dashboard/admin/")
    assert response.status_code == 200
    data = response.data
    assert data["open_bills_count"] >= 1
    assert data["partially_paid_bills_count"] >= 1
    assert data["today_invoices_count"] >= 2
    assert Decimal(data["collected_today"]["SYP"]) >= Decimal("50.00")
    assert Decimal(data["collected_today"]["USD"]) >= Decimal("25.00")
    assert "open_invoices_count" not in data
    assert "recent_invoices" not in data
    assert data["recent_handoffs"][0]["id"] in {open_bill.id, partial.id, paid.id}


@pytest.mark.django_db
def test_staff_dashboard_returns_open_and_partial_handoff_follow_up(staff_client, billing_handoff_factory, invoice_factory):
    open_bill = billing_handoff_factory(total_amount="100.00")
    partial = billing_handoff_factory(total_amount="100.00", status=BillingHandoff.Status.PARTIALLY_PAID)
    invoice_factory(billing_handoff=partial, amount="40.00")
    billing_handoff_factory(total_amount="100.00", status=BillingHandoff.Status.CANCELLED, cancelled_at=timezone.now())
    response = staff_client.get("/api/dashboard/staff/")
    ids = {row["id"] for row in response.data["open_handoffs"]}
    assert open_bill.id in ids
    assert partial.id in ids
    partial_row = next(row for row in response.data["open_handoffs"] if row["id"] == partial.id)
    assert partial_row["paid_amount"] == Decimal("40.00")
    assert partial_row["remaining_amount"] == Decimal("60.00")
    assert "open_invoices" not in response.data


@pytest.mark.django_db
def test_billing_activity_uses_handoffs_as_billed_and_invoices_as_collected(admin_client, billing_handoff_factory, invoice_factory):
    bill = billing_handoff_factory(total_amount="200.00", currency="USD")
    invoice_factory(billing_handoff=bill, amount="75.00", issued_at=timezone.now())
    response = admin_client.get("/api/dashboard/admin/")
    current = next(row for row in response.data["billing_activity_last_30_days"] if row["date"] == response.data["clinic_date"])
    assert Decimal(current["USD"]["billed"]) >= Decimal("200.00")
    assert Decimal(current["USD"]["collected"]) >= Decimal("75.00")
    assert "invoiced" not in current["USD"]
