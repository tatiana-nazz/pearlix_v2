from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from threading import Barrier
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from django.db import close_old_connections, connection
from django.db.models.query import QuerySet

from apps.accounts.models import User
from apps.clinic.models import ClinicSettings
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    cancel_appointment,
    check_in_appointment,
    create_appointment,
    mark_appointment_no_show,
    update_appointment,
)
from apps.scheduling.clinic_week_services import update_clinic_settings
from apps.scheduling.exception_services import save_availability_exception
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.scheduling.serializers import (
    AppointmentDetailSerializer,
    AvailabilityExceptionSerializer,
)
from apps.patients.models import Patient
from apps.visits.models import Visit
from apps.visits.services import VisitRuleError, start_visit_from_appointment


def add_shift(doctor):
    return WorkingShift.objects.create(
        employee=doctor,
        name="Phase 3 concurrency shift",
        weekday=0,
        start_time="09:00",
        end_time="17:00",
    )


@pytest.mark.django_db
def test_appointment_patch_requires_version_and_rejects_stale_write(
    staff_client,
    appointment_factory,
    doctor_user,
):
    add_shift(doctor_user)
    appointment = appointment_factory()

    missing = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"reason": "Missing version"},
        format="json",
    )
    assert missing.status_code == 400
    assert missing.data["code"] == "VERSION_REQUIRED"

    first = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"reason": "First writer", "version": appointment.version},
        format="json",
    )
    assert first.status_code == 200
    assert first.data["version"] == appointment.version + 1

    stale = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"reason": "Stale writer", "version": appointment.version},
        format="json",
    )
    assert stale.status_code == 409
    assert stale.data["code"] == "VERSION_CONFLICT"

    appointment.refresh_from_db()
    assert appointment.reason == "First writer"
    assert appointment.version == first.data["version"]


@pytest.mark.django_db
def test_status_mutations_reload_locked_state_and_advance_version(
    staff_user,
    appointment_factory,
):
    appointment = appointment_factory()
    stale = Appointment.objects.get(pk=appointment.pk)

    cancelled = cancel_appointment(appointment=appointment, user=staff_user)
    assert cancelled.version == appointment.version + 1

    with pytest.raises(AppointmentRuleError) as exc_info:
        check_in_appointment(appointment=stale, user=staff_user)
    assert exc_info.value.code == "INVALID_STATUS_TRANSITION"

    with pytest.raises(AppointmentRuleError) as exc_info:
        mark_appointment_no_show(appointment=stale, user=staff_user)
    assert exc_info.value.code == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db
def test_edit_started_before_check_in_is_rejected_as_stale(
    staff_client,
    appointment_factory,
):
    appointment = appointment_factory()
    stale_version = appointment.version

    check_in = staff_client.post(f"/api/appointments/{appointment.id}/check-in/")
    assert check_in.status_code == 200

    edit = staff_client.patch(
        f"/api/appointments/{appointment.id}/",
        {"reason": "Stale edit", "version": stale_version},
        format="json",
    )
    assert edit.status_code == 409
    assert edit.data["code"] == "VERSION_CONFLICT"

    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.CHECKED_IN
    assert appointment.reason != "Stale edit"


@pytest.mark.django_db
def test_start_visit_and_cancel_revalidate_one_authoritative_appointment_state(
    doctor_client,
    staff_client,
    appointment_factory,
):
    cancelled_first = appointment_factory(status=Appointment.Status.CHECKED_IN)
    assert staff_client.post(f"/api/appointments/{cancelled_first.id}/cancel/").status_code == 200
    rejected_start = doctor_client.post(f"/api/appointments/{cancelled_first.id}/start-visit/")
    assert rejected_start.status_code == 409
    assert rejected_start.data["code"] == "INVALID_STATUS_TRANSITION"
    assert not Visit.objects.filter(appointment=cancelled_first).exists()

    started_first = appointment_factory(
        status=Appointment.Status.CHECKED_IN,
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    started = doctor_client.post(f"/api/appointments/{started_first.id}/start-visit/")
    assert started.status_code == 201
    rejected_cancel = staff_client.post(f"/api/appointments/{started_first.id}/cancel/")
    assert rejected_cancel.status_code == 409
    assert rejected_cancel.data["code"] == "INVALID_STATUS_TRANSITION"

    started_first.refresh_from_db()
    assert started_first.status == Appointment.Status.ACTIVE
    assert Visit.objects.filter(appointment=started_first, status=Visit.Status.ACTIVE).count() == 1


@pytest.mark.django_db
def test_update_and_transition_lock_paths_are_explicit_and_ordered(
    monkeypatch,
    staff_user,
    appointment_factory,
    doctor_user,
):
    add_shift(doctor_user)
    appointment = appointment_factory()
    selected_models = []
    original = QuerySet.select_for_update

    def tracked(queryset, *args, **kwargs):
        selected_models.append(queryset.model)
        return original(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "select_for_update", tracked)
    update_appointment(
        appointment=appointment,
        serializer=SimpleNamespace(validated_data={"reason": "Locked update", "version": appointment.version}),
        user=staff_user,
    )

    assert (
        selected_models.index(ClinicSettings)
        < selected_models.index(Patient)
        < selected_models.index(User)
        < selected_models.index(Appointment)
    )

    selected_models.clear()
    appointment.refresh_from_db()
    cancel_appointment(appointment=appointment, user=staff_user)
    assert Appointment in selected_models


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("operation", "target_kind"),
    [
        ("create", "patient"),
        ("create", "doctor"),
        ("update", "patient"),
        ("update", "doctor"),
    ],
)
def test_appointment_mutations_revalidate_patient_and_doctor_after_lock(
    operation,
    target_kind,
    staff_user,
    doctor_user,
    other_doctor_user,
    patient,
    patient_factory,
    appointment_factory,
):
    add_shift(doctor_user)
    target_patient = patient if operation == "create" else patient_factory(
        first_name="Second",
        last_name="Patient",
        phone_number="0933000001",
    )
    target_doctor = doctor_user if operation == "create" else other_doctor_user
    if operation == "update" and target_kind == "doctor":
        add_shift(target_doctor)

    if operation == "create":
        appointment = None
        serializer = AppointmentDetailSerializer(
            data={
                "patient_id": target_patient.pk,
                "doctor_id": target_doctor.pk,
                "start_datetime": "2026-07-20T11:00:00+03:00",
                "duration_minutes": 30,
                "reason": "TOCTOU create",
            }
        )
    else:
        appointment = appointment_factory()
        payload = {"version": appointment.version}
        if target_kind == "patient":
            payload["patient_id"] = target_patient.pk
        else:
            payload["doctor_id"] = target_doctor.pk
        serializer = AppointmentDetailSerializer(
            instance=appointment,
            data=payload,
            partial=True,
        )
    assert serializer.is_valid(), serializer.errors

    if target_kind == "patient":
        Patient.objects.filter(pk=target_patient.pk).update(is_archived=True)
        expected_field = "patient_id"
    else:
        User.objects.filter(pk=target_doctor.pk).update(is_active=False)
        expected_field = "doctor_id"

    with pytest.raises(AppointmentRuleError) as exc_info:
        if operation == "create":
            create_appointment(serializer=serializer, user=staff_user)
        else:
            update_appointment(
                appointment=appointment,
                serializer=serializer,
                user=staff_user,
            )
    assert exc_info.value.code == "VALIDATION_ERROR"
    assert expected_field in exc_info.value.details
    if operation == "create":
        assert not Appointment.objects.filter(reason="TOCTOU create").exists()
    else:
        appointment.refresh_from_db()
        assert appointment.patient_id == patient.pk
        assert appointment.doctor_id == doctor_user.pk


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("transition", "expected_status"),
    [
        (check_in_appointment, Appointment.Status.CHECKED_IN),
        (cancel_appointment, Appointment.Status.CANCELLED),
    ],
)
def test_edit_vs_transition_has_only_serial_outcomes(
    transition,
    expected_status,
    staff_user,
    appointment_factory,
    doctor_user,
):
    add_shift(doctor_user)

    transition_first = appointment_factory()
    submitted_version = transition_first.version
    transition(appointment=transition_first, user=staff_user)
    with pytest.raises(AppointmentRuleError) as exc_info:
        update_appointment(
            appointment=transition_first,
            serializer=SimpleNamespace(
                validated_data={"reason": "Losing stale edit", "version": submitted_version}
            ),
            user=staff_user,
        )
    assert exc_info.value.code == "VERSION_CONFLICT"
    transition_first.refresh_from_db()
    assert transition_first.status == expected_status
    assert transition_first.reason != "Losing stale edit"

    edit_first = appointment_factory(
        start_datetime="2026-07-20T10:00:00+03:00",
        end_datetime="2026-07-20T10:30:00+03:00",
    )
    original_version = edit_first.version
    update_appointment(
        appointment=edit_first,
        serializer=SimpleNamespace(
            validated_data={"reason": "Committed edit", "version": original_version}
        ),
        user=staff_user,
    )
    transitioned = transition(appointment=edit_first, user=staff_user)
    assert transitioned.status == expected_status
    assert transitioned.reason == "Committed edit"
    assert transitioned.version == original_version + 2


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("first", "second", "second_succeeds", "expected_status"),
    [
        (cancel_appointment, check_in_appointment, False, Appointment.Status.CANCELLED),
        (check_in_appointment, cancel_appointment, True, Appointment.Status.CANCELLED),
        (cancel_appointment, mark_appointment_no_show, False, Appointment.Status.CANCELLED),
        (mark_appointment_no_show, cancel_appointment, False, Appointment.Status.NO_SHOW),
        (check_in_appointment, mark_appointment_no_show, False, Appointment.Status.CHECKED_IN),
        (mark_appointment_no_show, check_in_appointment, False, Appointment.Status.NO_SHOW),
    ],
)
def test_competing_transitions_have_only_legal_serial_outcomes(
    first,
    second,
    second_succeeds,
    expected_status,
    staff_user,
    appointment_factory,
):
    appointment = appointment_factory()
    stale_second = Appointment.objects.get(pk=appointment.pk)
    first_result = first(appointment=appointment, user=staff_user)

    if second_succeeds:
        second_result = second(appointment=stale_second, user=staff_user)
        assert second_result.status == expected_status
        assert second_result.version == first_result.version + 1
    else:
        with pytest.raises(AppointmentRuleError) as exc_info:
            second(appointment=stale_second, user=staff_user)
        assert exc_info.value.code == "INVALID_STATUS_TRANSITION"

    appointment.refresh_from_db()
    assert appointment.status == expected_status


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_concurrent_stale_edits_have_one_winner(
    staff_user,
    appointment_factory,
    doctor_user,
):
    add_shift(doctor_user)
    appointment = appointment_factory()
    submitted_version = appointment.version
    barrier = Barrier(2)

    def run(reason):
        close_old_connections()
        try:
            actor = User.objects.get(pk=staff_user.pk)
            target = Appointment.objects.get(pk=appointment.pk)
            barrier.wait(timeout=10)
            update_appointment(
                appointment=target,
                serializer=SimpleNamespace(validated_data={"reason": reason, "version": submitted_version}),
                user=actor,
            )
            return "ok"
        except AppointmentRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run, ["Writer A", "Writer B"]))

    assert results.count("ok") == 1
    assert results.count("VERSION_CONFLICT") == 1
    appointment.refresh_from_db()
    assert appointment.reason in {"Writer A", "Writer B"}
    assert appointment.version == submitted_version + 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_start_visit_vs_cancel_has_coherent_serial_outcome(
    staff_user,
    doctor_user,
    appointment_factory,
):
    appointment = appointment_factory(status=Appointment.Status.CHECKED_IN)
    barrier = Barrier(2)

    def start():
        close_old_connections()
        try:
            target = Appointment.objects.get(pk=appointment.pk)
            actor = User.objects.get(pk=doctor_user.pk)
            barrier.wait(timeout=10)
            start_visit_from_appointment(appointment=target, user=actor)
            return "started"
        except VisitRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    def cancel():
        close_old_connections()
        try:
            target = Appointment.objects.get(pk=appointment.pk)
            actor = User.objects.get(pk=staff_user.pk)
            barrier.wait(timeout=10)
            cancel_appointment(appointment=target, user=actor)
            return "cancelled"
        except AppointmentRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(start), executor.submit(cancel)]
        results = [future.result(timeout=20) for future in results]

    appointment.refresh_from_db()
    if appointment.status == Appointment.Status.ACTIVE:
        assert results.count("started") == 1
        assert Visit.objects.filter(appointment=appointment, status=Visit.Status.ACTIVE).count() == 1
    else:
        assert appointment.status == Appointment.Status.CANCELLED
        assert results.count("cancelled") == 1
        assert not Visit.objects.filter(appointment=appointment).exists()
    assert any(result == "INVALID_STATUS_TRANSITION" for result in results)


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_two_start_visit_requests_create_one_visit(
    doctor_user,
    appointment_factory,
):
    appointment = appointment_factory(status=Appointment.Status.CHECKED_IN)
    barrier = Barrier(2)

    def run():
        close_old_connections()
        try:
            target = Appointment.objects.get(pk=appointment.pk)
            actor = User.objects.get(pk=doctor_user.pk)
            barrier.wait(timeout=10)
            start_visit_from_appointment(appointment=target, user=actor)
            return "ok"
        except VisitRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: run(), range(2)))

    assert results.count("ok") == 1
    assert results.count("INVALID_STATUS_TRANSITION") == 1
    assert Visit.objects.filter(appointment=appointment).count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_reschedule_vs_leave_mutation_has_coherent_serial_outcome(
    staff_user,
    appointment_factory,
    doctor_user,
):
    zone = ZoneInfo("Asia/Damascus")
    monday_start = datetime(2030, 7, 1, 10, 0, tzinfo=zone)
    tuesday_start = datetime(2030, 7, 2, 10, 0, tzinfo=zone)
    add_shift(doctor_user)
    WorkingShift.objects.create(
        employee=doctor_user,
        name="Tuesday concurrency shift",
        weekday=1,
        start_time="09:00",
        end_time="17:00",
    )
    appointment = appointment_factory(
        start_datetime=monday_start,
        end_datetime=monday_start.replace(minute=30),
    )
    submitted_version = appointment.version
    barrier = Barrier(2)

    def reschedule():
        close_old_connections()
        try:
            target = Appointment.objects.get(pk=appointment.pk)
            actor = User.objects.get(pk=staff_user.pk)
            barrier.wait(timeout=10)
            update_appointment(
                appointment=target,
                serializer=SimpleNamespace(
                    validated_data={
                        "start_datetime": tuesday_start,
                        "version": submitted_version,
                    }
                ),
                user=actor,
            )
            return "rescheduled"
        except AppointmentRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    def create_leave():
        close_old_connections()
        try:
            actor = User.objects.get(pk=staff_user.pk)
            serializer = AvailabilityExceptionSerializer(
                data={
                    "doctor_id": doctor_user.pk,
                    "start_datetime": monday_start.isoformat(),
                    "end_datetime": monday_start.replace(hour=11).isoformat(),
                    "type": AvailabilityException.Type.UNAVAILABLE,
                    "reason": "Concurrent leave",
                }
            )
            serializer.is_valid(raise_exception=True)
            barrier.wait(timeout=10)
            save_availability_exception(serializer=serializer, user=actor)
            return "leave-created"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(reschedule), executor.submit(create_leave)]
        results = [future.result(timeout=20) for future in futures]

    appointment.refresh_from_db()
    assert "leave-created" in results
    if "rescheduled" in results:
        assert appointment.status == Appointment.Status.UPCOMING
        assert appointment.start_datetime == tuesday_start
        assert appointment.reschedule_source_kind is None
    else:
        assert "VERSION_CONFLICT" in results
        assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
        assert appointment.start_datetime == monday_start
        assert appointment.reschedule_source_kind == Appointment.RescheduleSourceKind.LEAVE


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="PostgreSQL row-lock interleaving requires a PostgreSQL test database.",
)
def test_postgresql_reschedule_vs_clinic_closure_has_coherent_serial_outcome(
    admin_user,
    staff_user,
    appointment_factory,
    doctor_user,
):
    zone = ZoneInfo("Asia/Damascus")
    monday_start = datetime(2030, 7, 1, 10, 0, tzinfo=zone)
    tuesday_start = datetime(2030, 7, 2, 10, 0, tzinfo=zone)
    add_shift(doctor_user)
    WorkingShift.objects.create(
        employee=doctor_user,
        name="Tuesday concurrency shift",
        weekday=1,
        start_time="09:00",
        end_time="17:00",
    )
    appointment = appointment_factory(
        start_datetime=monday_start,
        end_datetime=monday_start.replace(minute=30),
    )
    submitted_version = appointment.version
    barrier = Barrier(2)

    def reschedule():
        close_old_connections()
        try:
            target = Appointment.objects.get(pk=appointment.pk)
            actor = User.objects.get(pk=staff_user.pk)
            barrier.wait(timeout=10)
            update_appointment(
                appointment=target,
                serializer=SimpleNamespace(
                    validated_data={
                        "start_datetime": tuesday_start,
                        "version": submitted_version,
                    }
                ),
                user=actor,
            )
            return "rescheduled"
        except AppointmentRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    def close_monday():
        close_old_connections()
        try:
            settings = ClinicSettings.get_solo()
            actor = User.objects.get(pk=admin_user.pk)
            barrier.wait(timeout=10)
            update_clinic_settings(
                settings=settings,
                validated_data={
                    "weekly_closed_days": [0, 4],
                    "confirm_appointment_impact": True,
                },
                actor=actor,
            )
            return "monday-closed"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(reschedule), executor.submit(close_monday)]
        results = [future.result(timeout=20) for future in futures]

    appointment.refresh_from_db()
    assert "monday-closed" in results
    if "rescheduled" in results:
        assert appointment.status == Appointment.Status.UPCOMING
        assert appointment.start_datetime == tuesday_start
        assert appointment.reschedule_source_kind is None
    else:
        assert "VERSION_CONFLICT" in results
        assert appointment.status == Appointment.Status.NEEDS_RESCHEDULE
        assert appointment.start_datetime == monday_start
        assert (
            appointment.reschedule_source_kind
            == Appointment.RescheduleSourceKind.CLINIC_WEEKLY_CLOSURE
        )
