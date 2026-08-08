import pytest

from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


@pytest.mark.django_db
def test_wf_008_visit_bill_then_multiple_payment_invoices(admin_client, staff_client, doctor_client, doctor_user):
    WorkingShift.objects.create(employee=doctor_user, name="Test shift", weekday=0, start_time="09:00", end_time="15:00")
    patient = staff_client.post("/api/patients/", {"first_name": "Billing Workflow", "last_name": "Patient", "phone_number": "0988000000", "gender": "Female"}, format="json")
    appointment = staff_client.post("/api/appointments/", {"patient_id": patient.data["id"], "doctor_id": doctor_user.id, "start_datetime": "2026-07-20T11:00:00+03:00", "duration_minutes": 30, "reason": "Billing workflow"}, format="json")
    appointment_id = appointment.data["id"]
    assert staff_client.post(f"/api/appointments/{appointment_id}/check-in/").status_code == 200
    started = doctor_client.post(f"/api/appointments/{appointment_id}/start-visit/")
    visit_id = started.data["id"]
    notes = doctor_client.patch(f"/api/visits/{visit_id}/clinical-notes/", {"treatment": "Exam"}, format="json")
    completed = doctor_client.post(f"/api/visits/{visit_id}/complete/", {"version": notes.data["updated_at"], "notes": {"treatment": "Exam"}, "billing": {"description": "Exam", "note": "Collect at reception", "total_amount": "75.00", "currency": "SYP"}}, format="json")
    assert completed.status_code == 200
    handoff_id = completed.data["created_handoff"]["id"]
    assert completed.data["created_handoff"]["status"] == BillingHandoff.Status.OPEN
    assert completed.data["created_handoff"]["invoice_count"] == 0

    first = staff_client.post(f"/api/billing-handoffs/{handoff_id}/invoices/", {"amount": "25.00"}, format="json")
    second = staff_client.post(f"/api/billing-handoffs/{handoff_id}/invoices/", {"amount": "50.00"}, format="json")
    assert first.data["handoff"]["status"] == BillingHandoff.Status.PARTIALLY_PAID
    assert second.data["handoff"]["status"] == BillingHandoff.Status.PAID
    assert Invoice.objects.filter(billing_handoff_id=handoff_id).count() == 2
    invoice_id = second.data["invoice"]["id"]
    assert doctor_client.get(f"/api/invoices/{invoice_id}/").status_code == 403
    assert admin_client.get(f"/api/invoices/{invoice_id}/").status_code == 200
    assert admin_client.post(f"/api/billing-handoffs/{handoff_id}/invoices/", {"amount": "1.00"}, format="json").status_code == 403
    visit = Visit.objects.get(pk=visit_id)
    assert visit.status == Visit.Status.COMPLETED
    assert visit.appointment.status == Appointment.Status.COMPLETED
