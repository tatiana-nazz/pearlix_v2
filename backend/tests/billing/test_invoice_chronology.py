from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice, InvoiceSequence
from apps.billing.services import BillingRuleError, validate_invoice_chronology
from apps.clinic.models import ClinicSettings
from apps.visits.models import Visit


UTC = ZoneInfo("UTC")


def _at(hour, minute=0):
    return datetime(2026, 7, 15, hour, minute, tzinfo=UTC)


def _set_handoff_created_at(handoff, value):
    BillingHandoff.objects.filter(pk=handoff.pk).update(created_at=value)
    handoff.refresh_from_db()
    return handoff


@pytest.mark.django_db
def test_invoice_defaults_to_server_now_and_preserves_partial_full_payment_math(
    staff_client,
    billing_handoff_factory,
):
    handoff = _set_handoff_created_at(
        billing_handoff_factory(total_amount="300.00", currency="USD"),
        _at(8),
    )

    first = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {"amount": "100.00"},
        format="json",
    )
    second = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {"amount": "200.00"},
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert Invoice.objects.get(pk=first.data["invoice"]["id"]).issued_at == timezone.now()
    assert second.data["handoff"]["paid_amount"] == "300.00"
    assert second.data["handoff"]["remaining_amount"] == "0.00"
    assert second.data["handoff"]["status"] == BillingHandoff.Status.PAID
    assert first.data["invoice"]["currency"] == "USD"


@pytest.mark.django_db
def test_invoice_accepts_exact_handoff_boundary_but_rejects_one_instant_before_it(
    staff_client,
    billing_handoff_factory,
):
    origin = _at(8)
    valid_handoff = _set_handoff_created_at(billing_handoff_factory(), origin)
    invalid_handoff = _set_handoff_created_at(billing_handoff_factory(), origin)

    valid = staff_client.post(
        f"/api/billing-handoffs/{valid_handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": origin.isoformat()},
        format="json",
    )
    invalid = staff_client.post(
        f"/api/billing-handoffs/{invalid_handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": (origin - timedelta(microseconds=1)).isoformat()},
        format="json",
    )

    assert valid.status_code == 201
    assert invalid.status_code == 400
    assert invalid.data["code"] == "VALIDATION_ERROR"
    assert "billing origin" in invalid.data["details"]["issued_at"][0]
    assert not Invoice.objects.filter(billing_handoff=invalid_handoff).exists()


@pytest.mark.django_db
def test_visit_completion_is_an_additional_invoice_origin_boundary(
    staff_client,
    completed_visit,
    billing_handoff_factory,
):
    Visit.objects.filter(pk=completed_visit.pk).update(completed_at=_at(8, 30))
    completed_visit.refresh_from_db()
    handoff = billing_handoff_factory(
        patient=completed_visit.patient,
        visit=completed_visit,
        doctor=completed_visit.doctor,
        origin=BillingHandoff.Origin.VISIT_COMPLETION,
    )
    handoff = _set_handoff_created_at(handoff, _at(8))

    response = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": _at(8, 15).isoformat()},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert not Invoice.objects.filter(billing_handoff=handoff).exists()


@pytest.mark.django_db
def test_invoice_future_policy_allows_five_minute_skew_and_rejects_more(
    staff_client,
    billing_handoff_factory,
):
    allowed_handoff = _set_handoff_created_at(billing_handoff_factory(), _at(8))
    rejected_handoff = _set_handoff_created_at(billing_handoff_factory(), _at(8))

    allowed = staff_client.post(
        f"/api/billing-handoffs/{allowed_handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": (_at(9) + timedelta(minutes=5)).isoformat()},
        format="json",
    )
    rejected = staff_client.post(
        f"/api/billing-handoffs/{rejected_handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": (_at(9) + timedelta(minutes=5, microseconds=1)).isoformat()},
        format="json",
    )

    assert allowed.status_code == 201
    assert rejected.status_code == 400
    assert "five minutes" in rejected.data["details"]["issued_at"][0]
    assert not Invoice.objects.filter(billing_handoff=rejected_handoff).exists()


@pytest.mark.django_db
def test_invoice_chronology_uses_configured_iana_timezone_at_dst_offset(
    staff_client,
    billing_handoff_factory,
):
    clinic = ClinicSettings.get_solo()
    clinic.timezone = "America/New_York"
    clinic.save(update_fields=["timezone", "updated_at"])
    handoff = _set_handoff_created_at(billing_handoff_factory(), _at(8, 30))

    response = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {
            "amount": "10.00",
            # Offset-less staff input is interpreted in the configured clinic
            # zone. 05:00 EDT is the deterministic test clock's 09:00 UTC.
            "issued_at": "2026-07-15T05:00:00",
        },
        format="json",
    )

    assert response.status_code == 201
    invoice = Invoice.objects.get(pk=response.data["invoice"]["id"])
    assert invoice.issued_at == _at(9)


@pytest.mark.django_db
def test_invoice_chronology_compares_absolute_instants_across_dst_fall_back(
    billing_handoff_factory,
):
    clinic = ClinicSettings.get_solo()
    clinic.timezone = "America/New_York"
    clinic.save(update_fields=["timezone", "updated_at"])

    later_fold_origin = datetime.fromisoformat("2026-11-01T01:15:00-05:00")
    handoff = _set_handoff_created_at(billing_handoff_factory(), later_fold_origin)
    earlier_first_fold_issue = datetime.fromisoformat("2026-11-01T01:30:00-04:00")
    after_transition_now = datetime.fromisoformat("2026-11-01T03:00:00-05:00")

    with pytest.raises(BillingRuleError) as exc_info:
        validate_invoice_chronology(
            handoff=handoff,
            issued_at=earlier_first_fold_issue,
            current_time=after_transition_now,
        )
    assert exc_info.value.code == "VALIDATION_ERROR"

    first_fold_origin = datetime.fromisoformat("2026-11-01T01:45:00-04:00")
    handoff = _set_handoff_created_at(handoff, first_fold_origin)
    later_second_fold_issue = datetime.fromisoformat("2026-11-01T01:30:00-05:00")
    accepted = validate_invoice_chronology(
        handoff=handoff,
        issued_at=later_second_fold_issue,
        current_time=after_transition_now,
    )
    assert accepted.astimezone(UTC) == later_second_fold_issue.astimezone(UTC)


@pytest.mark.django_db
def test_invoice_chronology_accepts_exact_origin_instant_across_timezones(
    billing_handoff_factory,
):
    clinic = ClinicSettings.get_solo()
    clinic.timezone = "America/New_York"
    clinic.save(update_fields=["timezone", "updated_at"])
    origin = datetime.fromisoformat("2026-11-01T01:15:00-05:00")
    handoff = _set_handoff_created_at(billing_handoff_factory(), origin)

    accepted = validate_invoice_chronology(
        handoff=handoff,
        issued_at=origin.astimezone(UTC),
        current_time=datetime.fromisoformat("2026-11-01T03:00:00-05:00"),
    )

    assert accepted.astimezone(UTC) == origin.astimezone(UTC)


@pytest.mark.django_db
def test_invalid_chronology_does_not_consume_invoice_sequence(
    staff_client,
    billing_handoff_factory,
):
    handoff = _set_handoff_created_at(billing_handoff_factory(), _at(8))

    response = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/invoices/",
        {"amount": "10.00", "issued_at": _at(7).isoformat()},
        format="json",
    )

    assert response.status_code == 400
    assert Invoice.objects.count() == 0
    assert InvoiceSequence.objects.count() == 0
