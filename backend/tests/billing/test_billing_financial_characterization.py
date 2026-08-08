from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.billing.models import BillingHandoff
from apps.clinic.models import ClinicSettings


HANDOFF_RESPONSE_FIELDS = {
    "id",
    "patient",
    "visit",
    "doctor",
    "description",
    "total_amount",
    "paid_amount",
    "remaining_amount",
    "invoice_count",
    "currency",
    "note",
    "status",
    "origin",
    "legacy_reference",
    "cancelled_at",
    "cancelled_reason",
    "invoices",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
}


@pytest.mark.django_db
def test_bill_financial_properties_characterize_open_partial_paid_and_cancelled_states(
    billing_handoff_factory,
    invoice_factory,
):
    open_bill = billing_handoff_factory(total_amount="300000.00")
    partial_bill = billing_handoff_factory(
        total_amount="300000.00",
        status=BillingHandoff.Status.PARTIALLY_PAID,
    )
    invoice_factory(billing_handoff=partial_bill, amount="100000.00")
    invoice_factory(billing_handoff=partial_bill, amount="50000.00")
    paid_bill = billing_handoff_factory(total_amount="300000.00", status=BillingHandoff.Status.PAID)
    invoice_factory(billing_handoff=paid_bill, amount="100000.00")
    invoice_factory(billing_handoff=paid_bill, amount="200000.00")
    cancelled_bill = billing_handoff_factory(
        total_amount="300000.00",
        status=BillingHandoff.Status.CANCELLED,
        cancelled_at=timezone.now(),
    )
    invoice_factory(billing_handoff=cancelled_bill, amount="50000.00")

    for bill in (open_bill, partial_bill, paid_bill, cancelled_bill):
        bill.refresh_from_db()

    assert (open_bill.paid_amount, open_bill.remaining_amount, open_bill.invoice_count, open_bill.status) == (
        Decimal("0.00"),
        Decimal("300000.00"),
        0,
        BillingHandoff.Status.OPEN,
    )
    assert (
        partial_bill.paid_amount,
        partial_bill.remaining_amount,
        partial_bill.invoice_count,
        partial_bill.status,
    ) == (
        Decimal("150000.00"),
        Decimal("150000.00"),
        2,
        BillingHandoff.Status.PARTIALLY_PAID,
    )
    assert (paid_bill.paid_amount, paid_bill.remaining_amount, paid_bill.invoice_count, paid_bill.status) == (
        Decimal("300000.00"),
        Decimal("0.00"),
        2,
        BillingHandoff.Status.PAID,
    )
    assert (
        cancelled_bill.paid_amount,
        cancelled_bill.remaining_amount,
        cancelled_bill.invoice_count,
        cancelled_bill.status,
    ) == (
        Decimal("50000.00"),
        Decimal("250000.00"),
        1,
        BillingHandoff.Status.CANCELLED,
    )


@pytest.mark.django_db
def test_billing_list_detail_and_summary_characterize_financial_contract_and_currency_isolation(
    staff_client,
    billing_handoff_factory,
    invoice_factory,
):
    open_syp = billing_handoff_factory(total_amount="300000.00", currency=BillingHandoff.Currency.SYP)
    partial_usd = billing_handoff_factory(
        total_amount="300000.00",
        currency=BillingHandoff.Currency.USD,
        status=BillingHandoff.Status.PARTIALLY_PAID,
    )
    invoice_factory(billing_handoff=partial_usd, amount="100000.00")
    invoice_factory(billing_handoff=partial_usd, amount="50000.00")
    paid_syp = billing_handoff_factory(
        total_amount="300000.00",
        currency=BillingHandoff.Currency.SYP,
        status=BillingHandoff.Status.PAID,
    )
    invoice_factory(billing_handoff=paid_syp, amount="100000.00")
    invoice_factory(billing_handoff=paid_syp, amount="200000.00")
    cancelled_usd = billing_handoff_factory(
        total_amount="300000.00",
        currency=BillingHandoff.Currency.USD,
        status=BillingHandoff.Status.CANCELLED,
        cancelled_at=timezone.now(),
    )
    invoice_factory(billing_handoff=cancelled_usd, amount="50000.00")

    listed = staff_client.get("/api/billing-handoffs/")
    detailed = staff_client.get(f"/api/billing-handoffs/{partial_usd.id}/")
    summary = staff_client.get("/api/billing-handoffs/summary/")

    assert listed.status_code == detailed.status_code == summary.status_code == 200
    rows = {row["id"]: row for row in listed.data["results"]}
    assert set(rows[open_syp.id]) == HANDOFF_RESPONSE_FIELDS
    assert (rows[open_syp.id]["paid_amount"], rows[open_syp.id]["remaining_amount"], rows[open_syp.id]["invoice_count"]) == (
        "0.00",
        "300000.00",
        0,
    )
    assert (rows[partial_usd.id]["paid_amount"], rows[partial_usd.id]["remaining_amount"], rows[partial_usd.id]["invoice_count"]) == (
        "150000.00",
        "150000.00",
        2,
    )
    assert (rows[paid_syp.id]["paid_amount"], rows[paid_syp.id]["remaining_amount"], rows[paid_syp.id]["invoice_count"]) == (
        "300000.00",
        "0.00",
        2,
    )
    assert (
        rows[cancelled_usd.id]["paid_amount"],
        rows[cancelled_usd.id]["remaining_amount"],
        rows[cancelled_usd.id]["invoice_count"],
    ) == ("50000.00", "250000.00", 1)
    assert set(detailed.data) == HANDOFF_RESPONSE_FIELDS
    assert detailed.data["status"] == BillingHandoff.Status.PARTIALLY_PAID
    assert detailed.data["paid_amount"] == "150000.00"
    assert detailed.data["remaining_amount"] == "150000.00"
    assert detailed.data["invoice_count"] == 2
    assert set(summary.data) == {
        "clinic_date",
        "clinic_timezone",
        "status_counts",
        "open_count",
        "partially_paid_count",
        "paid_count",
        "cancelled_count",
        "currency_totals",
    }
    assert summary.data["status_counts"] == {
        BillingHandoff.Status.OPEN: 1,
        BillingHandoff.Status.PARTIALLY_PAID: 1,
        BillingHandoff.Status.PAID: 1,
        BillingHandoff.Status.CANCELLED: 1,
    }
    assert summary.data["currency_totals"] == {
        BillingHandoff.Currency.SYP: {
            "bill_total": Decimal("600000.00"),
            "paid": Decimal("300000.00"),
            "outstanding": Decimal("300000.00"),
        },
        BillingHandoff.Currency.USD: {
            "bill_total": Decimal("600000.00"),
            "paid": Decimal("200000.00"),
            "outstanding": Decimal("150000.00"),
        },
    }


@pytest.mark.django_db
def test_invoice_print_data_characterizes_bill_and_payment_financials(
    staff_client,
    billing_handoff_factory,
    invoice_factory,
    completed_visit,
    staff_user,
):
    bill = billing_handoff_factory(
        patient=completed_visit.patient,
        visit=completed_visit,
        doctor=completed_visit.doctor,
        description="Completed visit treatment",
        total_amount="300000.00",
        currency=BillingHandoff.Currency.SYP,
        status=BillingHandoff.Status.PARTIALLY_PAID,
    )
    invoice_factory(billing_handoff=bill, amount="100000.00", notes="Deposit")
    printed_invoice = invoice_factory(billing_handoff=bill, amount="50000.00", notes="Second payment")

    response = staff_client.get(f"/api/invoices/{printed_invoice.id}/print-data/")

    assert response.status_code == 200
    assert response.data["invoice"]["invoice_number"] == printed_invoice.invoice_number
    assert response.data["invoice"]["amount"] == Decimal("50000.00")
    assert response.data["invoice"]["issued_by"] == staff_user.full_name
    assert response.data["invoice"]["notes"] == "Second payment"
    assert response.data["patient"]["id"] == completed_visit.patient_id
    assert response.data["handoff"] == {
        "id": bill.id,
        "description": "Completed visit treatment",
        "total_amount": Decimal("300000.00"),
        "paid_amount": Decimal("150000.00"),
        "remaining_amount": Decimal("150000.00"),
        "currency": BillingHandoff.Currency.SYP,
        "status": BillingHandoff.Status.PARTIALLY_PAID,
    }
    assert response.data["visit"] == {"id": completed_visit.id, "status": completed_visit.status}
    assert response.data["appointment"] == {
        "id": completed_visit.appointment_id,
        "status": completed_visit.appointment.status,
    }


@pytest.mark.django_db
def test_billing_list_and_detail_query_counts_stay_bounded_without_financial_n_plus_one(
    staff_client,
    billing_handoff_factory,
    invoice_factory,
):
    bills = [billing_handoff_factory(total_amount="300000.00") for _ in range(3)]
    for bill in bills:
        invoice_factory(billing_handoff=bill, amount="100000.00")
        invoice_factory(billing_handoff=bill, amount="50000.00")
    ClinicSettings.get_solo()

    with CaptureQueriesContext(connection) as list_queries:
        list_response = staff_client.get("/api/billing-handoffs/")
    with CaptureQueriesContext(connection) as detail_queries:
        detail_response = staff_client.get(f"/api/billing-handoffs/{bills[0].id}/")

    assert list_response.status_code == detail_response.status_code == 200
    assert len(list_queries) <= 5
    assert len(detail_queries) <= 4


@pytest.mark.django_db
def test_invoice_print_data_uses_one_bill_financial_projection_query(
    staff_client,
    billing_handoff_factory,
    invoice_factory,
):
    bill = billing_handoff_factory(
        total_amount="300000.00",
        status=BillingHandoff.Status.PARTIALLY_PAID,
    )
    invoice_factory(billing_handoff=bill, amount="100000.00")
    invoice = invoice_factory(billing_handoff=bill, amount="50000.00")
    ClinicSettings.get_solo()

    with CaptureQueriesContext(connection) as queries:
        response = staff_client.get(f"/api/invoices/{invoice.id}/print-data/")

    assert response.status_code == 200
    assert response.data["handoff"]["paid_amount"] == Decimal("150000.00")
    assert response.data["handoff"]["remaining_amount"] == Decimal("150000.00")
    financial_queries = [
        query["sql"]
        for query in queries.captured_queries
        if "SUM(" in query["sql"].upper() and "billing_invoice" in query["sql"]
    ]
    assert len(queries) <= 4
    assert len(financial_queries) == 1
