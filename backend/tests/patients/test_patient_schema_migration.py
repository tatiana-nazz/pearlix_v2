import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone


pytestmark = pytest.mark.django_db(transaction=True)


def leaf_targets_with_patient(target):
    executor = MigrationExecutor(connection)
    scheduling_target = (
        "scheduling",
        "0004_appointment_reschedule_previous_status_and_more" if target[1] == "0001_initial" else "0005_admin_shifts_availability",
    )
    return [node for node in executor.loader.graph.leaf_nodes() if node[0] not in {"patients", "scheduling"}] + [target, scheduling_target]


def migrate_to(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(targets).apps


def test_patient_schema_migration_preserves_data_and_relationships():
    before = leaf_targets_with_patient(("patients", "0001_initial"))
    after = leaf_targets_with_patient(("patients", "0002_patient_schema_upgrade"))

    apps = migrate_to(before)
    User = apps.get_model("accounts", "User")
    Patient = apps.get_model("patients", "Patient")
    Appointment = apps.get_model("scheduling", "Appointment")
    Visit = apps.get_model("visits", "Visit")

    staff = User.objects.create(email="staff-migration@example.com", full_name="Staff User", role="STAFF", is_active=True)
    doctor = User.objects.create(email="doctor-migration@example.com", full_name="Doctor User", role="DOCTOR", is_active=True)
    patient = Patient.objects.create(
        full_name="Legacy Full Name",
        phone="0999000000",
        gender="FEMALE",
        birth_date="1990-02-03",
        address="Legacy address",
        medical_summary="Legacy medical history",
        general_notes="Legacy notes",
        is_archived=True,
        created_by=staff,
        updated_by=staff,
    )
    appointment = Appointment.objects.create(
        patient=patient,
        doctor=doctor,
        start_datetime=timezone.now(),
        end_datetime=timezone.now() + timezone.timedelta(minutes=30),
        duration_minutes=30,
        status="COMPLETED",
        created_by=staff,
        updated_by=staff,
    )
    Visit.objects.create(
        appointment=appointment,
        patient=patient,
        doctor=doctor,
        status="COMPLETED",
        started_at=timezone.now(),
        completed_at=timezone.now(),
        created_by=doctor,
        updated_by=doctor,
    )

    apps = migrate_to(after)
    Patient = apps.get_model("patients", "Patient")
    Appointment = apps.get_model("scheduling", "Appointment")
    Visit = apps.get_model("visits", "Visit")
    migrated = Patient.objects.get(id=patient.id)

    assert Patient.objects.count() == 1
    assert Patient.objects.filter(is_archived=True).count() == 1
    assert Appointment.objects.filter(patient_id=migrated.id).count() == 1
    assert Visit.objects.filter(patient_id=migrated.id).count() == 1
    assert migrated.first_name == "Legacy Full Name"
    assert migrated.last_name == ""
    assert migrated.gender == "Female"
    assert migrated.date_of_birth.isoformat() == "1990-02-03"
    assert migrated.phone_number == "0999000000"
    assert migrated.medical_conditions_history == "Legacy medical history"
    assert migrated.general_notes == "Legacy notes"
    assert migrated.version == 1


@pytest.mark.parametrize("unsafe_gender", ["OTHER", "UNSPECIFIED"])
def test_patient_schema_migration_blocks_unsafe_legacy_genders(unsafe_gender):
    before = leaf_targets_with_patient(("patients", "0001_initial"))
    after = leaf_targets_with_patient(("patients", "0002_patient_schema_upgrade"))

    apps = migrate_to(before)
    User = apps.get_model("accounts", "User")
    Patient = apps.get_model("patients", "Patient")
    staff = User.objects.create(email=f"{unsafe_gender.lower()}@example.com", full_name="Staff User", role="STAFF", is_active=True)
    patient = Patient.objects.create(
        full_name="Unsafe Gender",
        phone="0988000000",
        gender=unsafe_gender,
        created_by=staff,
        updated_by=staff,
    )

    with pytest.raises(RuntimeError, match=f"id={patient.id} gender={unsafe_gender}"):
        migrate_to(after)

    migrate_to(before)
    Patient = MigrationExecutor(connection).loader.project_state(before).apps.get_model("patients", "Patient")
    Patient.objects.filter(id=patient.id).delete()
    migrate_to(after)
