from decimal import Decimal

import pytest

from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


def _completed_visit_for(visit_factory, appointment_factory, doctor, **overrides):
    patient = overrides.pop("patient", None)
    appointment_kwargs = {
        "doctor": doctor,
        "status": Appointment.Status.COMPLETED,
        "start_datetime": overrides.pop("start_datetime", "2026-07-21T09:00:00+03:00"),
        "end_datetime": overrides.pop("end_datetime", "2026-07-21T09:30:00+03:00"),
    }
    if patient is not None:
        appointment_kwargs["patient"] = patient
    appointment = overrides.pop("appointment", None) or appointment_factory(**appointment_kwargs)
    return visit_factory(appointment=appointment, status=Visit.Status.COMPLETED, **overrides)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/visits/{visit_id}/billing-handoff/"),
        ("get", "/api/billing-handoffs/"),
        ("get", "/api/billing-handoffs/{handoff_id}/"),
        ("post", "/api/billing-handoffs/{handoff_id}/dismiss/"),
        ("post", "/api/billing-handoffs/{handoff_id}/convert-to-invoice/"),
    ],
)
def test_unauthenticated_user_cannot_access_billing_handoffs(
    api_client,
    completed_visit,
    billing_handoff_factory,
    method,
    path,
):
    handoff = billing_handoff_factory()

    response = getattr(api_client, method)(
        path.format(visit_id=completed_visit.id, handoff_id=handoff.id),
        {"total_amount": "100.00", "currency": "SYP"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_and_staff_cannot_create_billing_handoff(admin_client, staff_client, completed_visit):
    for client in (admin_client, staff_client):
        response = client.post(
            f"/api/visits/{completed_visit.id}/billing-handoff/",
            {"suggested_amount": "100.00", "currency": "SYP"},
            format="json",
        )

        assert response.status_code == 403
        assert response.data["code"] == "PERMISSION_DENIED"
    assert BillingHandoff.objects.count() == 0


@pytest.mark.django_db
def test_doctor_can_create_handoff_for_own_completed_visit_and_duplicate_is_rejected(doctor_client, completed_visit, doctor_user):
    response = doctor_client.post(
        f"/api/visits/{completed_visit.id}/billing-handoff/",
        {"note": "Please invoice", "suggested_amount": "125.50", "currency": "USD"},
        format="json",
    )

    assert response.status_code == 201
    handoff = BillingHandoff.objects.get(id=response.data["id"])
    assert handoff.patient_id == completed_visit.patient_id
    assert handoff.visit_id == completed_visit.id
    assert handoff.doctor_id == doctor_user.id
    assert handoff.status == BillingHandoff.Status.PENDING
    assert handoff.suggested_amount == Decimal("125.50")
    assert response.data["currency"] == "USD"

    duplicate_response = doctor_client.post(
        f"/api/visits/{completed_visit.id}/billing-handoff/",
        {"suggested_amount": "90.00", "currency": "SYP"},
        format="json",
    )

    assert duplicate_response.status_code == 409
    assert duplicate_response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert BillingHandoff.objects.count() == 1


@pytest.mark.django_db
def test_handoff_creation_requires_completed_own_visit(
    doctor_client,
    other_doctor_client,
    doctor_user,
    other_doctor_user,
    appointment_factory,
    visit_factory,
):
    active_appointment = appointment_factory(doctor=doctor_user, status=Appointment.Status.ACTIVE)
    active_visit = visit_factory(appointment=active_appointment, status=Visit.Status.ACTIVE)
    other_visit = _completed_visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        start_datetime="2026-07-21T10:00:00+03:00",
        end_datetime="2026-07-21T10:30:00+03:00",
    )

    active_response = doctor_client.post(
        f"/api/visits/{active_visit.id}/billing-handoff/",
        {"suggested_amount": "100.00", "currency": "SYP"},
        format="json",
    )
    other_response = doctor_client.post(
        f"/api/visits/{other_visit.id}/billing-handoff/",
        {"suggested_amount": "100.00", "currency": "SYP"},
        format="json",
    )
    other_doctor_response = other_doctor_client.post(
        f"/api/visits/{active_visit.id}/billing-handoff/",
        {"suggested_amount": "100.00", "currency": "SYP"},
        format="json",
    )

    assert active_response.status_code == 409
    assert active_response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert other_response.status_code == 404
    assert other_doctor_response.status_code == 404
    assert BillingHandoff.objects.count() == 0


@pytest.mark.django_db
def test_handoff_creation_validates_amount_and_currency(doctor_client, completed_visit):
    missing_currency = doctor_client.post(
        f"/api/visits/{completed_visit.id}/billing-handoff/",
        {"suggested_amount": "100.00"},
        format="json",
    )
    invalid_currency = doctor_client.post(
        f"/api/visits/{completed_visit.id}/billing-handoff/",
        {"suggested_amount": "100.00", "currency": "EUR"},
        format="json",
    )
    invalid_amount = doctor_client.post(
        f"/api/visits/{completed_visit.id}/billing-handoff/",
        {"suggested_amount": "0", "currency": "SYP"},
        format="json",
    )

    assert missing_currency.status_code == 400
    assert missing_currency.data["code"] == "VALIDATION_ERROR"
    assert invalid_currency.status_code == 400
    assert invalid_currency.data["code"] == "VALIDATION_ERROR"
    assert invalid_amount.status_code == 400
    assert invalid_amount.data["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_handoff_list_read_scope_and_filters(
    admin_client,
    staff_client,
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
    billing_handoff_factory,
):
    own = billing_handoff_factory()
    other_patient = patient_factory(full_name="Other Billing Patient", phone="0988111111")
    other_visit = _completed_visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        patient=other_patient,
        start_datetime="2026-07-21T11:00:00+03:00",
        end_datetime="2026-07-21T11:30:00+03:00",
    )
    other = billing_handoff_factory(
        visit=other_visit,
        patient=other_visit.patient,
        doctor=other_doctor_user,
        created_by=other_doctor_user,
        updated_by=other_doctor_user,
        suggested_amount="70.00",
    )

    for client in (admin_client, staff_client):
        assert client.get("/api/billing-handoffs/").data["count"] == 2
        assert client.get(f"/api/billing-handoffs/{other.id}/").status_code == 200
        assert client.get(f"/api/billing-handoffs/?doctor_id={doctor_user.id}").data["count"] == 1
        assert client.get(f"/api/billing-handoffs/?patient_id={own.patient_id}").data["count"] == 1
        assert client.get(f"/api/billing-handoffs/?visit_id={own.visit_id}").data["results"][0]["id"] == own.id
        assert client.get(f"/api/billing-handoffs/?status={BillingHandoff.Status.PENDING}").data["count"] == 2

    doctor_list = doctor_client.get("/api/billing-handoffs/")
    assert doctor_list.status_code == 200
    assert doctor_list.data["count"] == 1
    assert doctor_list.data["results"][0]["id"] == own.id
    assert doctor_client.get(f"/api/billing-handoffs/{own.id}/").status_code == 200
    assert doctor_client.get(f"/api/billing-handoffs/{other.id}/").status_code == 404
    assert doctor_client.get(f"/api/billing-handoffs/?doctor_id={other_doctor_user.id}").data["count"] == 0


@pytest.mark.django_db
def test_staff_can_dismiss_pending_handoff_and_other_roles_are_denied(
    admin_client,
    staff_client,
    doctor_client,
    billing_handoff_factory,
    appointment_factory,
    visit_factory,
    doctor_user,
):
    pending = billing_handoff_factory()
    second_visit = _completed_visit_for(
        visit_factory,
        appointment_factory,
        doctor_user,
        start_datetime="2026-07-21T12:00:00+03:00",
        end_datetime="2026-07-21T12:30:00+03:00",
    )
    denied_target = billing_handoff_factory(visit=second_visit, patient=second_visit.patient)

    for client in (admin_client, doctor_client):
        response = client.post(f"/api/billing-handoffs/{denied_target.id}/dismiss/")
        assert response.status_code == 403
        assert response.data["code"] == "PERMISSION_DENIED"

    dismiss_response = staff_client.post(f"/api/billing-handoffs/{pending.id}/dismiss/", {"dismissed_reason": "No charge"}, format="json")
    second_dismiss_response = staff_client.post(f"/api/billing-handoffs/{pending.id}/dismiss/")

    assert dismiss_response.status_code == 200
    pending.refresh_from_db()
    assert pending.status == BillingHandoff.Status.DISMISSED
    assert pending.dismissed_reason == "No charge"
    assert second_dismiss_response.status_code == 409
    assert second_dismiss_response.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_staff_can_convert_handoff_to_invoice_and_invalid_conversions_are_rejected(
    admin_client,
    staff_client,
    doctor_client,
    billing_handoff_factory,
    appointment_factory,
    visit_factory,
    doctor_user,
):
    handoff = billing_handoff_factory(suggested_amount="180.00", currency=BillingHandoff.Currency.USD)

    for client in (admin_client, doctor_client):
        denied = client.post(
            f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/",
            {"total_amount": "180.00", "currency": "USD"},
            format="json",
        )
        assert denied.status_code == 403
        assert denied.data["code"] == "PERMISSION_DENIED"

    invalid_currency = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/",
        {"total_amount": "180.00", "currency": "EUR"},
        format="json",
    )
    invalid_amount = staff_client.post(
        f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/",
        {"total_amount": "0", "currency": "USD"},
        format="json",
    )
    convert_response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/", {}, format="json")
    duplicate_response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/", {}, format="json")

    assert invalid_currency.status_code == 400
    assert invalid_amount.status_code == 400
    assert convert_response.status_code == 201
    handoff.refresh_from_db()
    invoice = Invoice.objects.get(id=convert_response.data["id"])
    assert invoice.patient_id == handoff.patient_id
    assert invoice.visit_id == handoff.visit_id
    assert invoice.appointment_id == handoff.visit.appointment_id
    assert invoice.billing_handoff_id == handoff.id
    assert invoice.total_amount == handoff.suggested_amount
    assert invoice.currency == "USD"
    assert invoice.status == Invoice.Status.UNPAID
    assert handoff.status == BillingHandoff.Status.CONVERTED_TO_INVOICE
    assert handoff.converted_invoice_id == invoice.id
    assert duplicate_response.status_code == 409
    assert duplicate_response.data["code"] == "BILLING_HANDOFF_ALREADY_CONVERTED"

    dismissed_visit = _completed_visit_for(
        visit_factory,
        appointment_factory,
        doctor_user,
        start_datetime="2026-07-21T13:00:00+03:00",
        end_datetime="2026-07-21T13:30:00+03:00",
    )
    dismissed = billing_handoff_factory(
        visit=dismissed_visit,
        patient=dismissed_visit.patient,
        status=BillingHandoff.Status.DISMISSED,
    )
    dismissed_response = staff_client.post(
        f"/api/billing-handoffs/{dismissed.id}/convert-to-invoice/",
        {"total_amount": "40.00", "currency": "SYP"},
        format="json",
    )
    assert dismissed_response.status_code == 409
    assert dismissed_response.data["code"] == "INVALID_STATUS_TRANSITION"
