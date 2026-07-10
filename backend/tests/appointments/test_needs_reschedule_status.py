import pytest

from apps.scheduling.models import Appointment


@pytest.mark.django_db
def test_needs_reschedule_status_exists_and_serializes(staff_client, appointment_factory):
    appointment = appointment_factory(status=Appointment.Status.NEEDS_RESCHEDULE)

    response = staff_client.get(f"/api/appointments/{appointment.id}/")

    assert response.status_code == 200
    assert response.data["status"] == Appointment.Status.NEEDS_RESCHEDULE
    assert Appointment.Status.NEEDS_RESCHEDULE in Appointment.Status.values
