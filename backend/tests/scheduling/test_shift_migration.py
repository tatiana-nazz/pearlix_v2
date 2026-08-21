import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


pytestmark = pytest.mark.django_db(transaction=True)


def targets(target):
    executor = MigrationExecutor(connection)
    return [node for node in executor.loader.graph.leaf_nodes() if node[0] != "scheduling"] + [target]


def migrate(target):
    executor = MigrationExecutor(connection)
    executor.migrate(target)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(target).apps


def test_working_hour_migration_preserves_doctor_schedule_without_inventing_rows():
    before = targets(("scheduling", "0004_appointment_reschedule_previous_status_and_more"))
    after = targets(("scheduling", "0005_admin_shifts_availability"))
    apps = migrate(before)
    User = apps.get_model("accounts", "User")
    WorkingHour = apps.get_model("scheduling", "WorkingHour")
    AvailabilityException = apps.get_model("scheduling", "AvailabilityException")
    doctor = User.objects.create(email="migration-doctor@example.com", full_name="Migration Doctor", role="DOCTOR", is_active=True)
    staff = User.objects.create(email="migration-staff@example.com", full_name="Migration Staff", role="STAFF", is_active=True)
    row = WorkingHour.objects.create(doctor=doctor, weekday=2, start_time="09:00", end_time="13:00", is_active=False)
    AvailabilityException.objects.create(staff=staff, start_datetime="2026-07-20T09:00:00+03:00", end_datetime="2026-07-20T10:00:00+03:00")
    apps = migrate(after)
    WorkingShift = apps.get_model("scheduling", "WorkingShift")
    ClinicDefaultShift = apps.get_model("scheduling", "ClinicDefaultShift")
    AvailabilityException = apps.get_model("scheduling", "AvailabilityException")
    migrated = WorkingShift.objects.get(employee_id=doctor.id)
    assert WorkingShift.objects.count() == 1 and migrated.weekday == row.weekday
    assert migrated.start_time.isoformat() == "09:00:00" and migrated.end_time.isoformat() == "13:00:00" and migrated.is_active is False
    assert migrated.name == "Existing Shift" and migrated.version == 1
    assert WorkingShift.objects.filter(employee_id=staff.id).count() == 0
    assert ClinicDefaultShift.objects.count() == 0 and AvailabilityException.objects.count() == 1


def test_reschedule_source_kind_migration_backfills_existing_provenance_and_version():
    before = targets(("scheduling", "0006_appointment_reschedule_source_clinic_weekday"))
    after = targets(("scheduling", "0007_appointment_reschedule_source_kind"))
    apps = migrate(before)
    User = apps.get_model("accounts", "User")
    Patient = apps.get_model("patients", "Patient")
    Appointment = apps.get_model("scheduling", "Appointment")
    AvailabilityException = apps.get_model("scheduling", "AvailabilityException")
    WorkingShift = apps.get_model("scheduling", "WorkingShift")
    doctor = User.objects.create(
        email="phase3-migration-doctor@example.com",
        full_name="Phase 3 Migration Doctor",
        role="DOCTOR",
        is_active=True,
    )
    patient = Patient.objects.create(
        first_name="Phase",
        last_name="Three",
        gender="Male",
    )
    leave = AvailabilityException.objects.create(
        doctor=doctor,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T10:00:00+03:00",
        type="UNAVAILABLE",
    )
    shift = WorkingShift.objects.create(
        employee=doctor,
        name="Shift 1",
        weekday=0,
        start_time="09:00",
        end_time="12:00",
        is_active=False,
    )
    common = {
        "patient": patient,
        "doctor": doctor,
        "duration_minutes": 30,
        "status": "NEEDS_RESCHEDULE",
        "reschedule_previous_status": "UPCOMING",
    }
    closure = Appointment.objects.create(
        **common,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
        reschedule_source_clinic_weekday=0,
    )
    leave_source = Appointment.objects.create(
        **common,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
        reschedule_source_exception=leave,
    )
    shift_source = Appointment.objects.create(
        **common,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
        reschedule_source_working_shift=shift,
    )

    apps = migrate(after)
    Appointment = apps.get_model("scheduling", "Appointment")
    assert Appointment.objects.get(pk=closure.pk).reschedule_source_kind == "CLINIC_WEEKLY_CLOSURE"
    assert Appointment.objects.get(pk=leave_source.pk).reschedule_source_kind == "LEAVE"
    migrated_shift = Appointment.objects.get(pk=shift_source.pk)
    assert migrated_shift.reschedule_source_kind == "WORKING_SCHEDULE_CHANGE"
    assert migrated_shift.version == 1
