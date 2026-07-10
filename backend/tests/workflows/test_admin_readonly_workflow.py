import pytest

from apps.billing.models import Invoice


@pytest.mark.django_db
def test_wf_010_admin_operational_actions_are_read_only(admin_client, patient, appointment_factory, active_visit, invoice_factory):
    invoice = invoice_factory(patient=patient, total_amount="40.00", status=Invoice.Status.UNPAID)

    denied_responses = [
        admin_client.post("/api/patients/", {"full_name": "Blocked", "phone": "0900000000", "gender": "UNSPECIFIED"}, format="json"),
        admin_client.patch(f"/api/patients/{patient.id}/", {"full_name": "Blocked"}, format="json"),
        admin_client.post(
            "/api/appointments/",
            {
                "patient_id": patient.id,
                "doctor_id": active_visit.doctor_id,
                "start_datetime": "2026-07-20T14:00:00+03:00",
                "duration_minutes": 30,
            },
            format="json",
        ),
        admin_client.post(f"/api/appointments/{active_visit.appointment_id}/check-in/"),
        admin_client.post(f"/api/appointments/{active_visit.appointment_id}/start-visit/"),
        admin_client.patch(f"/api/visits/{active_visit.id}/clinical-notes/", {"symptoms": "Blocked"}, format="json"),
        admin_client.post("/api/invoices/", {"patient_id": patient.id, "total_amount": "50.00", "currency": "SYP"}, format="json"),
        admin_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "10.00", "currency": "SYP"}, format="json"),
    ]

    assert all(response.status_code == 403 for response in denied_responses)
    assert admin_client.get(f"/api/patients/{patient.id}/").status_code == 200
    assert admin_client.get(f"/api/appointments/{active_visit.appointment_id}/").status_code == 200
    assert admin_client.get(f"/api/visits/{active_visit.id}/").status_code == 200
    assert admin_client.get(f"/api/invoices/{invoice.id}/").status_code == 200
