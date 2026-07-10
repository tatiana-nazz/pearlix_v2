from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour
from apps.visits.models import Visit


def today_at(hour):
    base = timezone.localtime(timezone.now()).replace(hour=hour, minute=0, second=0, microsecond=0)
    return base


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("path", "allowed_client", "denied_clients"),
    [
        ("/api/dashboard/admin/", "admin_client", ["staff_client", "doctor_client"]),
        ("/api/dashboard/staff/", "staff_client", ["admin_client", "doctor_client"]),
        ("/api/dashboard/doctor/", "doctor_client", ["admin_client", "staff_client"]),
    ],
)
def test_dashboard_role_permissions(request, api_client, path, allowed_client, denied_clients):
    assert api_client.get(path).status_code == 401

    allowed_response = request.getfixturevalue(allowed_client).get(path)
    assert allowed_response.status_code == 200

    for client_fixture in denied_clients:
        response = request.getfixturevalue(client_fixture).get(path)
        assert response.status_code == 403
        assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_admin_dashboard_returns_supervisory_counts_without_sensitive_fields(
    admin_client,
    doctor_user,
    staff_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    patient = patient_factory(full_name="Dashboard Patient", phone="0911000000")
    checked_in_start = today_at(9)
    checked_in = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime=checked_in_start,
        end_datetime=checked_in_start + timedelta(minutes=30),
    )
    active_visit = visit_factory(
        appointment=checked_in,
        status=Visit.Status.ACTIVE,
        symptoms="Sensitive symptom",
        diagnosis="Sensitive diagnosis",
        treatment="Sensitive treatment",
        clinical_notes="Sensitive clinical note",
    )
    completed_start = today_at(10)
    completed_appointment = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime=completed_start,
        end_datetime=completed_start + timedelta(minutes=30),
    )
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime=today_at(16),
        end_datetime=today_at(16) + timedelta(minutes=30),
    )
    completed_visit = visit_factory(appointment=completed_appointment, status=Visit.Status.COMPLETED, completed_at=timezone.now())
    BillingHandoff.objects.create(
        patient=patient,
        visit=completed_visit,
        doctor=doctor_user,
        status=BillingHandoff.Status.PENDING,
        created_by=doctor_user,
        updated_by=doctor_user,
    )
    Invoice.objects.create(
        invoice_number="INV-DASH-ADMIN-000001",
        patient=patient,
        currency=Invoice.Currency.SYP,
        total_amount="100.00",
        status=Invoice.Status.UNPAID,
        created_by=staff_user,
    )

    response = admin_client.get("/api/dashboard/admin/")

    assert response.status_code == 200
    assert response.data["total_active_patients"] >= 1
    assert response.data["today_appointments_count"] >= 2
    assert response.data["checked_in_appointments_count"] == 1
    assert response.data["needs_reschedule_appointments_count"] == 1
    assert response.data["active_visits_count"] == 1
    assert response.data["pending_billing_handoffs_count"] == 1
    assert response.data["unpaid_invoices_count"] == 1
    payload = str(response.data)
    assert active_visit.clinical_notes not in payload
    assert active_visit.diagnosis not in payload
    assert "/media/" not in payload


@pytest.mark.django_db
def test_staff_dashboard_returns_operational_data_without_external_workspace(
    staff_client,
    doctor_user,
    staff_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    patient = patient_factory(full_name="Staff Dashboard Patient", phone="0912000000")
    upcoming_start = today_at(11)
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime=upcoming_start,
        end_datetime=upcoming_start + timedelta(minutes=30),
    )
    checked_in_start = today_at(12)
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime=checked_in_start,
        end_datetime=checked_in_start + timedelta(minutes=30),
    )
    needs_reschedule = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime=today_at(16),
        end_datetime=today_at(16) + timedelta(minutes=30),
    )
    completed_appointment = appointment_factory(patient=patient, doctor=doctor_user, status=Appointment.Status.COMPLETED)
    completed_visit = visit_factory(appointment=completed_appointment, status=Visit.Status.COMPLETED)
    BillingHandoff.objects.create(
        patient=patient,
        visit=completed_visit,
        doctor=doctor_user,
        status=BillingHandoff.Status.PENDING,
        created_by=doctor_user,
        updated_by=doctor_user,
    )
    Invoice.objects.create(
        invoice_number="INV-DASH-STAFF-000001",
        patient=patient,
        currency=Invoice.Currency.SYP,
        total_amount="80.00",
        status=Invoice.Status.PARTIALLY_PAID,
        created_by=staff_user,
    )
    own_leave = AvailabilityException.objects.create(
        staff=staff_user,
        start_datetime=today_at(15),
        end_datetime=today_at(15) + timedelta(hours=1),
        type=AvailabilityException.Type.UNAVAILABLE,
        reason="Personal leave",
        created_by=staff_user,
        updated_by=staff_user,
    )
    doctor_block = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime=today_at(17),
        end_datetime=today_at(17) + timedelta(hours=1),
        type=AvailabilityException.Type.UNAVAILABLE,
        reason="Doctor unavailable",
        created_by=staff_user,
        updated_by=staff_user,
    )

    response = staff_client.get("/api/dashboard/staff/")

    assert response.status_code == 200
    assert response.data["today_appointments_count"] >= 2
    assert len(response.data["upcoming_today_appointments"]) == 1
    assert len(response.data["checked_in_appointments"]) == 1
    assert [item["id"] for item in response.data["needs_reschedule_appointments"]] == [needs_reschedule.id]
    assert len(response.data["pending_billing_handoffs"]) == 1
    assert len(response.data["unpaid_or_partially_paid_invoices"]) == 1
    assert response.data["recent_patients"][0]["full_name"] == "Staff Dashboard Patient"
    assert response.data["own_working_schedule"] == []
    assert [item["id"] for item in response.data["own_availability_exceptions"]] == [own_leave.id]
    assert doctor_block.id in {item["id"] for item in response.data["doctor_unavailable_exceptions"]}
    payload = str(response.data).lower()
    assert "external_xray" not in payload
    assert "clinical_notes" not in payload
    assert "/media/" not in payload


@pytest.mark.django_db
def test_doctor_dashboard_is_scoped_to_requesting_doctor(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    own_patient = patient_factory(full_name="Own Dashboard Patient", phone="0913000000")
    other_patient = patient_factory(full_name="Other Dashboard Patient", phone="0913000001")
    own_start = today_at(13)
    own_appointment = appointment_factory(
        patient=own_patient,
        doctor=doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime=own_start,
        end_datetime=own_start + timedelta(minutes=30),
    )
    own_active_visit = visit_factory(appointment=own_appointment, status=Visit.Status.ACTIVE, clinical_notes="Do not leak note")
    other_start = today_at(14)
    other_appointment = appointment_factory(
        patient=other_patient,
        doctor=other_doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime=other_start,
        end_datetime=other_start + timedelta(minutes=30),
    )
    visit_factory(appointment=other_appointment, status=Visit.Status.ACTIVE, clinical_notes="Other doctor note")
    completed_appointment = appointment_factory(
        patient=own_patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime=today_at(15),
        end_datetime=today_at(15) + timedelta(minutes=30),
    )
    needs_reschedule = appointment_factory(
        patient=own_patient,
        doctor=doctor_user,
        status=Appointment.Status.NEEDS_RESCHEDULE,
        start_datetime=today_at(16),
        end_datetime=today_at(16) + timedelta(minutes=30),
    )
    completed_visit = visit_factory(appointment=completed_appointment, status=Visit.Status.COMPLETED, completed_at=timezone.now())
    BillingHandoff.objects.create(
        patient=own_patient,
        visit=completed_visit,
        doctor=doctor_user,
        status=BillingHandoff.Status.PENDING,
        created_by=doctor_user,
        updated_by=doctor_user,
    )
    schedule = WorkingHour.objects.create(doctor=doctor_user, weekday=0, start_time="09:00", end_time="13:00")
    own_leave = AvailabilityException.objects.create(
        doctor=doctor_user,
        start_datetime=today_at(17),
        end_datetime=today_at(17) + timedelta(hours=1),
        type=AvailabilityException.Type.UNAVAILABLE,
        reason="Own leave",
        created_by=doctor_user,
        updated_by=doctor_user,
    )
    AvailabilityException.objects.create(
        doctor=other_doctor_user,
        start_datetime=today_at(18),
        end_datetime=today_at(18) + timedelta(hours=1),
        type=AvailabilityException.Type.UNAVAILABLE,
        reason="Other doctor leave",
        created_by=other_doctor_user,
        updated_by=other_doctor_user,
    )

    response = doctor_client.get("/api/dashboard/doctor/")

    assert response.status_code == 200
    appointment_ids = {item["id"] for item in response.data["today_own_appointments"]}
    assert own_appointment.id in appointment_ids
    assert other_appointment.id not in appointment_ids
    assert response.data["own_active_visit"]["id"] == own_active_visit.id
    assert response.data["own_completed_visits_today_count"] == 1
    assert [item["id"] for item in response.data["own_needs_reschedule_appointments"]] == [needs_reschedule.id]
    assert len(response.data["own_pending_billing_handoffs"]) == 1
    assert [item["id"] for item in response.data["own_working_schedule"]] == [schedule.id]
    assert [item["id"] for item in response.data["own_availability_exceptions"]] == [own_leave.id]
    payload = str(response.data)
    assert "Other Dashboard Patient" not in payload
    assert "Other doctor note" not in payload
    assert "Other doctor leave" not in payload
    assert "Do not leak note" not in payload
    assert "invoice" not in payload.lower()
    assert "/media/" not in payload
