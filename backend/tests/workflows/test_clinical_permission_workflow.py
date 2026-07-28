import pytest

from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


@pytest.mark.django_db
def test_wf_004_clinical_permission_workflow(admin_client, staff_client, doctor_client, doctor_user):
    WorkingShift.objects.create(employee=doctor_user, name="Test shift", weekday=0, start_time="09:00", end_time="15:00")

    patient_response = staff_client.post(
        "/api/patients/",
        {
            "first_name": "Workflow",
            "last_name": "Patient",
            "phone_number": "0966000000",
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
            "start_datetime": "2026-07-20T10:00:00+03:00",
            "duration_minutes": 30,
            "reason": "Clinical workflow",
        },
        format="json",
    )
    assert appointment_response.status_code == 201

    appointment_id = appointment_response.data["id"]
    check_in_response = staff_client.post(f"/api/appointments/{appointment_id}/check-in/")
    assert check_in_response.status_code == 200
    assert check_in_response.data["status"] == Appointment.Status.CHECKED_IN

    start_response = doctor_client.post(f"/api/appointments/{appointment_id}/start-visit/")
    assert start_response.status_code == 201
    visit_id = start_response.data["id"]

    staff_notes_response = staff_client.patch(f"/api/visits/{visit_id}/clinical-notes/", {"symptoms": "Staff edit"}, format="json")
    admin_notes_response = admin_client.patch(f"/api/visits/{visit_id}/clinical-notes/", {"symptoms": "Admin edit"}, format="json")
    doctor_notes_response = doctor_client.patch(
        f"/api/visits/{visit_id}/clinical-notes/",
        {
            "symptoms": "Pain",
            "diagnosis": "Suspected caries",
            "treatment": "Clinical exam",
            "follow_up_notes": "Follow up",
        },
        format="json",
    )

    assert staff_notes_response.status_code == 403
    assert admin_notes_response.status_code == 403
    assert doctor_notes_response.status_code == 200
    assert doctor_notes_response.data["symptoms"] == "Pain"

    complete_response = doctor_client.post(
        f"/api/visits/{visit_id}/complete/",
        {
            "version": doctor_notes_response.data["updated_at"],
            "notes": {
                "symptoms": "Pain",
                "diagnosis": "Suspected caries",
                "treatment": "Clinical exam",
                "follow_up_notes": "Follow up",
            },
            "billing_handoff": {
                "description": "Clinical exam",
                "suggested_amount": "50.00",
                "currency": "SYP",
                "note": "",
            },
        },
        format="json",
    )
    assert complete_response.status_code == 200
    assert complete_response.data["visit"]["status"] == Visit.Status.COMPLETED

    completed_notes_response = doctor_client.patch(
        f"/api/visits/{visit_id}/clinical-notes/",
        {"follow_up_notes": "Completed visit notes remain editable"},
        format="json",
    )
    assert completed_notes_response.status_code == 200
    assert completed_notes_response.data["follow_up_notes"] == "Completed visit notes remain editable"
