from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import ActivityLog
from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


def patient_payload(**overrides):
    payload = {
        "full_name": "Maya Hassan",
        "phone": "0944000000",
        "gender": "FEMALE",
        "birth_date": "1995-05-20",
        "address": "Damascus",
        "medical_summary": "No known allergies.",
        "general_notes": "Prefers morning appointments.",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/patients/"),
        ("post", "/api/patients/"),
        ("get", "/api/patients/{id}/"),
        ("patch", "/api/patients/{id}/"),
    ],
)
def test_unauthenticated_user_cannot_access_patients(api_client, patient, method, path):
    response = getattr(api_client, method)(path.format(id=patient.id), patient_payload(), format="json")

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_can_list_and_read_patients(admin_client, patient):
    list_response = admin_client.get("/api/patients/")
    detail_response = admin_client.get(f"/api/patients/{patient.id}/")

    assert list_response.status_code == 200
    assert list_response.data["count"] == 1
    assert list_response.data["results"][0]["id"] == patient.id
    assert detail_response.status_code == 200
    assert detail_response.data["id"] == patient.id


@pytest.mark.django_db
def test_admin_cannot_create_patient(admin_client):
    response = admin_client.post("/api/patients/", patient_payload(), format="json")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert Patient.objects.count() == 0


@pytest.mark.django_db
def test_admin_cannot_update_patient(admin_client, patient):
    response = admin_client.patch(f"/api/patients/{patient.id}/", {"full_name": "Changed"}, format="json")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    patient.refresh_from_db()
    assert patient.full_name == "Ahmad Khaled"


@pytest.mark.django_db
def test_staff_can_list_create_read_and_update_patient(staff_client, staff_user):
    create_response = staff_client.post("/api/patients/", patient_payload(), format="json")

    assert create_response.status_code == 201
    patient = Patient.objects.get(id=create_response.data["id"])
    assert patient.created_by == staff_user
    assert patient.updated_by == staff_user
    assert create_response.data["age"] is not None

    list_response = staff_client.get("/api/patients/")
    detail_response = staff_client.get(f"/api/patients/{patient.id}/")
    update_response = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"general_notes": "Updated note."},
        format="json",
    )

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert detail_response.data["created_by"]["id"] == staff_user.id
    assert update_response.status_code == 200
    assert update_response.data["general_notes"] == "Updated note."


@pytest.mark.django_db
def test_staff_cannot_hard_delete_patient(staff_client, patient):
    response = staff_client.delete(f"/api/patients/{patient.id}/")

    assert response.status_code == 405
    assert Patient.objects.filter(id=patient.id).exists()


@pytest.mark.django_db
def test_doctor_can_list_read_and_update_accessible_patient(doctor_client, doctor_user, staff_user, patient, appointment_factory):
    appointment_factory(patient=patient, doctor=doctor_user)

    list_response = doctor_client.get("/api/patients/")
    detail_response = doctor_client.get(f"/api/patients/{patient.id}/")
    update_response = doctor_client.patch(
        f"/api/patients/{patient.id}/",
        {"medical_summary": "Updated by doctor.", "created_by": doctor_user.id, "updated_by": staff_user.id, "age": 4},
        format="json",
    )

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert update_response.status_code == 200
    patient.refresh_from_db()
    assert patient.medical_summary == "Updated by doctor."
    assert patient.created_by == staff_user
    assert patient.updated_by == doctor_user
    assert update_response.data["age"] == patient.age


@pytest.mark.django_db
def test_doctor_patient_list_includes_all_active_patients_and_workflow_filters(
    doctor_client,
    doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    future_patient = patient_factory(full_name="Future Connected", phone="0900000101")
    completed_appointment_patient = patient_factory(full_name="Past Appointment", phone="0900000102")
    active_visit_patient = patient_factory(full_name="Active Visit", phone="0900000103")
    completed_visit_patient = patient_factory(full_name="Completed Visit", phone="0900000104")
    unrelated_patient = patient_factory(full_name="Unrelated Patient", phone="0900000105")

    appointment_factory(patient=future_patient, doctor=doctor_user, status=Appointment.Status.UPCOMING)
    appointment_factory(
        patient=completed_appointment_patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-01T09:00:00+03:00",
        end_datetime="2026-07-01T09:30:00+03:00",
    )
    active_appointment = appointment_factory(
        patient=active_visit_patient,
        doctor=doctor_user,
        status=Appointment.Status.ACTIVE,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    completed_appointment = appointment_factory(
        patient=completed_visit_patient,
        doctor=doctor_user,
        status=Appointment.Status.COMPLETED,
        start_datetime="2026-07-21T10:00:00+03:00",
        end_datetime="2026-07-21T10:30:00+03:00",
    )
    visit_factory(appointment=active_appointment, status=Visit.Status.ACTIVE)
    visit_factory(appointment=completed_appointment, status=Visit.Status.COMPLETED)

    response = doctor_client.get("/api/patients/")
    my_patients_response = doctor_client.get("/api/patients/?my_patients=true")
    upcoming_response = doctor_client.get("/api/patients/?upcoming_with_me=true")
    last_visit_response = doctor_client.get("/api/patients/?last_visit_with_me=true")

    assert response.status_code == 200
    ids = {item["id"] for item in response.data["results"]}
    assert future_patient.id in ids
    assert completed_appointment_patient.id in ids
    assert active_visit_patient.id in ids
    assert completed_visit_patient.id in ids
    assert unrelated_patient.id in ids

    my_patient_ids = {item["id"] for item in my_patients_response.data["results"]}
    assert future_patient.id in my_patient_ids
    assert completed_appointment_patient.id in my_patient_ids
    assert active_visit_patient.id in my_patient_ids
    assert completed_visit_patient.id in my_patient_ids
    assert unrelated_patient.id not in my_patient_ids

    assert {item["id"] for item in upcoming_response.data["results"]} == {future_patient.id}
    assert {item["id"] for item in last_visit_response.data["results"]} == {active_visit_patient.id, completed_visit_patient.id}
    assert "last_visit_with_me_at" in last_visit_response.data["results"][0]


@pytest.mark.django_db
def test_doctor_patient_search_includes_all_active_patients(doctor_client, doctor_user, patient_factory, appointment_factory):
    accessible = patient_factory(full_name="Shared Search Name", phone="0912345678")
    unrelated = patient_factory(full_name="Shared Search Hidden", phone="0912349999")
    appointment_factory(patient=accessible, doctor=doctor_user)

    search_response = doctor_client.get("/api/patients/?search=Shared")
    name_response = doctor_client.get("/api/patients/?name=Shared")
    phone_response = doctor_client.get("/api/patients/?phone=091234")

    for response in (search_response, name_response, phone_response):
        assert response.status_code == 200
        ids = {item["id"] for item in response.data["results"]}
        assert accessible.id in ids
        assert unrelated.id in ids


@pytest.mark.django_db
def test_doctor_can_read_and_update_patient_with_no_prior_relation(doctor_client, doctor_user, staff_user, patient_factory):
    unrelated = patient_factory(full_name="No Prior Relation", phone="0900000201")

    detail_response = doctor_client.get(f"/api/patients/{unrelated.id}/")
    update_response = doctor_client.patch(f"/api/patients/{unrelated.id}/", {"general_notes": "Nope"}, format="json")

    assert detail_response.status_code == 200
    assert update_response.status_code == 200
    unrelated.refresh_from_db()
    assert unrelated.general_notes == "Nope"
    assert unrelated.created_by == staff_user
    assert unrelated.updated_by == doctor_user


@pytest.mark.django_db
def test_doctor_cannot_create_patient(doctor_client):
    response = doctor_client.post("/api/patients/", patient_payload(), format="json")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert Patient.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("full_name", ""),
        ("phone", ""),
    ],
)
def test_required_text_fields_cannot_be_blank(staff_client, field, value):
    response = staff_client.post("/api/patients/", patient_payload(**{field: value}), format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert field in response.data["details"]


@pytest.mark.django_db
def test_invalid_gender_rejected(staff_client):
    response = staff_client.post("/api/patients/", patient_payload(gender="UNKNOWN"), format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "gender" in response.data["details"]


@pytest.mark.django_db
def test_future_birth_date_rejected(staff_client):
    future_birth_date = timezone.localdate() + timedelta(days=1)

    response = staff_client.post(
        "/api/patients/",
        patient_payload(birth_date=future_birth_date.isoformat()),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "birth_date" in response.data["details"]


@pytest.mark.django_db
def test_valid_birth_date_and_optional_fields_accepted(staff_client):
    response = staff_client.post(
        "/api/patients/",
        {
            "full_name": "Omar Saleh",
            "phone": "0955000000",
            "gender": "MALE",
            "birth_date": "2000-01-01",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["address"] == ""
    assert response.data["medical_summary"] == ""
    assert response.data["general_notes"] == ""
    assert response.data["age"] is not None


@pytest.mark.django_db
def test_search_by_full_name_and_phone_works(staff_client, patient_factory):
    patient_factory(full_name="Lina Mansour", phone="0911111111")
    patient_factory(full_name="Karim Haddad", phone="0922222222")

    name_response = staff_client.get("/api/patients/?search=Lina")
    phone_response = staff_client.get("/api/patients/?search=0922")

    assert name_response.status_code == 200
    assert [item["full_name"] for item in name_response.data["results"]] == ["Lina Mansour"]
    assert phone_response.status_code == 200
    assert [item["phone"] for item in phone_response.data["results"]] == ["0922222222"]


@pytest.mark.django_db
def test_phone_and_name_filters_work(staff_client, patient_factory):
    patient_factory(full_name="Nour Ali", phone="0966000000")
    patient_factory(full_name="Sara Ali", phone="0977000000")

    phone_response = staff_client.get("/api/patients/?phone=0966")
    name_response = staff_client.get("/api/patients/?name=Sara")

    assert phone_response.status_code == 200
    assert [item["phone"] for item in phone_response.data["results"]] == ["0966000000"]
    assert name_response.status_code == 200
    assert [item["full_name"] for item in name_response.data["results"]] == ["Sara Ali"]


@pytest.mark.django_db
def test_archived_patients_are_excluded_by_default_and_filterable(staff_client, patient_factory):
    active = patient_factory(full_name="Active Patient", phone="0900000001")
    archived = patient_factory(full_name="Archived Patient", phone="0900000002", is_archived=True)

    default_response = staff_client.get("/api/patients/")
    archived_response = staff_client.get("/api/patients/?is_archived=true")

    assert default_response.status_code == 200
    assert [item["id"] for item in default_response.data["results"]] == [active.id]
    assert archived_response.status_code == 200
    assert [item["id"] for item in archived_response.data["results"]] == [archived.id]


@pytest.mark.django_db
def test_staff_and_admin_can_retrieve_archived_patient_with_filter(staff_client, admin_client, patient_factory):
    archived = patient_factory(full_name="Archived Filterable", phone="0900000301", is_archived=True)

    staff_response = staff_client.get("/api/patients/?is_archived=true")
    admin_response = admin_client.get("/api/patients/?is_archived=true")
    staff_detail_response = staff_client.get(f"/api/patients/{archived.id}/")
    admin_detail_response = admin_client.get(f"/api/patients/{archived.id}/")

    assert staff_response.status_code == 200
    assert [item["id"] for item in staff_response.data["results"]] == [archived.id]
    assert admin_response.status_code == 200
    assert [item["id"] for item in admin_response.data["results"]] == [archived.id]
    assert staff_detail_response.status_code == 200
    assert admin_detail_response.status_code == 200


@pytest.mark.django_db
def test_staff_can_archive_and_unarchive_patient_without_blocking_appointments(staff_client, staff_user, patient, appointment_factory):
    appointment_factory(patient=patient, status=Appointment.Status.COMPLETED)

    archive_response = staff_client.post(f"/api/patients/{patient.id}/archive/")
    patient.refresh_from_db()
    hidden_response = staff_client.get("/api/patients/")
    archived_response = staff_client.get("/api/patients/?is_archived=true")
    unarchive_response = staff_client.post(f"/api/patients/{patient.id}/unarchive/")
    patient.refresh_from_db()

    assert archive_response.status_code == 200
    assert patient.is_archived is False
    assert unarchive_response.status_code == 200
    assert unarchive_response.data["is_archived"] is False
    assert patient.updated_by == staff_user
    assert patient.id not in {item["id"] for item in hidden_response.data["results"]}
    assert patient.id in {item["id"] for item in archived_response.data["results"]}
    assert ActivityLog.objects.filter(action="patient_archived", entity_id=str(patient.id)).exists()
    assert ActivityLog.objects.filter(action="patient_unarchived", entity_id=str(patient.id)).exists()


@pytest.mark.django_db
def test_staff_can_archive_patient_by_patch_and_cannot_spoof_audit_fields(staff_client, staff_user, admin_user, patient):
    response = staff_client.patch(
        f"/api/patients/{patient.id}/",
        {"is_archived": True, "created_by": admin_user.id, "updated_by": admin_user.id, "age": 5},
        format="json",
    )

    assert response.status_code == 200
    patient.refresh_from_db()
    assert patient.is_archived is True
    assert patient.created_by_id != admin_user.id
    assert patient.updated_by_id == staff_user.id
    assert response.data["age"] == patient.age


@pytest.mark.django_db
def test_doctor_cannot_archive_or_unarchive_accessible_patient(doctor_client, doctor_user, patient, appointment_factory):
    appointment_factory(patient=patient, doctor=doctor_user)

    archive_response = doctor_client.post(f"/api/patients/{patient.id}/archive/")
    patch_archive_response = doctor_client.patch(f"/api/patients/{patient.id}/", {"is_archived": True}, format="json")
    patient.is_archived = True
    patient.save(update_fields=["is_archived"])
    unarchive_response = doctor_client.post(f"/api/patients/{patient.id}/unarchive/")
    patch_unarchive_response = doctor_client.patch(f"/api/patients/{patient.id}/", {"is_archived": False}, format="json")

    assert archive_response.status_code == 403
    assert patch_archive_response.status_code == 403
    assert unarchive_response.status_code == 403
    assert patch_unarchive_response.status_code == 404


@pytest.mark.django_db
def test_admin_cannot_archive_or_unarchive_patient(admin_client, patient):
    archive_response = admin_client.post(f"/api/patients/{patient.id}/archive/")
    patch_archive_response = admin_client.patch(f"/api/patients/{patient.id}/", {"is_archived": True}, format="json")
    patient.is_archived = True
    patient.save(update_fields=["is_archived"])
    unarchive_response = admin_client.post(f"/api/patients/{patient.id}/unarchive/")

    assert archive_response.status_code == 403
    assert patch_archive_response.status_code == 403
    assert unarchive_response.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_user_cannot_archive_or_unarchive_patient(api_client, patient):
    assert api_client.post(f"/api/patients/{patient.id}/archive/").status_code == 401
    assert api_client.post(f"/api/patients/{patient.id}/unarchive/").status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize(
    "appointment_status",
    [Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN, Appointment.Status.ACTIVE, Appointment.Status.NEEDS_RESCHEDULE],
)
def test_staff_cannot_archive_patient_with_active_operational_appointment(staff_client, patient, appointment_factory, appointment_status):
    appointment_factory(patient=patient, status=appointment_status)

    endpoint_response = staff_client.post(f"/api/patients/{patient.id}/archive/")
    patch_response = staff_client.patch(f"/api/patients/{patient.id}/", {"is_archived": True}, format="json")

    assert endpoint_response.status_code == 409
    assert endpoint_response.data["code"] == "ARCHIVE_BLOCKED"
    assert patch_response.status_code == 400
    patient.refresh_from_db()
    assert patient.is_archived is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "appointment_status",
    [Appointment.Status.CANCELLED, Appointment.Status.COMPLETED, Appointment.Status.NO_SHOW],
)
def test_staff_can_archive_patient_with_closed_appointment_statuses(staff_client, patient_factory, appointment_factory, appointment_status):
    patient = patient_factory(full_name=f"Closed {appointment_status}", phone=f"09000004{len(appointment_status)}")
    appointment_factory(patient=patient, status=appointment_status)

    response = staff_client.post(f"/api/patients/{patient.id}/archive/")

    assert response.status_code == 200
    patient.refresh_from_db()
    assert patient.is_archived is True


@pytest.mark.django_db
def test_patient_list_is_paginated(staff_client, patient_factory):
    for index in range(21):
        patient_factory(full_name=f"Patient {index:02}", phone=f"0999{index:06}")

    response = staff_client.get("/api/patients/")

    assert response.status_code == 200
    assert response.data["count"] == 21
    assert response.data["next"] is not None
    assert response.data["previous"] is None
    assert len(response.data["results"]) == 20
