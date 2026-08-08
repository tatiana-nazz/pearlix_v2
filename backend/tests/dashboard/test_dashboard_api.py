from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.clinic.models import ClinicSettings
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


pytestmark = pytest.mark.django_db


def clinic_clock():
    settings = ClinicSettings.get_solo()
    clinic_timezone = ZoneInfo(settings.timezone)
    return clinic_timezone, timezone.localtime(timezone.now(), clinic_timezone).date()


def clinic_at(day_offset=0, hour=9, minute=0):
    clinic_timezone, today = clinic_clock()
    day = today + timedelta(days=day_offset)
    return timezone.make_aware(datetime.combine(day, time(hour, minute)), clinic_timezone)


def appointment_at(appointment_factory, *, day_offset=0, hour=9, minute=0, **overrides):
    start = clinic_at(day_offset, hour, minute)
    return appointment_factory(start_datetime=start, end_datetime=start + timedelta(minutes=30), **overrides)


def invoice_for(patient, staff_user, *, number, currency="SYP", amount="100.00", status=Invoice.Status.UNPAID, day_offset=0):
    invoice = Invoice.objects.create(
        invoice_number=number,
        patient=patient,
        description="Dashboard invoice",
        currency=currency,
        total_amount=amount,
        status=status,
        cancelled_at=clinic_at(day_offset, 12) if status == Invoice.Status.CANCELLED else None,
        created_by=staff_user,
    )
    Invoice.objects.filter(pk=invoice.pk).update(created_at=clinic_at(day_offset, 10))
    invoice.refresh_from_db()
    return invoice


def pending_handoff(patient, doctor, appointment_factory, visit_factory):
    appointment = appointment_at(
        appointment_factory,
        day_offset=-2,
        doctor=doctor,
        patient=patient,
        status=Appointment.Status.COMPLETED,
    )
    visit = visit_factory(appointment=appointment, status=Visit.Status.COMPLETED)
    return BillingHandoff.objects.create(
        patient=patient,
        visit=visit,
        doctor=doctor,
        status=BillingHandoff.Status.PENDING,
        created_by=doctor,
        updated_by=doctor,
    )


def test_admin_endpoint_allows_admin(admin_client):
    response = admin_client.get("/api/dashboard/admin/")
    assert response.status_code == 200
    assert response.data["clinic_date"] == clinic_clock()[1].isoformat()


@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_admin_endpoint_denies_non_admin(request, client_fixture):
    response = request.getfixturevalue(client_fixture).get("/api/dashboard/admin/")
    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


def test_admin_today_count_uses_clinic_local_boundaries(admin_client, appointment_factory):
    appointment_at(appointment_factory, day_offset=-1, hour=23, minute=59)
    appointment_at(appointment_factory, hour=0)
    appointment_at(appointment_factory, hour=23, minute=59)
    appointment_at(appointment_factory, day_offset=1, hour=0)
    assert admin_client.get("/api/dashboard/admin/").data["today_appointments_count"] == 2


def test_admin_today_list_uses_same_clinic_day(admin_client, appointment_factory):
    included = appointment_at(appointment_factory, hour=8)
    appointment_at(appointment_factory, day_offset=-1, hour=23)
    response = admin_client.get("/api/dashboard/admin/")
    assert [item["id"] for item in response.data["today_appointments"]] == [included.id]


def test_admin_active_visit_count_is_exact(admin_client, visit_factory, appointment_factory, other_doctor_user):
    visit_factory(status=Visit.Status.ACTIVE)
    other_appointment = appointment_at(appointment_factory, doctor=other_doctor_user, hour=10, status=Appointment.Status.ACTIVE)
    visit_factory(appointment=other_appointment, status=Visit.Status.ACTIVE)
    visit_factory(status=Visit.Status.COMPLETED)
    assert admin_client.get("/api/dashboard/admin/").data["active_visits_count"] == 2


def test_admin_needs_reschedule_count_is_exact(admin_client, appointment_factory):
    appointment_at(appointment_factory, status=Appointment.Status.NEEDS_RESCHEDULE)
    appointment_at(appointment_factory, day_offset=-40, status=Appointment.Status.NEEDS_RESCHEDULE)
    appointment_at(appointment_factory, hour=11, status=Appointment.Status.CANCELLED)
    assert admin_client.get("/api/dashboard/admin/").data["needs_reschedule_appointments_count"] == 2


def test_admin_invoice_counts_are_exact(admin_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-COUNT-1", status=Invoice.Status.UNPAID)
    invoice_for(patient, staff_user, number="INV-DASH-COUNT-2", status=Invoice.Status.PAID)
    data = admin_client.get("/api/dashboard/admin/").data
    assert data["open_invoices_count"] == 1
    assert data["today_invoices_count"] == 2


def test_admin_seven_day_status_aggregation_is_correct(admin_client, appointment_factory):
    appointment_at(appointment_factory, day_offset=-6, status=Appointment.Status.UPCOMING)
    appointment_at(appointment_factory, day_offset=-3, status=Appointment.Status.UPCOMING)
    appointment_at(appointment_factory, status=Appointment.Status.COMPLETED)
    totals = admin_client.get("/api/dashboard/admin/").data["appointment_status_last_7_days"]
    assert totals["UPCOMING"] == 2
    assert totals["COMPLETED"] == 1


def test_admin_status_aggregation_includes_zero_values(admin_client, appointment_factory):
    appointment_at(appointment_factory, status=Appointment.Status.CHECKED_IN)
    totals = admin_client.get("/api/dashboard/admin/").data["appointment_status_last_7_days"]
    assert set(totals) == {status for status, _ in Appointment.Status.choices}
    assert totals["NO_SHOW"] == 0


def test_admin_status_aggregation_excludes_outside_seven_days(admin_client, appointment_factory):
    appointment_at(appointment_factory, day_offset=-7, hour=23, status=Appointment.Status.UPCOMING)
    assert admin_client.get("/api/dashboard/admin/").data["appointment_status_last_7_days"]["UPCOMING"] == 0


def test_admin_billing_trend_uses_invoice_created_at(admin_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-01", amount="250.00", day_offset=-4)
    activity = admin_client.get("/api/dashboard/admin/").data["billing_activity_last_30_days"]
    row = next(item for item in activity if item["date"] == (clinic_clock()[1] - timedelta(days=4)).isoformat())
    assert Decimal(row["SYP"]["invoiced"]) == Decimal("250.00")


def test_admin_billing_trend_excludes_cancelled_invoices(admin_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-02", amount="100.00", status=Invoice.Status.CANCELLED)
    row = admin_client.get("/api/dashboard/admin/").data["billing_activity_last_30_days"][-1]
    assert Decimal(row["SYP"]["invoiced"]) == Decimal("0.00")


def test_admin_billing_trend_uses_payment_date(admin_client, patient, staff_user):
    invoice = invoice_for(patient, staff_user, number="INV-DASH-03", amount="100.00", day_offset=-10)
    Payment.objects.create(invoice=invoice, amount="40.00", currency="SYP", payment_date=clinic_at(-2, 14), created_by=staff_user)
    activity = admin_client.get("/api/dashboard/admin/").data["billing_activity_last_30_days"]
    payment_row = next(item for item in activity if item["date"] == (clinic_clock()[1] - timedelta(days=2)).isoformat())
    assert Decimal(payment_row["SYP"]["collected"]) == Decimal("40.00")


def test_admin_billing_trend_keeps_syp_and_usd_separate(admin_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-04", currency="SYP", amount="500.00")
    invoice_for(patient, staff_user, number="INV-DASH-05", currency="USD", amount="25.00")
    row = admin_client.get("/api/dashboard/admin/").data["billing_activity_last_30_days"][-1]
    assert Decimal(row["SYP"]["invoiced"]) == Decimal("500.00")
    assert Decimal(row["USD"]["invoiced"]) == Decimal("25.00")


def test_admin_billing_trend_has_exact_thirty_day_boundaries(admin_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-06", amount="30.00", day_offset=-29)
    invoice_for(patient, staff_user, number="INV-DASH-07", amount="99.00", day_offset=-30)
    activity = admin_client.get("/api/dashboard/admin/").data["billing_activity_last_30_days"]
    assert len(activity) == 30
    assert Decimal(activity[0]["SYP"]["invoiced"]) == Decimal("30.00")
    assert sum(Decimal(item["SYP"]["invoiced"]) for item in activity) == Decimal("30.00")


def test_admin_recent_invoices_are_newest_first(admin_client, patient, staff_user):
    older = invoice_for(patient, staff_user, number="INV-DASH-08", day_offset=-2)
    newer = invoice_for(patient, staff_user, number="INV-DASH-09", day_offset=-1)
    ids = [item["id"] for item in admin_client.get("/api/dashboard/admin/").data["recent_invoices"]]
    assert ids[:2] == [newer.id, older.id]


def test_staff_today_count_uses_clinic_local_day(staff_client, appointment_factory):
    appointment_at(appointment_factory, hour=0)
    appointment_at(appointment_factory, day_offset=-1, hour=23)
    assert staff_client.get("/api/dashboard/staff/").data["today_appointments_count"] == 1


def test_staff_ready_count_is_current_clinic_day_only(staff_client, appointment_factory):
    appointment_at(appointment_factory, status=Appointment.Status.CHECKED_IN)
    appointment_at(appointment_factory, day_offset=-1, status=Appointment.Status.CHECKED_IN)
    assert staff_client.get("/api/dashboard/staff/").data["patients_ready_count"] == 1


def test_staff_open_invoice_count_is_exact(staff_client, patient, staff_user):
    invoice_for(patient, staff_user, number="INV-DASH-STAFF-COUNT-1", status=Invoice.Status.UNPAID)
    invoice_for(patient, staff_user, number="INV-DASH-STAFF-COUNT-2", status=Invoice.Status.PAID)
    assert staff_client.get("/api/dashboard/staff/").data["open_invoices_count"] == 1


def test_staff_needs_reschedule_count_is_exact(staff_client, appointment_factory):
    appointment_at(appointment_factory, status=Appointment.Status.NEEDS_RESCHEDULE)
    appointment_at(appointment_factory, day_offset=-5, status=Appointment.Status.NEEDS_RESCHEDULE)
    assert staff_client.get("/api/dashboard/staff/").data["needs_reschedule_count"] == 2


def test_staff_queue_is_chronological(staff_client, appointment_factory):
    later = appointment_at(appointment_factory, hour=15)
    earlier = appointment_at(appointment_factory, hour=8)
    ids = [item["id"] for item in staff_client.get("/api/dashboard/staff/").data["today_appointments"]]
    assert ids == [earlier.id, later.id]


def test_staff_open_invoice_data_and_balance_are_correct(staff_client, patient, staff_user):
    invoice = invoice_for(patient, staff_user, number="INV-DASH-10", amount="100.00", status=Invoice.Status.PARTIALLY_PAID)
    Payment.objects.create(invoice=invoice, amount="35.00", currency="SYP", payment_date=clinic_at(), created_by=staff_user)
    invoice_for(patient, staff_user, number="INV-DASH-11", amount="80.00", status=Invoice.Status.PAID)
    rows = staff_client.get("/api/dashboard/staff/").data["open_invoices"]
    assert [row["id"] for row in rows] == [invoice.id]
    assert Decimal(rows[0]["remaining_amount"]) == Decimal("65.00")


def test_staff_endpoint_permissions(staff_client, admin_client, doctor_client):
    assert staff_client.get("/api/dashboard/staff/").status_code == 200
    assert admin_client.get("/api/dashboard/staff/").status_code == 403
    assert doctor_client.get("/api/dashboard/staff/").status_code == 403


def test_doctor_dashboard_has_only_own_today_appointments(doctor_client, doctor_user, other_doctor_user, appointment_factory):
    own = appointment_at(appointment_factory, doctor=doctor_user)
    appointment_at(appointment_factory, doctor=other_doctor_user, hour=10)
    appointment_at(appointment_factory, doctor=doctor_user, day_offset=-1)
    rows = doctor_client.get("/api/dashboard/doctor/").data["today_appointments"]
    assert [row["id"] for row in rows] == [own.id]


def test_doctor_ready_count_is_own_current_day_only(doctor_client, doctor_user, other_doctor_user, appointment_factory):
    appointment_at(appointment_factory, doctor=doctor_user, status=Appointment.Status.CHECKED_IN)
    appointment_at(appointment_factory, doctor=doctor_user, day_offset=-1, status=Appointment.Status.CHECKED_IN)
    appointment_at(appointment_factory, doctor=other_doctor_user, hour=10, status=Appointment.Status.CHECKED_IN)
    assert doctor_client.get("/api/dashboard/doctor/").data["patients_ready_count"] == 1


def test_doctor_completed_today_uses_clinic_local_boundary(doctor_client, doctor_user, appointment_factory, visit_factory):
    today_appointment = appointment_at(appointment_factory, doctor=doctor_user, status=Appointment.Status.COMPLETED)
    yesterday_appointment = appointment_at(appointment_factory, doctor=doctor_user, day_offset=-1, status=Appointment.Status.COMPLETED)
    visit_factory(appointment=today_appointment, status=Visit.Status.COMPLETED, completed_at=clinic_at(0, 0))
    visit_factory(appointment=yesterday_appointment, status=Visit.Status.COMPLETED, completed_at=clinic_at(-1, 23, 59))
    assert doctor_client.get("/api/dashboard/doctor/").data["completed_today_count"] == 1


def test_doctor_active_visit_belongs_to_logged_in_doctor(doctor_client, doctor_user, other_doctor_user, appointment_factory, visit_factory):
    own_appointment = appointment_at(appointment_factory, doctor=doctor_user, status=Appointment.Status.ACTIVE)
    own_visit = visit_factory(appointment=own_appointment, status=Visit.Status.ACTIVE)
    other_appointment = appointment_at(appointment_factory, doctor=other_doctor_user, hour=10, status=Appointment.Status.ACTIVE)
    visit_factory(appointment=other_appointment, status=Visit.Status.ACTIVE)
    assert doctor_client.get("/api/dashboard/doctor/").data["own_active_visit"]["id"] == own_visit.id


def test_doctor_schedule_excludes_other_doctors(doctor_client, doctor_user, other_doctor_user, appointment_factory):
    own = appointment_at(appointment_factory, doctor=doctor_user, hour=11)
    other = appointment_at(appointment_factory, doctor=other_doctor_user, hour=8)
    ids = [item["id"] for item in doctor_client.get("/api/dashboard/doctor/").data["today_appointments"]]
    assert own.id in ids
    assert other.id not in ids


def test_doctor_needs_reschedule_count_is_own_only(doctor_client, doctor_user, other_doctor_user, appointment_factory):
    appointment_at(appointment_factory, doctor=doctor_user, status=Appointment.Status.NEEDS_RESCHEDULE)
    appointment_at(appointment_factory, doctor=other_doctor_user, hour=10, status=Appointment.Status.NEEDS_RESCHEDULE)
    assert doctor_client.get("/api/dashboard/doctor/").data["needs_reschedule_count"] == 1


def test_doctor_endpoint_permissions(doctor_client, admin_client, staff_client):
    assert doctor_client.get("/api/dashboard/doctor/").status_code == 200
    assert admin_client.get("/api/dashboard/doctor/").status_code == 403
    assert staff_client.get("/api/dashboard/doctor/").status_code == 403


def test_dashboard_requires_authentication(api_client):
    for path in ("/api/dashboard/admin/", "/api/dashboard/staff/", "/api/dashboard/doctor/"):
        assert api_client.get(path).status_code == 401


def test_dashboard_payload_omits_clinical_notes_and_media(admin_client, appointment_factory, visit_factory):
    appointment = appointment_at(appointment_factory, status=Appointment.Status.ACTIVE)
    visit_factory(appointment=appointment, status=Visit.Status.ACTIVE, clinical_notes="private dashboard note")
    payload = str(admin_client.get("/api/dashboard/admin/").data)
    assert "private dashboard note" not in payload
    assert "/media/" not in payload
