import pytest

from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


@pytest.mark.django_db
def test_wf_008_billing_handoff_to_invoice_payment_workflow(admin_client, staff_client, doctor_client, doctor_user):
    WorkingShift.objects.create(employee=doctor_user, name="Test shift", weekday=0, start_time="09:00", end_time="15:00")

    patient_response = staff_client.post(
        "/api/patients/",
        {
            "first_name": "Billing Workflow",
            "last_name": "Patient",
            "phone_number": "0988000000",
            "gender": "Female",
        },
        format="json",
    )
    assert patient_response.status_code == 201

    appointment_response = staff_client.post(
        "/api/appointments/",
        {
            "patient_id": patient_response.data["id"],
            "doctor_id": doctor_user.id,
            "start_datetime": "2026-07-20T11:00:00+03:00",
            "duration_minutes": 30,
            "reason": "Billing workflow",
        },
        format="json",
    )
    assert appointment_response.status_code == 201

    appointment_id = appointment_response.data["id"]
    check_in_response = staff_client.post(f"/api/appointments/{appointment_id}/check-in/")
    start_response = doctor_client.post(f"/api/appointments/{appointment_id}/start-visit/")
    visit_id = start_response.data["id"]
    notes_response = doctor_client.patch(f"/api/visits/{visit_id}/clinical-notes/", {"treatment": "Exam"}, format="json")
    complete_response = doctor_client.post(
        f"/api/visits/{visit_id}/complete/",
        {
            "version": notes_response.data["updated_at"],
            "notes": {"treatment": "Exam"},
            "billing_handoff": {
                "description": "Exam",
                "note": "Invoice after exam",
                "suggested_amount": "75.00",
                "currency": "SYP",
            },
        },
        format="json",
    )

    assert check_in_response.status_code == 200
    assert check_in_response.data["status"] == Appointment.Status.CHECKED_IN
    assert start_response.status_code == 201
    assert notes_response.status_code == 200
    assert complete_response.status_code == 200
    assert complete_response.data["visit"]["status"] == Visit.Status.COMPLETED
    assert complete_response.data["billing_handoff"]["status"] == BillingHandoff.Status.PENDING

    handoff_id = complete_response.data["billing_handoff"]["id"]
    invoice_response = staff_client.post(f"/api/billing-handoffs/{handoff_id}/convert-to-invoice/", {}, format="json")
    assert invoice_response.status_code == 201
    assert invoice_response.data["status"] == Invoice.Status.UNPAID
    assert invoice_response.data["total_amount"] == "75.00"

    invoice_id = invoice_response.data["id"]
    payment_response = staff_client.post(f"/api/invoices/{invoice_id}/payments/", {"amount": "75.00", "currency": "SYP"}, format="json")
    doctor_invoice_response = doctor_client.get(f"/api/invoices/{invoice_id}/")
    admin_invoice_response = admin_client.get(f"/api/invoices/{invoice_id}/")
    admin_mutation_response = admin_client.post(f"/api/invoices/{invoice_id}/payments/", {"amount": "1.00", "currency": "SYP"}, format="json")

    assert payment_response.status_code == 201
    assert payment_response.data["invoice"]["status"] == Invoice.Status.PAID
    assert payment_response.data["invoice"]["paid_amount"] == "75.00"
    assert payment_response.data["invoice"]["remaining_amount"] == "0.00"
    assert doctor_invoice_response.status_code == 403
    assert admin_invoice_response.status_code == 200
    assert admin_mutation_response.status_code == 403

    handoff = BillingHandoff.objects.get(id=handoff_id)
    invoice = Invoice.objects.get(id=invoice_id)
    assert handoff.status == BillingHandoff.Status.CONVERTED_TO_INVOICE
    assert handoff.converted_invoice_id == invoice.id
    assert invoice.status == Invoice.Status.PAID
    assert invoice.billing_handoff_id == handoff.id
