from datetime import datetime, time, timedelta
from io import StringIO
from zoneinfo import ZoneInfo

import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.accounts.models import User
from apps.ai_results.models import AIResult
from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.xrays.models import XrayAttachment


PASSWORD = "PearlixDemo123!"
DOMAIN = "pearlix-demo.local"
PREFIX = "DEMO14A-"


def seed(*args):
    output = StringIO()
    call_command("seed_demo_clinic_story", "--password", PASSWORD, *args, stdout=output)
    return output.getvalue()


def demo_counts():
    return {
        "users": User.objects.filter(email__endswith=f"@{DOMAIN}").count(),
        "patients": Patient.objects.filter(national_id_or_passport__startswith=PREFIX).count(),
        "appointments": Appointment.objects.filter(patient__national_id_or_passport__startswith=PREFIX).count(),
        "visits": Visit.objects.filter(patient__national_id_or_passport__startswith=PREFIX).count(),
        "handoffs": BillingHandoff.objects.filter(patient__national_id_or_passport__startswith=PREFIX).count(),
        "invoices": Invoice.objects.filter(billing_handoff__patient__national_id_or_passport__startswith=PREFIX).count(),
    }


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_demo_story_reset_is_safe_and_second_seed_is_idempotent(tmp_path, billing_handoff_factory, invoice_factory):
    non_demo_bill = billing_handoff_factory(description="Preserve non-demo", total_amount="45.00")
    non_demo_invoice = invoice_factory(billing_handoff=non_demo_bill, amount="15.00")
    with override_settings(MEDIA_ROOT=tmp_path):
        output = seed("--reset-demo", "--reference-date", "2026-08-08")
        assert "Seeded phase-14a-integrated-demo-story" in output
        first = demo_counts()
        assert first["users"] == 9
        assert first["patients"] == 24
        assert first["handoffs"] == 6
        assert first["invoices"] == 6
        assert BillingHandoff.objects.filter(pk=non_demo_bill.pk).exists()
        assert Invoice.objects.filter(pk=non_demo_invoice.pk).exists()
        idempotent = seed("--reference-date", "2026-08-08")
        assert "no duplicate records were created" in idempotent
        assert demo_counts() == first


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_demo_financial_story_has_canonical_statuses_currencies_and_multiple_receipts(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        seed("--reset-demo", "--reference-date", "2026-08-08")
    demo_bills = BillingHandoff.objects.filter(patient__national_id_or_passport__startswith=PREFIX)
    demo_invoices = Invoice.objects.filter(billing_handoff__in=demo_bills)
    assert set(demo_bills.values_list("status", flat=True)) == set(BillingHandoff.Status.values)
    assert set(demo_bills.values_list("currency", flat=True)) == {"SYP", "USD"}
    assert not demo_bills.filter(origin=BillingHandoff.Origin.MANUAL).exists()
    current_bills = demo_bills.exclude(origin=BillingHandoff.Origin.LEGACY_MIGRATED)
    assert current_bills.exists()
    assert not current_bills.filter(visit__isnull=True).exists()
    assert not current_bills.filter(doctor__isnull=True).exists()
    for bill in current_bills.select_related("visit"):
        assert bill.origin == BillingHandoff.Origin.VISIT_COMPLETION
        assert bill.visit.status == Visit.Status.COMPLETED
        assert bill.patient_id == bill.visit.patient_id
        assert bill.doctor_id == bill.visit.doctor_id
    assert demo_bills.filter(status=BillingHandoff.Status.PARTIALLY_PAID, invoices__isnull=False).distinct().exists()
    assert demo_bills.filter(status=BillingHandoff.Status.PAID, invoices__isnull=False).distinct().exists()
    assert any(bill.invoice_count >= 2 for bill in demo_bills)
    assert not hasattr(Invoice, "status")
    clinic_tz = ZoneInfo("Asia/Damascus")
    start = datetime.combine(datetime(2026, 8, 8).date(), time.min, tzinfo=clinic_tz)
    assert demo_invoices.filter(issued_at__gte=start, issued_at__lt=start + timedelta(days=1)).count() == 2


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_canonical_lina_visit_remains_active_without_financial_records(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        seed("--reset-demo", "--reference-date", "2026-08-08")
    lina = Patient.objects.get(first_name="Lina", last_name="Mansour", national_id_or_passport__startswith=PREFIX)
    visit = Visit.objects.get(patient=lina, status=Visit.Status.ACTIVE)
    assert visit.doctor.full_name == "Dr. Samir Nasser"
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert visit.completed_at is None
    assert BillingHandoff.objects.filter(visit=visit).count() == 0
    assert Invoice.objects.filter(billing_handoff__visit=visit).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ai_mode",
    [
        ClinicSettings.AiMode.DJANGO_INTERNAL,
        ClinicSettings.AiMode.SEPARATE_SERVICE,
        ClinicSettings.AiMode.MOCK_ADAPTER,
    ],
)
@override_settings(DEBUG=True)
def test_demo_story_preserves_existing_ai_mode_and_seeds_no_ai_results(tmp_path, ai_mode):
    clinic = ClinicSettings.get_solo()
    clinic.ai_mode = ai_mode
    clinic.save(update_fields=["ai_mode", "updated_at"])

    with override_settings(MEDIA_ROOT=tmp_path):
        seed("--reset-demo", "--reference-date", "2026-08-08")

    clinic.refresh_from_db()
    assert clinic.ai_mode == ai_mode
    assert AIResult.objects.count() == 0
    assert not AIResult.objects.filter(model_version="pearlix-mock-xray-v1").exists()
    assert XrayAttachment.objects.filter(
        patient__national_id_or_passport__startswith=PREFIX
    ).exists()
    assert not ActivityLog.objects.filter(
        metadata_json__demo_story="phase-14a-integrated-demo-story",
        action__in=["ai_run", "xray_ai_run"],
    ).exists()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_demo_story_runs_without_preexisting_clinic_settings(tmp_path):
    assert not ClinicSettings.objects.exists()

    with override_settings(MEDIA_ROOT=tmp_path):
        output = seed("--reset-demo", "--reference-date", "2026-08-08")

    assert "Seeded phase-14a-integrated-demo-story" in output
    assert ClinicSettings.objects.exists()
    assert demo_counts()["patients"] == 24
    assert AIResult.objects.count() == 0
