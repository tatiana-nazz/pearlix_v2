import pytest

from apps.accounts.models import DoctorProfile, User
from apps.scheduling.models import Appointment, ClinicDefaultShift, WorkingShift


def default_payload(**overrides):
    payload = {"name": "Morning", "weekday": 0, "start_time": "09:00", "end_time": "13:00"}
    payload.update(overrides)
    return payload


def shift_payload(employee, **overrides):
    payload = {"employee_id": employee.id, "name": "Morning", "weekday": 0, "start_time": "09:00", "end_time": "13:00"}
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_default_shift_overlap_adjacency_versions_and_no_delete(admin_client):
    morning = admin_client.post("/api/clinic-default-shifts/", default_payload(), format="json")
    adjacent = admin_client.post("/api/clinic-default-shifts/", default_payload(name="Afternoon", start_time="13:00", end_time="17:00"), format="json")
    overlap = admin_client.post("/api/clinic-default-shifts/", default_payload(name="Overlap", start_time="12:00", end_time="14:00"), format="json")
    assert morning.status_code == adjacent.status_code == 201
    assert overlap.status_code == 409 and overlap.data["code"] == "SHIFT_OVERLAP"
    missing = admin_client.patch(f"/api/clinic-default-shifts/{morning.data['id']}/", {"name": "Updated"}, format="json")
    assert missing.status_code == 400 and missing.data["code"] == "VERSION_REQUIRED"
    updated = admin_client.patch(f"/api/clinic-default-shifts/{morning.data['id']}/", {"name": "Updated", "version": morning.data["version"]}, format="json")
    assert updated.status_code == 200 and updated.data["version"] == 2
    stale = admin_client.post(f"/api/clinic-default-shifts/{morning.data['id']}/deactivate/", {"version": 1}, format="json")
    assert stale.status_code == 409 and stale.data["code"] == "VERSION_CONFLICT"
    assert admin_client.delete(f"/api/clinic-default-shifts/{morning.data['id']}/").status_code == 405


@pytest.mark.django_db
def test_working_shift_roles_overlap_activation_and_read_scope(admin_client, staff_client, doctor_client, staff_user, doctor_user, other_doctor_user, admin_user):
    morning = admin_client.post("/api/working-shifts/", shift_payload(doctor_user), format="json")
    adjacent = admin_client.post("/api/working-shifts/", shift_payload(doctor_user, name="Afternoon", start_time="13:00", end_time="17:00"), format="json")
    overlap = admin_client.post("/api/working-shifts/", shift_payload(doctor_user, name="Overlap", start_time="12:00", end_time="14:00"), format="json")
    staff_shift = admin_client.post("/api/working-shifts/", shift_payload(staff_user), format="json")
    invalid = admin_client.post("/api/working-shifts/", shift_payload(admin_user), format="json")
    assert morning.status_code == adjacent.status_code == staff_shift.status_code == 201
    assert overlap.status_code == 409 and invalid.status_code == 400
    assert staff_client.get("/api/working-shifts/").data["results"][0]["employee"]["id"] == staff_user.id
    assert doctor_client.get(f"/api/working-shifts/?employee_id={other_doctor_user.id}").data["results"][0]["employee"]["id"] == doctor_user.id
    assert staff_client.post("/api/working-shifts/", shift_payload(staff_user), format="json").status_code == 403
    assert admin_client.delete(f"/api/working-shifts/{morning.data['id']}/").status_code == 405
    deactivated = admin_client.post(f"/api/working-shifts/{adjacent.data['id']}/deactivate/", {"version": adjacent.data["version"]}, format="json")
    changed = admin_client.patch(f"/api/working-shifts/{adjacent.data['id']}/", {"start_time": "12:00", "version": deactivated.data["version"]}, format="json")
    activation = admin_client.post(f"/api/working-shifts/{adjacent.data['id']}/activate/", {"version": changed.data["version"]}, format="json")
    assert activation.status_code == 409 and activation.data["code"] == "SHIFT_OVERLAP"


@pytest.mark.django_db
def test_apply_default_and_copy_create_independent_shifts(admin_client, doctor_user, staff_user):
    default = admin_client.post("/api/clinic-default-shifts/", default_payload(), format="json")
    missing = admin_client.post("/api/working-shifts/apply-default/", {"employee_id": doctor_user.id, "mode": "MISSING_ONLY"}, format="json")
    duplicate = admin_client.post("/api/working-shifts/apply-default/", {"employee_id": doctor_user.id, "mode": "MISSING_ONLY"}, format="json")
    copied = admin_client.post("/api/working-shifts/copy-schedule/", {"source_employee_id": doctor_user.id, "target_employee_id": staff_user.id, "mode": "REPLACE_ALL"}, format="json")
    assert missing.data["created_count"] == 1 and duplicate.data["skipped_count"] == 1
    assert copied.data["created_count"] == 1
    doctor_shift = WorkingShift.objects.get(employee=doctor_user)
    staff_shift = WorkingShift.objects.get(employee=staff_user)
    assert doctor_shift.id != staff_shift.id
    admin_client.patch(f"/api/clinic-default-shifts/{default.data['id']}/", {"name": "Changed default", "version": default.data["version"]}, format="json")
    doctor_shift.refresh_from_db(); staff_shift.refresh_from_db()
    assert doctor_shift.name == staff_shift.name == "Morning"


@pytest.mark.django_db
def test_doctor_shift_reduction_requires_confirmation_and_marks_only_affected(admin_client, doctor_user, staff_user, appointment_factory):
    shift = admin_client.post("/api/working-shifts/", shift_payload(doctor_user, end_time="17:00"), format="json")
    affected = appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T16:00:00+03:00", end_datetime="2026-07-20T16:30:00+03:00")
    unaffected = appointment_factory(doctor=doctor_user, start_datetime="2026-07-20T10:00:00+03:00", end_datetime="2026-07-20T10:30:00+03:00")
    conflict = admin_client.patch(f"/api/working-shifts/{shift.data['id']}/", {"end_time": "15:00", "version": shift.data["version"]}, format="json")
    assert conflict.status_code == 409 and conflict.data["code"] == "SHIFT_CHANGE_REQUIRES_CONFIRMATION"
    affected.refresh_from_db(); assert affected.status == Appointment.Status.UPCOMING
    assert WorkingShift.objects.get(id=shift.data["id"]).end_time.isoformat() == "17:00:00"
    confirmed = admin_client.patch(f"/api/working-shifts/{shift.data['id']}/", {"end_time": "15:00", "version": shift.data["version"], "confirm_appointment_impact": True}, format="json")
    assert confirmed.status_code == 200 and confirmed.data["impacted_appointments_count"] == 1
    affected.refresh_from_db(); unaffected.refresh_from_db()
    assert affected.status == Appointment.Status.NEEDS_RESCHEDULE and affected.reschedule_source_working_shift_id == shift.data["id"]
    assert unaffected.status == Appointment.Status.UPCOMING
    staff_shift = admin_client.post("/api/working-shifts/", shift_payload(staff_user), format="json")
    assert admin_client.post(f"/api/working-shifts/{staff_shift.data['id']}/deactivate/", {"version": staff_shift.data["version"]}, format="json").status_code == 200


@pytest.mark.django_db
def test_split_shift_availability_has_midday_gap_and_ignores_staff_shift(admin_client, staff_client, doctor_user, staff_user):
    for employee, name, start, end in ((doctor_user, "Morning", "09:00", "13:00"), (doctor_user, "Evening", "16:00", "20:00"), (staff_user, "Staff", "13:00", "16:00")):
        assert admin_client.post("/api/working-shifts/", shift_payload(employee, name=name, start_time=start, end_time=end), format="json").status_code == 201
    response = staff_client.get(f"/api/appointments/availability/?doctor_id={doctor_user.id}&date=2026-07-20&duration_minutes=30")
    starts = {slot["start_datetime"][11:16] for slot in response.data["available_slots"]}
    assert response.status_code == 200 and "09:00" in starts and "16:00" in starts
    assert not any("13:00" <= value < "16:00" for value in starts)


@pytest.mark.django_db
def test_active_professional_cannot_remove_final_active_shift(admin_client, doctor_user):
    profile = DoctorProfile.objects.create(user=doctor_user, specialty="General", is_active=True)
    shift = admin_client.post("/api/working-shifts/", shift_payload(doctor_user), format="json")
    rejected = admin_client.post(f"/api/working-shifts/{shift.data['id']}/deactivate/", {"version": shift.data['version']}, format="json")
    assert rejected.status_code == 409 and rejected.data["code"] == "ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE"
    assert WorkingShift.objects.get(pk=shift.data["id"]).is_active is True
    profile.refresh_from_db(); assert profile.is_active is True
