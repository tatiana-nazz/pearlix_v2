from datetime import timedelta

import pytest
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.scheduling.models import Appointment


pytestmark = pytest.mark.django_db


def test_patient_directory_next_appointment_excludes_needs_reschedule(staff_client, patient, appointment_factory):
    now = timezone.now()
    appointment_factory(
        patient=patient,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime=now + timedelta(days=1),
        end_datetime=now + timedelta(days=1, minutes=30),
    )
    valid = appointment_factory(
        patient=patient,
        status=Appointment.Status.UPCOMING,
        start_datetime=now + timedelta(days=2),
        end_datetime=now + timedelta(days=2, minutes=30),
    )

    response = staff_client.get("/api/patients/")

    assert response.status_code == 200
    row = next(item for item in response.data["results"] if item["id"] == patient.id)
    assert parse_datetime(row["next_appointment_at"]) == valid.start_datetime
