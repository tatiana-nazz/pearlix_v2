from datetime import timedelta

import pytest
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


pytestmark = pytest.mark.django_db


def patient_payload(**overrides):
    payload = {
        "first_name": "Maya",
        "last_name": "Hassan",
        "gender": "Female",
        "date_of_birth": "1995-05-20",
        "phone_number": "0944000000",
        "email": "maya@example.com",
        "national_id_or_passport": "P-100",
        "address": "Damascus",
        "emergency_contact": "Omar Hassan 0999000000",
        "blood_group": "O+",
        "medical_conditions_history": "No known allergies.",
        "insurance_info": "Private dental plan",
        "general_notes": "Prefers morning appointments.",
    }
    payload.update(overrides)
    return payload


def update_payload(patient, **overrides):
    payload = {"version": patient.version}
    payload.update(overrides)
    return payload


def assert_patient_summary_shape(data):
    assert data["full_name"] == f"{data['first_name']} {data['last_name']}".strip()
    assert "phone" not in data
    assert "birth_date" not in data
    assert "medical_summary" not in data
    assert "phone_number" in data
    assert "date_of_birth" in data
    assert "version" in data


def test_patient_list_includes_last_visit_and_next_eligible_appointment(staff_client, patient, appointment_factory, visit_factory):
    now = timezone.now()
    completed_appointment = appointment_factory(
        patient=patient,
        status=Appointment.Status.COMPLETED,
        start_datetime=now - timedelta(days=8),
        end_datetime=now - timedelta(days=8) + timedelta(minutes=30),
    )
    visit_factory(
        appointment=completed_appointment,
        status=Visit.Status.COMPLETED,
        started_at=now - timedelta(days=8),
        completed_at=now - timedelta(days=8) + timedelta(minutes=30),
    )
    appointment_factory(
        patient=patient,
        status=Appointment.Status.CANCELLED,
        start_datetime=now + timedelta(hours=2),
        end_datetime=now + timedelta(hours=2, minutes=30),
    )
    eligible = appointment_factory(
        patient=patient,
        status=Appointment.Status.UPCOMING,
        start_datetime=now + timedelta(days=2),
        end_datetime=now + timedelta(days=2, minutes=30),
    )

    response = staff_client.get("/api/patients/")

    assert response.status_code == 200
    row = next(item for item in response.data["results"] if item["id"] == patient.id)
    assert row["last_visit_at"] is not None
    from django.utils.dateparse import parse_datetime
    assert parse_datetime(row["next_appointment_at"]) == eligible.start_datetime


def test_staff_can_create_patient_with_final_schema(staff_client, staff_user):
    response = staff_client.post("/api/patients/", patient_payload(), format="json")

    assert response.status_code == 201
    assert response.data["first_name"] == "Maya"
    assert response.data["last_name"] == "Hassan"
    assert response.data["full_name"] == "Maya Hassan"
    assert response.data["gender"] == "Female"
    assert response.data["phone_number"] == "0944000000"
    assert response.data["age"] is not None
    assert response.data["version"] == 1
    assert response.data["created_by"]["id"] == staff_user.id
    assert response.data["updated_by"]["id"] == staff_user.id
    assert_patient_summary_shape(response.data)


def test_create_rejects_computed_archive_audit_and_version_overrides(staff_client, staff_user):
    response = staff_client.post(
        "/api/patients/",
        patient_payload(
            full_name="Spoofed Name",
            is_archived=True,
            version=55,
            created_by=staff_user.id,
            updated_by=staff_user.id,
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "full_name" in response.data["details"]
    assert "is_archived" in response.data["details"]
    assert "version" in response.data["details"]
    assert Patient.objects.count() == 0


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("first_name", ""),
        ("last_name", ""),
        ("gender", ""),
        ("date_of_birth", (timezone.localdate() + timedelta(days=1)).isoformat()),
        ("blood_group", "X+"),
    ],
)
def test_create_validates_required_and_choice_fields(staff_client, field, value):
    response = staff_client.post("/api/patients/", patient_payload(**{field: value}), format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert field in response.data["details"]


def test_national_id_is_unique_only_when_supplied(staff_client):
    first = staff_client.post("/api/patients/", patient_payload(national_id_or_passport=""), format="json")
    second = staff_client.post(
        "/api/patients/",
        patient_payload(first_name="Nour", last_name="Ali", phone_number="0955000000", email="", national_id_or_passport=""),
        format="json",
    )
    duplicate = staff_client.post(
        "/api/patients/",
        patient_payload(first_name="Sara", last_name="Ali", phone_number="0966000000", email="", national_id_or_passport="DUP-1"),
        format="json",
    )
    duplicate_again = staff_client.post(
        "/api/patients/",
        patient_payload(first_name="Lina", last_name="Ali", phone_number="0977000000", email="", national_id_or_passport="DUP-1"),
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert Patient.objects.get(id=first.data["id"]).national_id_or_passport is None
    assert Patient.objects.get(id=second.data["id"]).national_id_or_passport is None
    assert duplicate.status_code == 201
    assert duplicate_again.status_code == 400
    assert "national_id_or_passport" in duplicate_again.data["details"]


def test_staff_update_requires_version_and_increments_once(staff_client, patient):
    missing_version = staff_client.patch(f"/api/patients/{patient.id}/", {"general_notes": "No version"}, format="json")

    assert missing_version.status_code == 400
    assert missing_version.data["code"] == "VERSION_REQUIRED"

    response = staff_client.patch(
        f"/api/patients/{patient.id}/",
        update_payload(patient, last_name="Updated", medical_conditions_history="Updated history."),
        format="json",
    )

    assert response.status_code == 200
    assert response.data["last_name"] == "Updated"
    assert response.data["version"] == patient.version + 1
    patient.refresh_from_db()
    assert patient.version == 2
    assert patient.medical_conditions_history == "Updated history."


def test_stale_update_returns_conflict_without_mutating(staff_client, patient):
    patient.version = 4
    patient.save(update_fields=["version", "updated_at"])

    response = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"version": 3, "last_name": "Conflict"},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["code"] == "VERSION_CONFLICT"
    assert response.data["details"] == {"submitted_version": 3, "current_version": 4}
    patient.refresh_from_db()
    assert patient.last_name == "Khaled"
    assert patient.version == 4


def test_direct_archive_field_patch_is_rejected(staff_client, patient):
    response = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"version": patient.version, "is_archived": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "is_archived" in response.data["details"]
    patient.refresh_from_db()
    assert patient.is_archived is False
    assert patient.version == 1


def test_archive_unarchive_require_version_and_increment(staff_client, patient):
    missing = staff_client.post(f"/api/patients/{patient.id}/archive/", {}, format="json")
    assert missing.status_code == 400
    assert missing.data["code"] == "VERSION_REQUIRED"

    archived = staff_client.post(f"/api/patients/{patient.id}/archive/", {"version": patient.version}, format="json")
    assert archived.status_code == 200
    assert archived.data["is_archived"] is True
    assert archived.data["version"] == patient.version + 1

    patient.refresh_from_db()
    unarchived = staff_client.post(f"/api/patients/{patient.id}/unarchive/", {"version": patient.version}, format="json")
    assert unarchived.status_code == 200
    assert unarchived.data["is_archived"] is False
    assert unarchived.data["version"] == patient.version + 1


def test_archive_stale_version_conflicts(staff_client, patient):
    patient.version = 6
    patient.save(update_fields=["version", "updated_at"])

    response = staff_client.post(f"/api/patients/{patient.id}/archive/", {"version": 5}, format="json")

    assert response.status_code == 409
    assert response.data["code"] == "VERSION_CONFLICT"
    assert response.data["details"] == {"submitted_version": 5, "current_version": 6}


def test_archive_blocked_by_active_operational_appointments(staff_client, patient, appointment_factory):
    appointment_factory(patient=patient, status=Appointment.Status.UPCOMING)

    response = staff_client.post(f"/api/patients/{patient.id}/archive/", {"version": patient.version}, format="json")

    assert response.status_code == 409
    assert response.data["code"] == "ARCHIVE_BLOCKED"
    assert Appointment.Status.UPCOMING in response.data["details"]["blocking_statuses"]
    patient.refresh_from_db()
    assert patient.is_archived is False
    assert patient.version == 1


def test_admin_read_only_permissions(admin_client, patient):
    create_response = admin_client.post("/api/patients/", patient_payload(), format="json")
    update_response = admin_client.patch(
        f"/api/patients/{patient.id}/",
        update_payload(patient, last_name="Blocked"),
        format="json",
    )

    assert create_response.status_code == 403
    assert update_response.status_code == 403


def test_doctor_can_read_and_update_non_archived_patients_but_not_archive(doctor_client, patient):
    detail = doctor_client.get(f"/api/patients/{patient.id}/")
    assert detail.status_code == 200

    update = doctor_client.patch(
        f"/api/patients/{patient.id}/",
        update_payload(patient, blood_group="A+", insurance_info="Updated by doctor."),
        format="json",
    )
    assert update.status_code == 200
    assert update.data["version"] == 2
    assert update.data["insurance_info"] == "Updated by doctor."

    patient.refresh_from_db()
    archive = doctor_client.post(f"/api/patients/{patient.id}/archive/", {"version": patient.version}, format="json")
    assert archive.status_code == 403


def test_doctor_cannot_read_archived_patients(doctor_client, patient):
    patient.is_archived = True
    patient.save(update_fields=["is_archived", "updated_at"])

    response = doctor_client.get(f"/api/patients/{patient.id}/")

    assert response.status_code == 404


def test_search_and_filter_use_new_canonical_fields(staff_client, patient_factory):
    patient_factory(first_name="Lina", last_name="Mansour", phone_number="0911111111", email="lina@example.com", national_id_or_passport="NID-1")
    patient_factory(first_name="Karim", last_name="Haddad", phone_number="0922222222", email="karim@example.com", national_id_or_passport="NID-2")

    first_name_response = staff_client.get("/api/patients/?first_name=Lina")
    last_name_response = staff_client.get("/api/patients/?last_name=Haddad")
    phone_response = staff_client.get("/api/patients/?phone_number=0922")
    email_response = staff_client.get("/api/patients/?email=lina@example.com")
    national_id_response = staff_client.get("/api/patients/?national_id_or_passport=NID-2")
    search_response = staff_client.get("/api/patients/?search=Lina Mansour")

    assert [item["full_name"] for item in first_name_response.data["results"]] == ["Lina Mansour"]
    assert [item["full_name"] for item in last_name_response.data["results"]] == ["Karim Haddad"]
    assert [item["phone_number"] for item in phone_response.data["results"]] == ["0922222222"]
    assert [item["email"] for item in email_response.data["results"]] == ["lina@example.com"]
    assert [item["national_id_or_passport"] for item in national_id_response.data["results"]] == ["NID-2"]
    assert [item["full_name"] for item in search_response.data["results"]] == ["Lina Mansour"]


def test_legacy_alias_filters_are_preserved(staff_client, patient_factory):
    patient_factory(first_name="Nour", last_name="Ali", phone_number="0966000000")
    patient_factory(first_name="Sara", last_name="Ali", phone_number="0977000000")

    phone_response = staff_client.get("/api/patients/?phone=0966")
    name_response = staff_client.get("/api/patients/?name=Sara")

    assert [item["phone_number"] for item in phone_response.data["results"]] == ["0966000000"]
    assert [item["full_name"] for item in name_response.data["results"]] == ["Sara Ali"]


def test_default_list_hides_archived_for_admin_and_staff(staff_client, patient_factory):
    active = patient_factory(first_name="Active", last_name="Patient", phone_number="0900000001")
    archived = patient_factory(first_name="Archived", last_name="Patient", phone_number="0900000002", is_archived=True)

    response = staff_client.get("/api/patients/")
    archived_response = staff_client.get("/api/patients/?is_archived=true")

    assert [item["id"] for item in response.data["results"]] == [active.id]
    assert [item["id"] for item in archived_response.data["results"]] == [archived.id]


def test_active_patient_search_is_bounded_and_excludes_archived_results(staff_client, patient_factory):
    active = patient_factory(first_name="Searchable", last_name="Patient", phone_number="0912000001")
    patient_factory(first_name="Searchable", last_name="Archived", phone_number="0912000002", is_archived=True)

    response = staff_client.get("/api/patients/?search=Searchable&is_archived=false")

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == active.id
    assert len(response.data["results"]) <= 20
    assert response.data["results"][0]["is_archived"] is False


def test_doctor_helper_filters_remain_available(doctor_client, doctor_user, patient_factory, appointment_factory, visit_factory):
    accessible = patient_factory(first_name="Shared", last_name="Search", phone_number="0912345678")
    unrelated = patient_factory(first_name="Hidden", last_name="Search", phone_number="0912349999")
    appointment_factory(patient=accessible, doctor=doctor_user, status=Appointment.Status.UPCOMING)
    visit_factory(appointment=appointment_factory(patient=accessible, doctor=doctor_user, status=Appointment.Status.COMPLETED), status=Visit.Status.COMPLETED)

    related_response = doctor_client.get("/api/patients/?my_patients=true")
    upcoming_response = doctor_client.get("/api/patients/?upcoming_with_me=true")
    search_response = doctor_client.get("/api/patients/?search=Shared")

    assert accessible.id in [item["id"] for item in related_response.data["results"]]
    assert accessible.id in [item["id"] for item in upcoming_response.data["results"]]
    assert accessible.id in [item["id"] for item in search_response.data["results"]]
    assert unrelated.id not in [item["id"] for item in related_response.data["results"]]


def test_legacy_blank_last_name_must_be_fixed_before_profile_update(staff_client, staff_user):
    patient = Patient.objects.create(
        first_name="Legacy Full Name",
        last_name="",
        gender=Patient.Gender.MALE,
        phone_number="0999000000",
        created_by=staff_user,
        updated_by=staff_user,
    )

    blocked = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"version": patient.version, "general_notes": "Cannot save yet."},
        format="json",
    )
    allowed = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"version": patient.version, "last_name": "Resolved", "general_notes": "Saved after surname."},
        format="json",
    )

    assert blocked.status_code == 400
    assert "last_name" in blocked.data["details"]
    assert allowed.status_code == 200
    assert allowed.data["last_name"] == "Resolved"


def test_patient_appointments_are_clinic_wide_read_only_without_changing_doctor_schedule_scope(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient_factory,
    appointment_factory,
):
    patient = patient_factory(first_name="Cross", last_name="Doctor")
    later = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        start_datetime=timezone.now() + timedelta(days=2),
        end_datetime=timezone.now() + timedelta(days=2, minutes=30),
    )
    earlier = appointment_factory(
        patient=patient,
        doctor=other_doctor_user,
        start_datetime=timezone.now() + timedelta(days=1),
        end_datetime=timezone.now() + timedelta(days=1, minutes=30),
    )

    patient_response = doctor_client.get(f"/api/patients/{patient.id}/appointments/")
    global_response = doctor_client.get(f"/api/appointments/?patient_id={patient.id}")
    mutation_response = doctor_client.post(f"/api/patients/{patient.id}/appointments/", {}, format="json")

    assert patient_response.status_code == 200
    assert [row["id"] for row in patient_response.data["results"]] == [earlier.id, later.id]
    assert [row["doctor"]["id"] for row in patient_response.data["results"]] == [other_doctor_user.id, doctor_user.id]
    assert [row["id"] for row in global_response.data["results"]] == [later.id]
    assert mutation_response.status_code == 405


def test_patient_directory_next_appointment_matches_patient_appointment_summary(
    staff_client,
    patient_factory,
    appointment_factory,
):
    patient = patient_factory(first_name="Directory", last_name="Consistency")
    expected = appointment_factory(
        patient=patient,
        status=Appointment.Status.UPCOMING,
        start_datetime=timezone.now() + timedelta(days=1),
        end_datetime=timezone.now() + timedelta(days=1, minutes=30),
    )
    appointment_factory(
        patient=patient,
        status=Appointment.Status.CANCELLED,
        start_datetime=timezone.now() + timedelta(hours=1),
        end_datetime=timezone.now() + timedelta(hours=1, minutes=30),
    )

    directory = staff_client.get(f"/api/patients/?search={patient.first_name}%20{patient.last_name}")
    summary = staff_client.get(f"/api/patients/{patient.id}/appointments/")

    assert directory.status_code == 200
    assert parse_datetime(directory.data["results"][0]["next_appointment_at"]) == expected.start_datetime
    assert expected.id in [row["id"] for row in summary.data["results"]]
