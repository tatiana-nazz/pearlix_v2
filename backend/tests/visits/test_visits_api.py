from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.models import BillingHandoff, Invoice
from apps.billing.services import BillingRuleError
from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit


def _appointment_for(appointment_factory, doctor, status=Appointment.Status.CHECKED_IN, **overrides):
    defaults = {
        "doctor": doctor,
        "status": status,
        "start_datetime": "2026-07-20T10:00:00+03:00",
        "end_datetime": "2026-07-20T10:30:00+03:00",
    }
    defaults.update(overrides)
    return appointment_factory(**defaults)


def _visit_for(visit_factory, appointment_factory, doctor, status=Visit.Status.ACTIVE, **overrides):
    appointment_status = Appointment.Status.ACTIVE if status == Visit.Status.ACTIVE else Appointment.Status.COMPLETED
    patient = overrides.pop("patient", None)
    appointment_kwargs = {
        "start_datetime": overrides.pop("start_datetime", "2026-07-20T10:00:00+03:00"),
        "end_datetime": overrides.pop("end_datetime", "2026-07-20T10:30:00+03:00"),
    }
    if patient is not None:
        appointment_kwargs["patient"] = patient
    appointment = overrides.pop("appointment", None) or _appointment_for(
        appointment_factory,
        doctor,
        status=appointment_status,
        **appointment_kwargs,
    )
    return visit_factory(appointment=appointment, status=status, **overrides)


def _completion_payload(visit, **billing_overrides):
    billing = {
        "description": "Restorative dental treatment",
        "total_amount": "250.00",
        "currency": "SYP",
        "note": "Collect payment at reception after treatment.",
    }
    billing.update(billing_overrides)
    return {
        "version": visit.updated_at.isoformat(),
        "notes": {
            "symptoms": "Sensitivity",
            "diagnosis": "Caries",
            "treatment": "Composite restoration",
            "clinical_notes": "Completed with billing handoff.",
            "follow_up_notes": "Review in six months.",
        },
        "billing": billing,
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/visits/"),
        ("get", "/api/visits/{visit_id}/"),
        ("post", "/api/appointments/{appointment_id}/start-visit/"),
        ("get", "/api/visits/active/"),
        ("post", "/api/visits/{visit_id}/complete/"),
        ("patch", "/api/visits/{visit_id}/clinical-notes/"),
    ],
)
def test_unauthenticated_user_cannot_access_visit_endpoints(api_client, appointment_factory, visit_factory, doctor_user, method, path):
    appointment = _appointment_for(appointment_factory, doctor_user)
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)

    response = getattr(api_client, method)(
        path.format(visit_id=visit.id, appointment_id=appointment.id),
        {"symptoms": "Pain"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_and_staff_can_list_and_read_visits_read_only(admin_client, staff_client, appointment_factory, visit_factory, doctor_user):
    visit = _visit_for(
        visit_factory,
        appointment_factory,
        doctor_user,
        symptoms="Tooth pain",
        diagnosis="Caries",
        treatment="Exam",
        clinical_notes="Clinical note",
        follow_up_notes="Follow up",
    )

    for client in (admin_client, staff_client):
        list_response = client.get("/api/visits/")
        detail_response = client.get(f"/api/visits/{visit.id}/")
        edit_response = client.patch(f"/api/visits/{visit.id}/clinical-notes/", {"symptoms": "Updated"}, format="json")
        complete_response = client.post(f"/api/visits/{visit.id}/complete/")

        assert list_response.status_code == 200
        assert list_response.data["count"] == 1
        assert detail_response.status_code == 200
        assert detail_response.data["clinical_notes"] == "Clinical note"
        assert edit_response.status_code == 403
        assert edit_response.data["code"] == "PERMISSION_DENIED"
        assert complete_response.status_code == 403


@pytest.mark.django_db
def test_doctor_default_visit_list_is_own_but_detail_read_is_clinic_wide(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    unrelated_patient = patient_factory(full_name="Unrelated Visit Patient", phone="0900000501")
    own = _visit_for(visit_factory, appointment_factory, doctor_user)
    other = _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        patient=unrelated_patient,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )

    list_response = doctor_client.get("/api/visits/")
    own_response = doctor_client.get(f"/api/visits/{own.id}/")
    other_response = doctor_client.get(f"/api/visits/{other.id}/")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.data["results"]] == [own.id]
    assert own_response.status_code == 200
    assert other_response.status_code == 200
    assert other_response.data["id"] == other.id


@pytest.mark.django_db
def test_connected_doctor_can_read_another_doctors_visit_detail_for_same_patient(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
):
    old_visit = _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        status=Visit.Status.COMPLETED,
        patient=patient,
        clinical_notes="Previous doctor's clinical notes",
        diagnosis="Prior diagnosis",
    )
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T09:00:00+03:00",
        end_datetime="2026-07-25T09:30:00+03:00",
    )

    response = doctor_client.get(f"/api/visits/{old_visit.id}/")

    assert response.status_code == 200
    assert response.data["id"] == old_visit.id
    assert response.data["clinical_notes"] == "Previous doctor's clinical notes"
    assert response.data["diagnosis"] == "Prior diagnosis"


@pytest.mark.django_db
def test_doctor_can_start_own_checked_in_appointment(doctor_client, doctor_user, appointment_factory):
    appointment = _appointment_for(appointment_factory, doctor_user, status=Appointment.Status.CHECKED_IN)

    response = doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 201
    visit = Visit.objects.get(id=response.data["id"])
    appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.started_at is not None
    assert visit.patient_id == appointment.patient_id
    assert visit.doctor_id == appointment.doctor_id == doctor_user.id
    assert visit.created_by == doctor_user
    assert visit.updated_by == doctor_user
    assert appointment.status == Appointment.Status.ACTIVE
    assert appointment.updated_by == doctor_user


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_start_visit(request, client_fixture, doctor_user, appointment_factory):
    client = request.getfixturevalue(client_fixture)
    appointment = _appointment_for(appointment_factory, doctor_user, status=Appointment.Status.CHECKED_IN)

    response = client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert not Visit.objects.exists()


@pytest.mark.django_db
def test_doctor_cannot_start_another_doctors_appointment(other_doctor_client, doctor_user, appointment_factory):
    appointment = _appointment_for(appointment_factory, doctor_user, status=Appointment.Status.CHECKED_IN)

    response = other_doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 404
    assert not Visit.objects.exists()


@pytest.mark.django_db
def test_connected_doctor_cannot_start_another_doctors_appointment(doctor_client, doctor_user, other_doctor_user, patient, appointment_factory):
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T09:00:00+03:00",
        end_datetime="2026-07-25T09:30:00+03:00",
    )
    other_appointment = appointment_factory(
        patient=patient,
        doctor=other_doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-25T10:00:00+03:00",
        end_datetime="2026-07-25T10:30:00+03:00",
    )

    response = doctor_client.post(f"/api/appointments/{other_appointment.id}/start-visit/")

    assert response.status_code == 404
    assert not Visit.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "appointment_status",
    [
        Appointment.Status.UPCOMING,
        Appointment.Status.CANCELLED,
        Appointment.Status.NO_SHOW,
        Appointment.Status.ACTIVE,
        Appointment.Status.COMPLETED,
    ],
)
def test_doctor_cannot_start_visit_from_invalid_appointment_status(
    doctor_client,
    doctor_user,
    appointment_factory,
    appointment_status,
):
    appointment = _appointment_for(appointment_factory, doctor_user, status=appointment_status)

    response = doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 409
    assert response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert not Visit.objects.exists()


@pytest.mark.django_db
def test_doctor_cannot_start_appointment_that_already_has_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    appointment = _appointment_for(appointment_factory, doctor_user, status=Appointment.Status.CHECKED_IN)
    visit_factory(appointment=appointment, status=Visit.Status.ACTIVE)

    response = doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 409
    assert response.data["code"] == "INVALID_STATUS_TRANSITION"
    assert Visit.objects.count() == 1


@pytest.mark.django_db
def test_doctor_cannot_start_second_active_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    _visit_for(visit_factory, appointment_factory, doctor_user)
    appointment = _appointment_for(
        appointment_factory,
        doctor_user,
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )

    response = doctor_client.post(f"/api/appointments/{appointment.id}/start-visit/")

    assert response.status_code == 409
    assert response.data["code"] == "ACTIVE_VISIT_EXISTS"
    assert Visit.objects.count() == 1


@pytest.mark.django_db
def test_doctor_can_fetch_own_active_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, symptoms="Pain")

    response = doctor_client.get("/api/visits/active/")

    assert response.status_code == 200
    assert response.data["id"] == visit.id
    assert response.data["status"] == Visit.Status.ACTIVE
    assert response.data["symptoms"] == "Pain"
    assert response.data["appointment"]["id"] == visit.appointment_id
    assert response.data["patient"]["id"] == visit.patient_id
    assert response.data["doctor"]["id"] == doctor_user.id


@pytest.mark.django_db
def test_doctor_with_no_active_visit_receives_not_found(doctor_client):
    response = doctor_client.get("/api/visits/active/")

    assert response.status_code == 404
    assert response.data["code"] == "NOT_FOUND"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_use_active_visit_endpoint(request, client_fixture):
    client = request.getfixturevalue(client_fixture)

    response = client.get("/api/visits/active/")

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_doctor_can_complete_own_active_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)

    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", _completion_payload(visit), format="json")

    assert response.status_code == 200
    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.COMPLETED
    assert visit.completed_at is not None
    assert visit.updated_by == doctor_user
    assert visit.appointment.status == Appointment.Status.COMPLETED
    assert visit.appointment.updated_by == doctor_user
    handoff = BillingHandoff.objects.get(visit=visit)
    assert response.data["visit"]["id"] == visit.id
    assert response.data["created_handoff"]["id"] == handoff.id
    assert handoff.patient_id == visit.patient_id
    assert handoff.doctor_id == doctor_user.id
    assert handoff.description == "Restorative dental treatment"
    assert str(handoff.total_amount) == "250.00"
    assert handoff.currency == "SYP"
    assert handoff.note == "Collect payment at reception after treatment."
    assert handoff.status == BillingHandoff.Status.OPEN
    assert handoff.paid_amount == 0
    assert handoff.remaining_amount == handoff.total_amount
    assert handoff.invoice_count == 0
    assert not Invoice.objects.filter(billing_handoff=handoff).exists()
    assert visit.clinical_notes == "Completed with billing handoff."


@pytest.mark.django_db
@pytest.mark.parametrize(
    "billing_overrides",
    [
        {"description": ""},
        {"total_amount": "0"},
        {"currency": "EUR"},
    ],
)
def test_complete_visit_rejects_invalid_billing_without_state_change(doctor_client, doctor_user, appointment_factory, visit_factory, billing_overrides):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, clinical_notes="Original")

    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", _completion_payload(visit, **billing_overrides), format="json")

    assert response.status_code == 400
    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert visit.clinical_notes == "Original"
    assert not BillingHandoff.objects.filter(visit=visit).exists()


@pytest.mark.django_db
def test_complete_visit_rolls_back_when_handoff_creation_fails(monkeypatch, doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, clinical_notes="Original")

    def fail_handoff(**_kwargs):
        raise BillingRuleError("VALIDATION_ERROR", "Some fields are invalid.", {"note": ["Rejected."]})

    monkeypatch.setattr("apps.billing.services.create_visit_completion_handoff", fail_handoff)
    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", _completion_payload(visit), format="json")

    assert response.status_code == 400
    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert visit.clinical_notes == "Original"
    assert not BillingHandoff.objects.filter(visit=visit).exists()


@pytest.mark.django_db
def test_complete_visit_conflict_and_existing_handoff_preserve_active_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    conflict_visit = _visit_for(visit_factory, appointment_factory, doctor_user)
    conflict_payload = _completion_payload(conflict_visit)
    conflict_payload["version"] = "2020-01-01T00:00:00Z"
    conflict_response = doctor_client.post(f"/api/visits/{conflict_visit.id}/complete/", conflict_payload, format="json")
    assert conflict_response.status_code == 409
    assert conflict_response.data["code"] == "VERSION_CONFLICT"
    conflict_visit.refresh_from_db()
    assert conflict_visit.status == Visit.Status.ACTIVE

    conflict_visit.status = Visit.Status.COMPLETED
    conflict_visit.completed_at = timezone.now()
    conflict_visit.save(update_fields=["status", "completed_at", "updated_at"])
    second_visit = _visit_for(visit_factory, appointment_factory, doctor_user, start_datetime="2026-07-20T12:00:00+03:00", end_datetime="2026-07-20T12:30:00+03:00")
    BillingHandoff.objects.create(patient=second_visit.patient, visit=second_visit, doctor=doctor_user, description="Existing", total_amount="10.00", currency="SYP", status=BillingHandoff.Status.OPEN, origin=BillingHandoff.Origin.VISIT_COMPLETION)
    existing_response = doctor_client.post(f"/api/visits/{second_visit.id}/complete/", _completion_payload(second_visit), format="json")
    assert existing_response.status_code == 409
    assert existing_response.data["code"] == "VISIT_BILLING_EXISTS"
    second_visit.refresh_from_db()
    assert second_visit.status == Visit.Status.ACTIVE
    assert BillingHandoff.objects.filter(visit=second_visit).count() == 1


@pytest.mark.django_db
def test_repeated_complete_request_cannot_create_duplicate_handoff_or_invoice(doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)
    payload = _completion_payload(visit)

    first = doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json")
    second = doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json")

    assert first.status_code == 200
    assert second.status_code == 409
    assert BillingHandoff.objects.filter(visit=visit).count() == 1
    assert Invoice.objects.filter(billing_handoff__visit=visit).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_complete_visit(request, client_fixture, doctor_user, appointment_factory, visit_factory):
    client = request.getfixturevalue(client_fixture)
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)

    response = client.post(f"/api/visits/{visit.id}/complete/")

    assert response.status_code == 403
    visit.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE


@pytest.mark.django_db
def test_doctor_cannot_complete_another_doctors_visit(other_doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)

    response = other_doctor_client.post(f"/api/visits/{visit.id}/complete/")

    assert response.status_code == 404
    visit.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE


@pytest.mark.django_db
def test_connected_doctor_cannot_complete_or_edit_another_doctors_visit(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
):
    appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T09:00:00+03:00",
        end_datetime="2026-07-25T09:30:00+03:00",
    )
    visit = _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        patient=patient,
        clinical_notes="Do not change",
        start_datetime="2026-07-25T10:00:00+03:00",
        end_datetime="2026-07-25T10:30:00+03:00",
    )

    complete_response = doctor_client.post(f"/api/visits/{visit.id}/complete/")
    edit_response = doctor_client.patch(f"/api/visits/{visit.id}/clinical-notes/", {"clinical_notes": "Changed"}, format="json")

    assert complete_response.status_code == 404
    assert edit_response.status_code == 404
    visit.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.clinical_notes == "Do not change"


@pytest.mark.django_db
def test_doctor_cannot_complete_already_completed_visit(doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, status=Visit.Status.COMPLETED)

    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", _completion_payload(visit), format="json")

    assert response.status_code == 409
    assert response.data["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_doctor_can_edit_all_clinical_note_fields(doctor_client, doctor_user, staff_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, updated_by=staff_user)

    response = doctor_client.patch(
        f"/api/visits/{visit.id}/clinical-notes/",
        {
            "symptoms": "Pain",
            "diagnosis": "Suspected caries",
            "treatment": "Clinical exam",
            "clinical_notes": "Review X-ray later",
            "follow_up_notes": "Follow up in one week",
        },
        format="json",
    )

    assert response.status_code == 200
    visit.refresh_from_db()
    assert response.data["symptoms"] == "Pain"
    assert response.data["diagnosis"] == "Suspected caries"
    assert response.data["treatment"] == "Clinical exam"
    assert response.data["clinical_notes"] == "Review X-ray later"
    assert response.data["follow_up_notes"] == "Follow up in one week"
    assert visit.updated_by == doctor_user


@pytest.mark.django_db
def test_doctor_can_edit_completed_visit_notes_forever(doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, status=Visit.Status.COMPLETED)

    response = doctor_client.patch(f"/api/visits/{visit.id}/clinical-notes/", {"diagnosis": "Final diagnosis"}, format="json")

    assert response.status_code == 200
    visit.refresh_from_db()
    assert visit.status == Visit.Status.COMPLETED
    assert visit.diagnosis == "Final diagnosis"


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["admin_client", "staff_client"])
def test_admin_and_staff_cannot_edit_clinical_notes(request, client_fixture, doctor_user, appointment_factory, visit_factory):
    client = request.getfixturevalue(client_fixture)
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, symptoms="Original")

    response = client.patch(f"/api/visits/{visit.id}/clinical-notes/", {"symptoms": "Changed"}, format="json")

    assert response.status_code == 403
    visit.refresh_from_db()
    assert visit.symptoms == "Original"


@pytest.mark.django_db
def test_other_doctor_cannot_edit_clinical_notes(other_doctor_client, doctor_user, appointment_factory, visit_factory):
    visit = _visit_for(visit_factory, appointment_factory, doctor_user, symptoms="Original")

    response = other_doctor_client.patch(f"/api/visits/{visit.id}/clinical-notes/", {"symptoms": "Changed"}, format="json")

    assert response.status_code == 404
    visit.refresh_from_db()
    assert visit.symptoms == "Original"


@pytest.mark.django_db
def test_clinical_notes_endpoint_rejects_status_and_relationship_changes(
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    other_patient = patient_factory(full_name="Other Patient", phone="0944000000")
    visit = _visit_for(visit_factory, appointment_factory, doctor_user)
    original = {
        "status": visit.status,
        "patient_id": visit.patient_id,
        "doctor_id": visit.doctor_id,
        "appointment_id": visit.appointment_id,
        "started_at": visit.started_at,
        "completed_at": visit.completed_at,
    }

    response = doctor_client.patch(
        f"/api/visits/{visit.id}/clinical-notes/",
        {
            "status": Visit.Status.COMPLETED,
            "patient": other_patient.id,
            "doctor": other_doctor_user.id,
            "appointment": visit.appointment_id + 1,
            "started_at": timezone.now().isoformat(),
            "completed_at": timezone.now().isoformat(),
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    visit.refresh_from_db()
    assert visit.status == original["status"]
    assert visit.patient_id == original["patient_id"]
    assert visit.doctor_id == original["doctor_id"]
    assert visit.appointment_id == original["appointment_id"]
    assert visit.started_at == original["started_at"]
    assert visit.completed_at == original["completed_at"]


@pytest.mark.django_db
def test_visit_list_filters_and_doctor_scope(
    admin_client,
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    patient_factory,
    appointment_factory,
    visit_factory,
):
    other_patient = patient_factory(full_name="Filter Patient", phone="0955000000")
    now = timezone.now()
    own = _visit_for(visit_factory, appointment_factory, doctor_user, status=Visit.Status.COMPLETED, started_at=now - timedelta(days=3))
    other_patient_visit = _visit_for(
        visit_factory,
        appointment_factory,
        doctor_user,
        status=Visit.Status.COMPLETED,
        patient=other_patient,
        started_at=now - timedelta(days=2),
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )
    other_doctor_visit = _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        status=Visit.Status.ACTIVE,
        started_at=now - timedelta(days=1),
        start_datetime="2026-07-20T12:00:00+03:00",
        end_datetime="2026-07-20T12:30:00+03:00",
    )

    assert admin_client.get("/api/visits/").data["count"] == 3
    assert admin_client.get(f"/api/visits/?doctor_id={other_doctor_user.id}").data["count"] == 1
    assert admin_client.get(f"/api/visits/?patient_id={other_patient.id}").data["count"] == 1
    assert admin_client.get(f"/api/visits/?appointment_id={own.appointment_id}").data["results"][0]["id"] == own.id
    assert admin_client.get(f"/api/visits/?status={Visit.Status.ACTIVE}").data["results"][0]["id"] == other_doctor_visit.id
    started_boundary = (now - timedelta(days=2, minutes=1)).isoformat().replace("+00:00", "Z")
    assert admin_client.get(f"/api/visits/?started_from={started_boundary}").data["count"] == 2
    assert admin_client.get(f"/api/visits/?started_to={started_boundary}").data["count"] == 1

    doctor_response = doctor_client.get(f"/api/visits/?doctor_id={other_doctor_user.id}")
    assert doctor_response.status_code == 200
    assert doctor_response.data["count"] == 0
    assert doctor_client.get(f"/api/visits/?patient_id={patient.id}").data["count"] == 2
    assert doctor_client.get(f"/api/visits/?patient_id={other_patient.id}").data["results"][0]["id"] == other_patient_visit.id


@pytest.mark.django_db
def test_patient_visit_history_permissions_and_doctor_scope(
    api_client,
    admin_client,
    staff_client,
    doctor_client,
    doctor_user,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
):
    _visit_for(visit_factory, appointment_factory, doctor_user, status=Visit.Status.COMPLETED, patient=patient)
    _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        status=Visit.Status.COMPLETED,
        patient=patient,
        start_datetime="2026-07-20T11:00:00+03:00",
        end_datetime="2026-07-20T11:30:00+03:00",
    )

    anonymous_response = api_client.get(f"/api/patients/{patient.id}/visits/")
    admin_response = admin_client.get(f"/api/patients/{patient.id}/visits/")
    staff_response = staff_client.get(f"/api/patients/{patient.id}/visits/")
    doctor_response = doctor_client.get(f"/api/patients/{patient.id}/visits/")

    assert anonymous_response.status_code == 401
    assert admin_response.status_code == 200
    assert admin_response.data["count"] == 2
    assert staff_response.status_code == 200
    assert staff_response.data["count"] == 2
    assert doctor_response.status_code == 200
    assert doctor_response.data["count"] == 2
    assert {item["doctor"]["id"] for item in doctor_response.data["results"]} == {doctor_user.id, other_doctor_user.id}


@pytest.mark.django_db
def test_connected_doctor_patient_history_includes_all_visits_from_future_or_past_connection(
    doctor_client,
    doctor_user,
    other_doctor_client,
    other_doctor_user,
    patient,
    appointment_factory,
    visit_factory,
):
    old_visit = _visit_for(
        visit_factory,
        appointment_factory,
        other_doctor_user,
        status=Visit.Status.COMPLETED,
        patient=patient,
        start_datetime="2026-07-20T09:00:00+03:00",
        end_datetime="2026-07-20T09:30:00+03:00",
    )
    future_connection = appointment_factory(
        patient=patient,
        doctor=doctor_user,
        status=Appointment.Status.UPCOMING,
        start_datetime="2026-07-25T09:00:00+03:00",
        end_datetime="2026-07-25T09:30:00+03:00",
    )

    future_response = doctor_client.get(f"/api/patients/{patient.id}/visits/")
    filtered_response = doctor_client.get(f"/api/visits/?patient_id={patient.id}")

    assert future_response.status_code == 200
    assert future_response.data["count"] == 1
    assert future_response.data["results"][0]["id"] == old_visit.id
    assert filtered_response.status_code == 200
    assert filtered_response.data["count"] == 1
    assert filtered_response.data["results"][0]["id"] == old_visit.id

    future_connection.status = Appointment.Status.COMPLETED
    future_connection.save(update_fields=["status", "updated_at"])
    past_response = doctor_client.get(f"/api/patients/{patient.id}/visits/")
    assert past_response.status_code == 200
    assert past_response.data["count"] == 1

    new_visit = _visit_for(
        visit_factory,
        appointment_factory,
        doctor_user,
        status=Visit.Status.COMPLETED,
        patient=patient,
        start_datetime="2026-07-26T09:00:00+03:00",
        end_datetime="2026-07-26T09:30:00+03:00",
    )
    old_doctor_response = other_doctor_client.get(f"/api/patients/{patient.id}/visits/")

    assert old_doctor_response.status_code == 200
    assert {item["id"] for item in old_doctor_response.data["results"]} == {old_visit.id, new_visit.id}
