from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from apps.billing.models import Invoice


CLINIC_TZ = ZoneInfo("Asia/Damascus")


def at_clinic_time(day, hour=10):
    return datetime(2026, 7, day, hour, 0, tzinfo=CLINIC_TZ)


def set_invoice_created_at(invoice, value):
    Invoice.objects.filter(pk=invoice.pk).update(created_at=value)
    invoice.refresh_from_db()
    return invoice


@pytest.mark.django_db
def test_summary_permissions(admin_client, staff_client, doctor_client, api_client):
    assert admin_client.get("/api/invoices/summary/").status_code == 200
    assert staff_client.get("/api/invoices/summary/").status_code == 200
    assert doctor_client.get("/api/invoices/summary/").status_code == 403
    assert api_client.get("/api/invoices/summary/").status_code == 401


@pytest.mark.django_db
def test_summary_reports_clinic_context_statuses_and_separate_currency_totals(
    staff_client,
    invoice_factory,
    payment_factory,
):
    unpaid_syp = set_invoice_created_at(invoice_factory(total_amount="100.00"), at_clinic_time(15))
    partial_usd = set_invoice_created_at(
        invoice_factory(
            invoice_number="INV-USD-1",
            currency=Invoice.Currency.USD,
            total_amount="80.00",
            status=Invoice.Status.PARTIALLY_PAID,
        ),
        at_clinic_time(15, 11),
    )
    paid_syp = set_invoice_created_at(
        invoice_factory(invoice_number="INV-PAID-1", total_amount="50.00", status=Invoice.Status.PAID),
        at_clinic_time(14),
    )
    cancelled_usd = set_invoice_created_at(
        invoice_factory(
            invoice_number="INV-CANCELLED-1",
            currency=Invoice.Currency.USD,
            total_amount="40.00",
            status=Invoice.Status.CANCELLED,
            cancelled_at=timezone.now(),
        ),
        at_clinic_time(13),
    )
    payment_factory(invoice=partial_usd, amount="20.00", payment_date=at_clinic_time(15, 12))
    payment_factory(invoice=paid_syp, amount="50.00", payment_date=at_clinic_time(14, 12))
    payment_factory(invoice=cancelled_usd, amount="10.00", payment_date=at_clinic_time(13, 12))

    response = staff_client.get("/api/invoices/summary/")

    assert response.status_code == 200
    assert response.data["clinic_date"] == "2026-07-15"
    assert response.data["clinic_timezone"] == "Asia/Damascus"
    assert response.data["invoice_count"] == 4
    assert response.data["status_counts"] == {
        "UNPAID": 1,
        "PARTIALLY_PAID": 1,
        "PAID": 1,
        "CANCELLED": 1,
    }
    assert response.data["open_invoice_count"] == 2
    assert response.data["currency_totals"]["SYP"] == {
        "invoiced": Decimal("150.00"),
        "paid": Decimal("50.00"),
        "outstanding": Decimal("100.00"),
    }
    assert response.data["currency_totals"]["USD"] == {
        "invoiced": Decimal("120.00"),
        "paid": Decimal("30.00"),
        "outstanding": Decimal("60.00"),
    }
    assert response.data["payments_collected_in_period"] == {
        "SYP": Decimal("50.00"),
        "USD": Decimal("30.00"),
    }
    assert unpaid_syp.id


@pytest.mark.django_db
def test_clinic_date_range_uses_full_local_days_for_list_and_summary(staff_client, invoice_factory):
    before = set_invoice_created_at(invoice_factory(invoice_number="INV-BEFORE"), at_clinic_time(14, 23))
    start = set_invoice_created_at(invoice_factory(invoice_number="INV-START"), at_clinic_time(15, 0))
    end = set_invoice_created_at(invoice_factory(invoice_number="INV-END"), at_clinic_time(15, 23))
    after = set_invoice_created_at(invoice_factory(invoice_number="INV-AFTER"), at_clinic_time(16, 0))

    list_response = staff_client.get("/api/invoices/?date_from=2026-07-15&date_to=2026-07-15")
    summary_response = staff_client.get("/api/invoices/summary/?date_from=2026-07-15&date_to=2026-07-15")

    assert list_response.status_code == 200
    assert {row["id"] for row in list_response.data["results"]} == {start.id, end.id}
    assert summary_response.data["invoice_count"] == 2
    assert before.id not in {row["id"] for row in list_response.data["results"]}
    assert after.id not in {row["id"] for row in list_response.data["results"]}


@pytest.mark.django_db
def test_payments_in_period_are_based_on_payment_date_not_invoice_date(
    staff_client,
    invoice_factory,
    payment_factory,
):
    older_invoice = set_invoice_created_at(invoice_factory(total_amount="100.00"), at_clinic_time(10))
    payment_factory(invoice=older_invoice, amount="25.00", payment_date=at_clinic_time(15, 9))

    response = staff_client.get("/api/invoices/summary/?date_from=2026-07-15&date_to=2026-07-15")

    assert response.status_code == 200
    assert response.data["invoice_count"] == 0
    assert response.data["payments_collected_in_period"]["SYP"] == Decimal("25.00")


@pytest.mark.django_db
def test_summary_keeps_equal_value_invoices_as_separate_financial_rows(staff_client, invoice_factory):
    invoice_factory(total_amount="100.00", currency=Invoice.Currency.SYP)
    invoice_factory(invoice_number="INV-SAME-TOTAL", total_amount="100.00", currency=Invoice.Currency.SYP)

    response = staff_client.get("/api/invoices/summary/")

    assert response.status_code == 200
    assert response.data["invoice_count"] == 2
    assert response.data["currency_totals"]["SYP"]["invoiced"] == Decimal("200.00")
    assert response.data["currency_totals"]["SYP"]["outstanding"] == Decimal("200.00")


@pytest.mark.django_db
def test_invoice_search_is_case_insensitive_and_combines_with_filters(
    staff_client,
    invoice_factory,
    patient_factory,
):
    lina = patient_factory(full_name="Lina Haddad", phone="0977000001")
    target = invoice_factory(
        invoice_number="INV-SEARCH-ALPHA",
        patient=lina,
        currency=Invoice.Currency.USD,
        status=Invoice.Status.UNPAID,
    )
    invoice_factory(invoice_number="INV-SEARCH-BETA", patient=lina, currency=Invoice.Currency.SYP)

    by_number = staff_client.get("/api/invoices/?search=search-alpha")
    combined = staff_client.get("/api/invoices/?search=HADDAD&currency=USD&status=UNPAID")

    assert by_number.data["count"] == 1
    assert by_number.data["results"][0]["id"] == target.id
    assert combined.data["count"] == 1
    assert combined.data["results"][0]["id"] == target.id


@pytest.mark.django_db
@pytest.mark.parametrize(
    "query,field",
    [
        ("date_from=not-a-date", "date_from"),
        ("date_to=2026-13-40", "date_to"),
        ("date_from=2026-07-16&date_to=2026-07-15", "date_to"),
        ("status=UNKNOWN", "status"),
        ("currency=EUR", "currency"),
        ("patient_id=nope", "patient_id"),
    ],
)
def test_invoice_filter_validation_is_standardized(staff_client, query, field):
    for path in ("/api/invoices/", "/api/invoices/summary/"):
        response = staff_client.get(f"{path}?{query}")
        assert response.status_code == 400
        assert response.data["code"] == "VALIDATION_ERROR"
        assert field in response.data["details"]


@pytest.mark.django_db
def test_created_datetime_filters_remain_supported(staff_client, invoice_factory):
    old_invoice = set_invoice_created_at(invoice_factory(invoice_number="INV-OLD"), at_clinic_time(10))
    new_invoice = set_invoice_created_at(invoice_factory(invoice_number="INV-NEW"), at_clinic_time(15))

    response = staff_client.get("/api/invoices/?created_from=2026-07-14T00:00:00%2B03:00")

    assert response.status_code == 200
    assert {row["id"] for row in response.data["results"]} == {new_invoice.id}
    assert old_invoice.id not in {row["id"] for row in response.data["results"]}
