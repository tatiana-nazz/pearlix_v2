from collections import Counter
from datetime import datetime, timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.common.management.commands import populate_demo_analytics as analytics_module
from apps.common.management.commands.seed_demo import Command as SeedDemoCommand
from apps.common.management.commands.populate_demo_analytics import (
    CLINIC_TZ,
    MARKER,
    PATIENT_NOTES,
    PATIENT_PREFIX,
    RANGE_END,
    RANGE_START,
)
from apps.common.management.commands.populate_demo_analytics_realistic import (
    DAILY_LOAD_PATTERN,
    Command as AnalyticsCommand,
)
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


pytestmark = pytest.mark.django_db(transaction=True)


def test_demo_seed_creates_coherent_longitudinal_stories_and_is_resettable():
    output = StringIO()
    supplied_password = "StrongDemoPassword!2026"
    call_command("seed_demo", password=supplied_password, stdout=output)

    assert User.objects.filter(email__endswith="@pearlix.demo").count() == 4
    assert Patient.objects.filter(national_id_or_passport__startswith="DEMO-P").count() == 10
    assert Appointment.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 15
    assert Visit.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 8
    assert BillingHandoff.objects.filter(patient__national_id_or_passport__startswith="DEMO-P").count() >= 8
    clinic = ClinicSettings.get_solo()
    assert clinic.weekly_closed_days == [4]
    assert WorkingShift.objects.filter(
        employee__email="sara.doctor@pearlix.demo", weekday=4, is_active=True
    ).exists()
    assert "consistency audit PASS" in output.getvalue()
    assert supplied_password not in output.getvalue()

    # A reset replaces demo records without duplicating them.
    call_command("seed_demo", reset=True, password="StrongDemoPassword!2026")
    assert User.objects.filter(email__endswith="@pearlix.demo").count() == 4
    assert Patient.objects.filter(national_id_or_passport__startswith="DEMO-P").count() == 10


def test_demo_seed_requires_an_explicit_password_and_creates_no_rows():
    with pytest.raises(CommandError, match="Provide the local/test demo password"):
        call_command("seed_demo")

    assert not User.objects.filter(email__endswith="@pearlix.demo").exists()
    assert not Patient.objects.filter(
        national_id_or_passport__startswith="DEMO-P"
    ).exists()


def test_realistic_analytics_population_requires_billing_provenance_and_canonical_finalization(monkeypatch):
    # Exercise the real Phase 1 audit date, when the base seed's relative
    # unavailability story overlaps the fixed analytics range and Aug 20 slots
    # would otherwise be created as already-past UPCOMING appointments.
    audit_now = timezone.make_aware(datetime(2026, 8, 20, 18), CLINIC_TZ)
    monkeypatch.setattr(timezone, "now", lambda: audit_now)
    call_command("seed_demo", password="StrongDemoPassword!2026")
    output = StringIO()

    call_command("populate_demo_analytics_realistic", stdout=output)

    supplemental_visits = Visit.objects.filter(
        patient__national_id_or_passport__startswith=PATIENT_PREFIX,
        status=Visit.Status.COMPLETED,
    )
    assert supplemental_visits.exists()
    assert not supplemental_visits.filter(billing_handoffs__isnull=True).exists()
    population_output = output.getvalue()
    assert "Pearlix demo finalization PASS" in population_output
    assert "analytics demo population completed; consistency audit PASS" in population_output
    assert population_output.index("Pearlix demo finalization PASS") < population_output.index(
        "analytics demo population completed; consistency audit PASS"
    )

    finalizer_output = StringIO()
    call_command("finalize_demo_seed", stdout=finalizer_output)
    assert "Pearlix demo finalization PASS" in finalizer_output.getvalue()

    analytics_appointments = Appointment.objects.filter(
        patient__national_id_or_passport__startswith=PATIENT_PREFIX,
        notes__startswith=MARKER,
    )
    window_days = Counter(
        timezone.localtime(start, CLINIC_TZ).date()
        for start in analytics_appointments.filter(
            start_datetime__date__gte=RANGE_START,
            start_datetime__date__lte=RANGE_END,
        ).values_list("start_datetime", flat=True)
    )
    expected_days = []
    closed_weekdays = set(ClinicSettings.get_solo().weekly_closed_days)
    assert closed_weekdays == {4}
    day = RANGE_START
    while day <= RANGE_END:
        if day.weekday() not in closed_weekdays:
            expected_days.append(day)
        day += timedelta(days=1)
    assert window_days == Counter(
        {
            day: DAILY_LOAD_PATTERN[index % len(DAILY_LOAD_PATTERN)]
            for index, day in enumerate(expected_days)
        }
    )
    assert all(day.weekday() not in closed_weekdays for day in window_days)
    assert len(set(window_days.values())) > 1

    cancelled = analytics_appointments.filter(status=Appointment.Status.CANCELLED)
    no_show = analytics_appointments.filter(status=Appointment.Status.NO_SHOW)
    assert cancelled.exists()
    assert no_show.exists()
    cancelled_or_no_show = analytics_appointments.filter(
        status__in=(Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW)
    )
    assert not Visit.objects.filter(appointment__in=cancelled_or_no_show).exists()
    assert not analytics_appointments.filter(
        status=Appointment.Status.NEEDS_RESCHEDULE
    ).exists()
    assert Appointment.objects.filter(
        patient__national_id_or_passport__startswith="DEMO-P",
        status=Appointment.Status.NEEDS_RESCHEDULE,
    ).filter(
        Q(reschedule_source_exception__isnull=False)
        | Q(reschedule_source_working_shift__isnull=False)
    ).exists()
    supplemental_invoices = list(Invoice.objects.filter(
        billing_handoff__patient__national_id_or_passport__startswith=PATIENT_PREFIX
    ).select_related("billing_handoff"))
    assert supplemental_invoices
    for invoice in supplemental_invoices:
        assert invoice.issued_at >= invoice.billing_handoff.created_at


@pytest.mark.parametrize(
    ("closed_weekdays", "expected_populated_weekday"),
    [
        ([6], 4),
        ([4, 5], 6),
    ],
)
def test_analytics_population_derives_alternative_weekly_closures(
    monkeypatch, closed_weekdays, expected_populated_weekday
):
    audit_now = timezone.make_aware(datetime(2026, 8, 20, 18), CLINIC_TZ)
    monkeypatch.setattr(timezone, "now", lambda: audit_now)

    # Build only the canonical demo team/schedule substrate. This keeps the
    # alternative-policy proof independent from appointments created under the
    # canonical [4] demo policy.
    seed_command = SeedDemoCommand()
    users = seed_command.create_users("StrongDemoPassword!2026")
    seed_command.configure_clinic()
    seed_command.create_shifts(users)
    clinic = ClinicSettings.get_solo()
    clinic.weekly_closed_days = closed_weekdays
    clinic.save(update_fields=["weekly_closed_days", "updated_at"])

    output = StringIO()
    call_command("populate_demo_analytics_realistic", stdout=output)

    generated_starts = list(
        Appointment.objects.filter(notes__startswith=MARKER).values_list(
            "start_datetime", flat=True
        )
    )
    generated_weekdays = {
        timezone.localtime(start, CLINIC_TZ).weekday()
        for start in generated_starts
    }
    assert generated_starts
    assert not (generated_weekdays & set(closed_weekdays))
    assert expected_populated_weekday in generated_weekdays
    assert "Pearlix demo finalization PASS" in output.getvalue()


def test_analytics_reset_scope_preserves_unrelated_patient(patient_factory):
    supplemental = patient_factory(
        national_id_or_passport=f"{PATIENT_PREFIX}001",
        email="analytics.patient.001@example.demo",
        general_notes=PATIENT_NOTES,
    )
    unrelated = patient_factory(national_id_or_passport="USER-OWNED-TEST")

    AnalyticsCommand().reset_generated()

    assert not Patient.objects.filter(pk=supplemental.pk).exists()
    assert Patient.objects.filter(pk=unrelated.pk).exists()


def test_analytics_reset_fails_closed_on_reserved_prefix_collision(patient_factory):
    supplemental = patient_factory(
        national_id_or_passport=f"{PATIENT_PREFIX}001",
        email="analytics.patient.001@example.demo",
        general_notes=PATIENT_NOTES,
    )
    collision = patient_factory(national_id_or_passport=f"{PATIENT_PREFIX}USER")

    with pytest.raises(CommandError, match="reserved patient prefix"):
        AnalyticsCommand().reset_generated()

    assert Patient.objects.filter(pk=supplemental.pk).exists()
    assert Patient.objects.filter(pk=collision.pk).exists()


def test_analytics_population_rolls_back_when_canonical_finalizer_fails(monkeypatch):
    call_command("seed_demo", password="StrongDemoPassword!2026")
    output = StringIO()

    def reject_finalization(*args, **kwargs):
        raise CommandError("forced canonical finalizer failure")

    monkeypatch.setattr(analytics_module, "call_command", reject_finalization)
    with pytest.raises(CommandError, match="forced canonical finalizer failure"):
        call_command("populate_demo_analytics_realistic", stdout=output)

    assert not Patient.objects.filter(
        national_id_or_passport__startswith=PATIENT_PREFIX
    ).exists()
    assert "analytics demo population completed" not in output.getvalue()


def test_analytics_reset_restores_previous_dataset_when_finalizer_fails(monkeypatch):
    call_command("seed_demo", password="StrongDemoPassword!2026")
    call_command("populate_demo_analytics_realistic")
    previous_patient_ids = set(
        Patient.objects.filter(
            national_id_or_passport__startswith=PATIENT_PREFIX
        ).values_list("id", flat=True)
    )
    previous_appointment_ids = set(
        Appointment.objects.filter(patient_id__in=previous_patient_ids).values_list(
            "id", flat=True
        )
    )
    output = StringIO()

    def reject_finalization(*args, **kwargs):
        raise CommandError("forced canonical finalizer failure")

    monkeypatch.setattr(analytics_module, "call_command", reject_finalization)
    with pytest.raises(CommandError, match="forced canonical finalizer failure"):
        call_command("populate_demo_analytics_realistic", reset=True, stdout=output)

    assert set(
        Patient.objects.filter(
            national_id_or_passport__startswith=PATIENT_PREFIX
        ).values_list("id", flat=True)
    ) == previous_patient_ids
    assert set(
        Appointment.objects.filter(patient_id__in=previous_patient_ids).values_list(
            "id", flat=True
        )
    ) == previous_appointment_ids
    assert "analytics demo population completed" not in output.getvalue()


def test_canonical_finalizer_rejects_payment_before_billing_handoff():
    call_command("seed_demo", password="StrongDemoPassword!2026")
    invoice = Invoice.objects.select_related("billing_handoff__visit").first()
    assert invoice is not None
    visit = invoice.billing_handoff.visit
    Invoice.objects.filter(pk=invoice.pk).update(
        issued_at=(visit.completed_at or visit.started_at) - timedelta(minutes=1)
    )

    with pytest.raises(CommandError, match="predates its billing handoff"):
        call_command("finalize_demo_seed")


def test_canonical_finalizer_rejects_operational_booking_on_configured_closed_weekday():
    call_command("seed_demo", password="StrongDemoPassword!2026")
    upcoming = Appointment.objects.filter(
        patient__national_id_or_passport__startswith="DEMO-P",
        status=Appointment.Status.UPCOMING,
    ).first()
    assert upcoming is not None
    closed_weekday = timezone.localtime(
        upcoming.start_datetime, CLINIC_TZ
    ).weekday()
    clinic = ClinicSettings.get_solo()
    clinic.weekly_closed_days = [closed_weekday]
    clinic.save(update_fields=["weekly_closed_days", "updated_at"])

    with pytest.raises(CommandError, match="configured closed weekday"):
        call_command("finalize_demo_seed")
