from decimal import Decimal

import pytest
from django.utils import timezone

from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice, InvoiceSequence, Payment
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/invoices/"),
        ("post", "/api/invoices/"),
        ("get", "/api/invoices/{invoice_id}/"),
        ("patch", "/api/invoices/{invoice_id}/"),
        ("post", "/api/invoices/{invoice_id}/cancel/"),
        ("get", "/api/invoices/{invoice_id}/print-data/"),
        ("get", "/api/invoices/{invoice_id}/payments/"),
        ("post", "/api/invoices/{invoice_id}/payments/"),
    ],
)
def test_unauthenticated_user_cannot_access_invoice_and_payment_endpoints(api_client, invoice_factory, method, path):
    invoice = invoice_factory()

    response = getattr(api_client, method)(
        path.format(invoice_id=invoice.id),
        {"amount": "10.00", "currency": invoice.currency},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_invoice_role_permissions(admin_client, staff_client, doctor_client, invoice_factory, patient):
    read_invoice = invoice_factory(total_amount="200.00")
    cancel_invoice = invoice_factory(invoice_number="INV-CANCEL-000001", total_amount="50.00")
    mutate_invoice = invoice_factory(invoice_number="INV-MUTATE-000001", total_amount="60.00")

    assert admin_client.get("/api/invoices/").status_code == 200
    assert admin_client.get(f"/api/invoices/{read_invoice.id}/").status_code == 200
    assert admin_client.get(f"/api/invoices/{read_invoice.id}/print-data/").status_code == 200
    assert admin_client.get(f"/api/invoices/{read_invoice.id}/payments/").status_code == 200
    assert admin_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "20.00", "currency": "SYP"}, format="json").status_code == 403
    assert admin_client.patch(f"/api/invoices/{read_invoice.id}/", {"notes": "Admin edit"}, format="json").status_code == 403
    assert admin_client.post(f"/api/invoices/{read_invoice.id}/cancel/").status_code == 403
    assert admin_client.post(f"/api/invoices/{read_invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json").status_code == 403

    staff_create = staff_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "90.00", "currency": "SYP"}, format="json")
    staff_update = staff_client.patch(f"/api/invoices/{mutate_invoice.id}/", {"notes": "Updated"}, format="json")
    staff_cancel = staff_client.post(f"/api/invoices/{cancel_invoice.id}/cancel/", {"cancelled_reason": "Void"}, format="json")
    staff_print = staff_client.get(f"/api/invoices/{read_invoice.id}/print-data/")

    assert staff_client.get("/api/invoices/").status_code == 200
    assert staff_client.get(f"/api/invoices/{read_invoice.id}/").status_code == 200
    assert staff_create.status_code == 201
    assert staff_update.status_code == 200
    assert staff_cancel.status_code == 200
    assert staff_print.status_code == 200

    for method, path in [
        ("get", "/api/invoices/"),
        ("post", "/api/invoices/"),
        ("get", f"/api/invoices/{read_invoice.id}/"),
        ("patch", f"/api/invoices/{read_invoice.id}/"),
        ("post", f"/api/invoices/{read_invoice.id}/cancel/"),
        ("get", f"/api/invoices/{read_invoice.id}/print-data/"),
        ("post", f"/api/invoices/{read_invoice.id}/payments/"),
    ]:
        response = getattr(doctor_client, method)(path, {"patient_id": patient.id, "total_amount": "10.00", "currency": "SYP"}, format="json")
        assert response.status_code == 403
        assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_connected_doctor_still_cannot_access_invoices_or_payments(doctor_client, doctor_user, patient, appointment_factory, invoice_factory):
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T11:00:00+03:00",
        end_datetime="2026-07-25T11:30:00+03:00",
    )
    invoice = invoice_factory(patient=patient, total_amount="75.00")

    responses = [
        doctor_client.get("/api/invoices/"),
        doctor_client.get(f"/api/invoices/{invoice.id}/"),
        doctor_client.get(f"/api/invoices/{invoice.id}/payments/"),
        doctor_client.get(f"/api/invoices/{invoice.id}/print-data/"),
    ]

    assert all(response.status_code == 403 for response in responses)


@pytest.mark.django_db
def test_staff_can_create_invoice_and_frontend_calculated_fields_are_rejected(staff_client, staff_user, patient):
    response = staff_client.post(
        "/api/invoices/",
        {
            "patient_id": patient.id,
            "total_amount": "150.00",
            "currency": "SYP",
            "notes": "Simple invoice",
        },
        format="json",
    )

    assert response.status_code == 201
    invoice = Invoice.objects.get(id=response.data["id"])
    assert invoice.created_by_id == staff_user.id
    assert invoice.invoice_number.startswith("INV-")
    assert response.data["status"] == Invoice.Status.UNPAID
    assert response.data["paid_amount"] == "0.00"
    assert response.data["remaining_amount"] == "150.00"

    blocked_response = staff_client.post(
        "/api/invoices/",
        {
            "patient_id": patient.id,
            "total_amount": "150.00",
            "currency": "SYP",
            "status": Invoice.Status.PAID,
            "paid_amount": "150.00",
            "remaining_amount": "0.00",
            "invoice_number": "CLIENT-SHOULD-NOT-WIN",
        },
        format="json",
    )
    assert blocked_response.status_code == 400
    assert blocked_response.data["code"] == "VALIDATION_ERROR"
    assert "status" in blocked_response.data["details"]
    assert "invoice_number" in blocked_response.data["details"]


@pytest.mark.django_db
def test_invoice_create_validation(staff_client, patient, patient_factory, appointment_factory, visit_factory, other_doctor_user):
    other_patient = patient_factory(full_name="Other Patient", phone="0977000000")
    other_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-22T09:00:00+03:00",
        end_datetime="2026-07-22T09:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.COMPLETED)

    cases = [
        ({}, "patient_id"),
        ({"patient_id": 99999, "total_amount": "20.00", "currency": "SYP"}, "patient_id"),
        ({"patient_id": patient.id, "visit_id": 99999, "total_amount": "20.00", "currency": "SYP"}, "visit_id"),
        ({"patient_id": patient.id, "appointment_id": 99999, "total_amount": "20.00", "currency": "SYP"}, "appointment_id"),
        ({"patient_id": patient.id, "total_amount": "0", "currency": "SYP"}, "total_amount"),
        ({"patient_id": patient.id, "total_amount": "20.00", "currency": "EUR"}, "currency"),
        ({"patient_id": patient.id, "visit_id": other_visit.id, "total_amount": "20.00", "currency": "SYP"}, "visit_id"),
        ({"patient_id": patient.id, "appointment_id": other_appointment.id, "total_amount": "20.00", "currency": "SYP"}, "appointment_id"),
    ]

    for payload, field in cases:
        response = staff_client.post("/api/invoices/", payload, format="json")
        assert response.status_code == 400
        assert response.data["code"] == "VALIDATION_ERROR"
        assert field in response.data["details"]


@pytest.mark.django_db
def test_invoice_numbers_are_unique(staff_client, patient):
    first = staff_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "100.00", "currency": "SYP"}, format="json")
    second = staff_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "120.00", "currency": "SYP"}, format="json")
    prefix = timezone.localdate().strftime("INV-%Y%m%d-")
    scope = timezone.localdate().strftime("%Y%m%d")

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.data["invoice_number"] != second.data["invoice_number"]
    assert first.data["invoice_number"] == f"{prefix}000001"
    assert second.data["invoice_number"] == f"{prefix}000002"
    assert Invoice.objects.filter(invoice_number=first.data["invoice_number"]).exists()
    assert Invoice.objects.filter(invoice_number=second.data["invoice_number"]).exists()
    assert InvoiceSequence.objects.get(scope=scope).last_number == 2


@pytest.mark.django_db
def test_invoice_sequence_continues_from_preexisting_sequence_row(staff_client, patient):
    scope = timezone.localdate().strftime("%Y%m%d")
    prefix = timezone.localdate().strftime("INV-%Y%m%d-")
    InvoiceSequence.objects.create(scope=scope, last_number=41)

    response = staff_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "100.00", "currency": "SYP"}, format="json")

    assert response.status_code == 201
    assert response.data["invoice_number"] == f"{prefix}000042"
    assert InvoiceSequence.objects.get(scope=scope).last_number == 42


@pytest.mark.django_db
def test_handoff_conversion_uses_sequence_generated_invoice_number(staff_client, billing_handoff_factory):
    handoff = billing_handoff_factory(suggested_amount="180.00", currency=BillingHandoff.Currency.SYP)
    prefix = timezone.localdate().strftime("INV-%Y%m%d-")
    scope = timezone.localdate().strftime("%Y%m%d")

    response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/", {}, format="json")

    assert response.status_code == 201
    assert response.data["invoice_number"] == f"{prefix}000001"
    assert InvoiceSequence.objects.get(scope=scope).last_number == 1


@pytest.mark.django_db
def test_invoice_list_filters(staff_client, invoice_factory, patient, patient_factory, appointment_factory, visit_factory):
    other_patient = patient_factory(full_name="Filter Patient", phone="0977111111")
    appointment = appointment_factory(patient=other_patient, status=Appointment.Status.COMPLETED)
    visit = visit_factory(appointment=appointment, status=Visit.Status.COMPLETED)
    first = invoice_factory(patient=patient, total_amount="100.00", currency=Invoice.Currency.SYP)
    second = invoice_factory(
        invoice_number="INV-FILTER-000001",
        patient=other_patient,
        appointment=appointment,
        visit=visit,
        total_amount="80.00",
        currency=Invoice.Currency.USD,
        status=Invoice.Status.PARTIALLY_PAID,
    )

    assert staff_client.get(f"/api/invoices/?status={Invoice.Status.UNPAID}").data["results"][0]["id"] == first.id
    assert staff_client.get(f"/api/invoices/?patient_id={other_patient.id}").data["results"][0]["id"] == second.id
    assert staff_client.get(f"/api/invoices/?visit_id={visit.id}").data["results"][0]["id"] == second.id
    assert staff_client.get(f"/api/invoices/?appointment_id={appointment.id}").data["results"][0]["id"] == second.id
    assert staff_client.get("/api/invoices/?currency=USD").data["results"][0]["id"] == second.id


@pytest.mark.django_db
def test_invoice_detail_includes_the_appointment_doctor(staff_client, invoice_factory, patient, appointment_factory, other_doctor_user):
    appointment = appointment_factory(patient=patient, doctor=other_doctor_user, status=Appointment.Status.COMPLETED)
    invoice = invoice_factory(patient=patient, appointment=appointment)

    response = staff_client.get(f"/api/invoices/{invoice.id}/")

    assert response.status_code == 200
    assert response.data["appointment"]["doctor"]["id"] == other_doctor_user.id
    assert response.data["appointment"]["doctor"]["full_name"] == other_doctor_user.full_name


@pytest.mark.django_db
def test_staff_can_update_non_cancelled_invoice_and_restricted_updates_are_rejected(staff_client, invoice_factory):
    invoice = invoice_factory(total_amount="100.00")

    notes_response = staff_client.patch(f"/api/invoices/{invoice.id}/", {"notes": "Updated note"}, format="json")
    total_response = staff_client.patch(f"/api/invoices/{invoice.id}/", {"total_amount": "120.00"}, format="json")
    status_response = staff_client.patch(f"/api/invoices/{invoice.id}/", {"status": Invoice.Status.PAID}, format="json")

    assert notes_response.status_code == 200
    assert notes_response.data["notes"] == "Updated note"
    assert total_response.status_code == 200
    assert total_response.data["total_amount"] == "120.00"
    assert status_response.status_code == 400
    assert status_response.data["code"] == "VALIDATION_ERROR"

    payment_response = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "20.00", "currency": "SYP"}, format="json")
    currency_after_payment = staff_client.patch(f"/api/invoices/{invoice.id}/", {"currency": "USD"}, format="json")
    total_after_payment = staff_client.patch(f"/api/invoices/{invoice.id}/", {"total_amount": "130.00"}, format="json")

    assert payment_response.status_code == 201
    assert currency_after_payment.status_code == 409
    assert currency_after_payment.data["code"] == "INVALID_STATUS_TRANSITION"
    assert total_after_payment.status_code == 409
    assert total_after_payment.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_handoff_invoice_locks_source_relationships_before_payment_but_allows_editable_fields(
    staff_client,
    billing_handoff_factory,
    patient_factory,
    appointment_factory,
    visit_factory,
    other_doctor_user,
):
    handoff = billing_handoff_factory(suggested_amount="180.00", currency=BillingHandoff.Currency.SYP)
    convert_response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/", {}, format="json")
    invoice = Invoice.objects.get(id=convert_response.data["id"])
    other_patient = patient_factory(full_name="Locked Invoice Patient", phone="0977444444")
    other_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-26T09:00:00+03:00",
        end_datetime="2026-07-26T09:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.COMPLETED)

    blocked_patient = staff_client.patch(f"/api/invoices/{invoice.id}/", {"patient_id": other_patient.id}, format="json")
    blocked_visit = staff_client.patch(f"/api/invoices/{invoice.id}/", {"visit_id": other_visit.id}, format="json")
    blocked_appointment = staff_client.patch(f"/api/invoices/{invoice.id}/", {"appointment_id": other_appointment.id}, format="json")
    blocked_handoff = staff_client.patch(f"/api/invoices/{invoice.id}/", {"billing_handoff_id": handoff.id}, format="json")
    editable = staff_client.patch(
        f"/api/invoices/{invoice.id}/",
        {"total_amount": "200.00", "currency": "USD", "notes": "Adjusted before payment"},
        format="json",
    )

    assert convert_response.status_code == 201
    for response, field in (
        (blocked_patient, "patient_id"),
        (blocked_visit, "visit_id"),
        (blocked_appointment, "appointment_id"),
    ):
        assert response.status_code == 409
        assert response.data["code"] == "INVALID_STATUS_TRANSITION"
        assert field in response.data["details"]
    assert blocked_handoff.status_code == 400
    assert blocked_handoff.data["code"] == "VALIDATION_ERROR"
    assert "billing_handoff_id" in blocked_handoff.data["details"]
    assert editable.status_code == 200
    invoice.refresh_from_db()
    assert invoice.patient_id == handoff.patient_id
    assert invoice.visit_id == handoff.visit_id
    assert invoice.appointment_id == handoff.visit.appointment_id
    assert invoice.billing_handoff_id == handoff.id
    assert invoice.total_amount == Decimal("200.00")
    assert invoice.currency == Invoice.Currency.USD
    assert invoice.notes == "Adjusted before payment"


@pytest.mark.django_db
def test_invoice_payment_locks_amount_currency_and_relationships(
    staff_client,
    invoice_factory,
    patient_factory,
    appointment_factory,
    visit_factory,
    other_doctor_user,
):
    invoice = invoice_factory(total_amount="100.00", currency=Invoice.Currency.SYP)
    other_patient = patient_factory(full_name="Paid Locked Patient", phone="0977555555")
    other_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-26T10:00:00+03:00",
        end_datetime="2026-07-26T10:30:00+03:00",
    )
    other_visit = visit_factory(appointment=other_appointment, status=Visit.Status.COMPLETED)

    payment_response = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "25.00", "currency": "SYP"}, format="json")
    blocked_cases = (
        ({"total_amount": "120.00"}, "total_amount"),
        ({"currency": "USD"}, "currency"),
        ({"patient_id": other_patient.id}, "patient_id"),
        ({"visit_id": other_visit.id}, "visit_id"),
        ({"appointment_id": other_appointment.id}, "appointment_id"),
    )

    assert payment_response.status_code == 201
    for payload, field in blocked_cases:
        response = staff_client.patch(f"/api/invoices/{invoice.id}/", payload, format="json")
        assert response.status_code == 409
        assert response.data["code"] == "INVALID_STATUS_TRANSITION"
        assert field in response.data["details"]
    invoice.refresh_from_db()
    assert invoice.total_amount == Decimal("100.00")
    assert invoice.currency == Invoice.Currency.SYP
    assert invoice.patient_id != other_patient.id
    assert invoice.visit_id is None
    assert invoice.appointment_id is None


@pytest.mark.django_db
def test_handoff_invoice_payment_locks_notes_and_does_not_emit_update_audit_for_failed_attempt(
    staff_client,
    billing_handoff_factory,
):
    handoff = billing_handoff_factory(suggested_amount="90.00", currency=BillingHandoff.Currency.SYP)
    convert_response = staff_client.post(f"/api/billing-handoffs/{handoff.id}/convert-to-invoice/", {}, format="json")
    invoice = Invoice.objects.get(id=convert_response.data["id"])
    payment_response = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json")
    before_count = ActivityLog.objects.filter(action="invoice_updated", entity_id=str(invoice.id)).count()

    response = staff_client.patch(f"/api/invoices/{invoice.id}/", {"notes": "Too late"}, format="json")

    assert convert_response.status_code == 201
    assert payment_response.status_code == 201
    assert response.status_code == 409
    assert response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert "notes" in response.data["details"]
    invoice.refresh_from_db()
    assert invoice.notes == ""
    assert ActivityLog.objects.filter(action="invoice_updated", entity_id=str(invoice.id)).count() == before_count


@pytest.mark.django_db
def test_invoice_cancel_rules_and_cancelled_invoice_lock(staff_client, invoice_factory):
    cancellable = invoice_factory(total_amount="100.00")
    paid = invoice_factory(invoice_number="INV-PAID-000001", total_amount="30.00")

    cancel_response = staff_client.post(f"/api/invoices/{cancellable.id}/cancel/", {"cancelled_reason": "Patient requested"}, format="json")
    update_cancelled = staff_client.patch(f"/api/invoices/{cancellable.id}/", {"notes": "Should fail"}, format="json")
    payment_cancelled = staff_client.post(f"/api/invoices/{cancellable.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json")
    second_cancel = staff_client.post(f"/api/invoices/{cancellable.id}/cancel/")

    assert cancel_response.status_code == 200
    assert cancel_response.data["status"] == Invoice.Status.CANCELLED
    assert update_cancelled.status_code == 409
    assert update_cancelled.data["code"] == "INVOICE_CANCELLED"
    assert payment_cancelled.status_code == 409
    assert payment_cancelled.data["code"] == "INVOICE_CANCELLED"
    assert second_cancel.status_code == 409
    assert second_cancel.data["code"] == "INVALID_STATUS_TRANSITION"

    full_payment = staff_client.post(f"/api/invoices/{paid.id}/payments/", {"amount": "30.00", "currency": "SYP"}, format="json")
    cancel_paid = staff_client.post(f"/api/invoices/{paid.id}/cancel/")
    assert full_payment.status_code == 201
    assert cancel_paid.status_code == 409
    assert cancel_paid.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_payments_calculate_invoice_status_totals_and_reject_invalid_payment_input(staff_client, admin_client, doctor_client, invoice_factory):
    invoice = invoice_factory(total_amount="100.00", currency=Invoice.Currency.SYP)

    admin_denied = admin_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json")
    doctor_denied = doctor_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json")
    bad_amount = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "0", "currency": "SYP"}, format="json")
    mismatch = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "USD"}, format="json")

    partial = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "40.00", "currency": "SYP"}, format="json")
    invoice.refresh_from_db()
    overpay = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "70.00", "currency": "SYP"}, format="json")
    final = staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "60.00", "currency": "SYP"}, format="json")
    invoice.refresh_from_db()

    assert admin_denied.status_code == 403
    assert doctor_denied.status_code == 403
    assert bad_amount.status_code == 400
    assert bad_amount.data["code"] == "VALIDATION_ERROR"
    assert mismatch.status_code == 400
    assert mismatch.data["code"] == "PAYMENT_CURRENCY_MISMATCH"
    assert partial.status_code == 201
    assert partial.data["invoice"]["status"] == Invoice.Status.PARTIALLY_PAID
    assert partial.data["invoice"]["paid_amount"] == "40.00"
    assert partial.data["invoice"]["remaining_amount"] == "60.00"
    assert Payment.objects.get(id=partial.data["payment"]["id"]).payment_date <= timezone.now()
    assert overpay.status_code == 400
    assert overpay.data["code"] == "OVERPAYMENT_NOT_ALLOWED"
    assert final.status_code == 201
    assert final.data["invoice"]["status"] == Invoice.Status.PAID
    assert final.data["invoice"]["paid_amount"] == "100.00"
    assert final.data["invoice"]["remaining_amount"] == "0.00"
    assert invoice.status == Invoice.Status.PAID
    assert invoice.paid_amount == Decimal("100.00")
    assert invoice.remaining_amount == Decimal("0.00")


@pytest.mark.django_db
def test_print_data_includes_safe_invoice_summary(staff_client, admin_client, doctor_client, invoice_factory):
    invoice = invoice_factory(total_amount="100.00", notes="Printable note")
    staff_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "25.00", "currency": "SYP"}, format="json")

    staff_response = staff_client.get(f"/api/invoices/{invoice.id}/print-data/")
    admin_response = admin_client.get(f"/api/invoices/{invoice.id}/print-data/")
    doctor_response = doctor_client.get(f"/api/invoices/{invoice.id}/print-data/")

    assert staff_response.status_code == 200
    assert admin_response.status_code == 200
    assert doctor_response.status_code == 403
    assert staff_response.data["clinic"]["clinic_name"]
    assert staff_response.data["invoice"]["invoice_number"] == invoice.invoice_number
    assert staff_response.data["patient"]["id"] == invoice.patient_id
    assert staff_response.data["currency"] == "SYP"
    assert staff_response.data["total_amount"] == Decimal("100.00")
    assert staff_response.data["paid_amount"] == Decimal("25.00")
    assert staff_response.data["remaining_amount"] == Decimal("75.00")
    assert len(staff_response.data["payments"]) == 1
    assert "email" not in staff_response.data["patient"]
