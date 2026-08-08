from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from apps.billing.models import BillingHandoff, Invoice


CLINIC_TZ = ZoneInfo("Asia/Damascus")


def at_clinic_time(day, hour=10):
    return datetime(2026, 7, day, hour, 0, tzinfo=CLINIC_TZ)


@pytest.mark.django_db
def test_invoice_summary_permissions(admin_client, staff_client, doctor_client, api_client):
    assert admin_client.get("/api/invoices/summary/").status_code == 200
    assert staff_client.get("/api/invoices/summary/").status_code == 200
    assert doctor_client.get("/api/invoices/summary/").status_code == 403
    assert api_client.get("/api/invoices/summary/").status_code == 401


@pytest.mark.django_db
def test_invoice_summary_reports_payment_receipts_by_currency(staff_client, billing_handoff_factory, invoice_factory):
    syp = billing_handoff_factory(currency="SYP", total_amount="300000.00")
    usd = billing_handoff_factory(currency="USD", total_amount="100.00")
    invoice_factory(billing_handoff=syp, amount="100000.00", issued_at=at_clinic_time(15, 10))
    invoice_factory(billing_handoff=syp, amount="75000.00", issued_at=at_clinic_time(15, 11))
    invoice_factory(billing_handoff=usd, amount="25.00", issued_at=at_clinic_time(14, 12))
    response = staff_client.get("/api/invoices/summary/")
    assert response.status_code == 200
    assert response.data["invoice_count"] == 3
    assert response.data["collected_by_currency"] == {"SYP": Decimal("175000.00"), "USD": Decimal("25.00")}
    assert "status_counts" not in response.data
    assert "open_invoice_count" not in response.data


@pytest.mark.django_db
def test_invoice_date_range_uses_issued_at_full_clinic_days(staff_client, billing_handoff_factory, invoice_factory):
    bill = billing_handoff_factory()
    before = invoice_factory(billing_handoff=bill, invoice_number="INV-BEFORE", amount="10.00", issued_at=at_clinic_time(14, 23))
    start = invoice_factory(billing_handoff=bill, invoice_number="INV-START", amount="10.00", issued_at=at_clinic_time(15, 0))
    end = invoice_factory(billing_handoff=bill, invoice_number="INV-END", amount="10.00", issued_at=at_clinic_time(15, 23))
    after = invoice_factory(billing_handoff=bill, invoice_number="INV-AFTER", amount="10.00", issued_at=at_clinic_time(16, 0))
    response = staff_client.get("/api/invoices/?date_from=2026-07-15&date_to=2026-07-15")
    assert {row["id"] for row in response.data["results"]} == {start.id, end.id}
    assert before.id not in {row["id"] for row in response.data["results"]}
    assert after.id not in {row["id"] for row in response.data["results"]}
    assert staff_client.get("/api/invoices/summary/?date_from=2026-07-15&date_to=2026-07-15").data["invoice_count"] == 2


@pytest.mark.django_db
def test_invoice_search_and_handoff_filters_combine(staff_client, billing_handoff_factory, invoice_factory, patient_factory):
    lina = patient_factory(first_name="Lina", last_name="Haddad", national_id_or_passport="INV-SEARCH-PATIENT")
    target_bill = billing_handoff_factory(patient=lina, currency="USD")
    target = invoice_factory(billing_handoff=target_bill, invoice_number="INV-SEARCH-ALPHA")
    other_bill = billing_handoff_factory(currency="SYP")
    invoice_factory(billing_handoff=other_bill, invoice_number="INV-SEARCH-BETA")
    response = staff_client.get(f"/api/invoices/?search=HADDAD&currency=USD&handoff_id={target_bill.id}")
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == target.id


@pytest.mark.django_db
@pytest.mark.parametrize("query,field", [("date_from=bad", "date_from"), ("date_from=2026-07-16&date_to=2026-07-15", "date_to"), ("currency=EUR", "currency"), ("patient_id=nope", "patient_id")])
def test_invoice_filter_validation_is_standardized(staff_client, query, field):
    for path in ("/api/invoices/", "/api/invoices/summary/"):
        response = staff_client.get(f"{path}?{query}")
        assert response.status_code == 400
        assert response.data["code"] == "VALIDATION_ERROR"
        assert field in response.data["details"]
