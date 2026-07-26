from io import StringIO
from pathlib import Path
import struct

import pytest
from django.core.management import call_command
from django.db.models import F
from django.test import override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import StaffProfile, User
from apps.ai_results.models import AIResult
from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.dashboard.views import admin_dashboard, doctor_dashboard, staff_dashboard
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


PASSWORD = "PearlixDemo123!"
DOMAIN = "pearlix-demo.local"
PREFIX = "DEMO14A-"


def seed(*args):
    output = StringIO()
    call_command("seed_demo_clinic_story", "--password", PASSWORD, *args, stdout=output)
    return output.getvalue()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_demo_story_is_idempotent_and_reset_preserves_non_demo_data(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        assert "Seeded phase-14a-integrated-demo-story" in seed("--reference-date", "2026-08-15")
        patient_ids = list(Patient.objects.filter(national_id_or_passport__startswith=PREFIX).values_list("id", flat=True))
        assert len(patient_ids) == 24
        assert "already exists" in seed()
        assert list(Patient.objects.filter(national_id_or_passport__startswith=PREFIX).values_list("id", flat=True)) == patient_ids
        non_demo = Patient.objects.create(first_name="Independent", last_name="Record", gender="Female", national_id_or_passport="NON-DEMO-14A")
        legacy_qa_user = User.objects.create_user(
            email="legacy.qa@pearlix.local",
            password=PASSWORD,
            full_name="Legacy QA",
            role=User.Role.STAFF,
        )
        seed("--reset-demo", "--reference-date", "2026-08-15")
        assert Patient.objects.filter(pk=non_demo.pk).exists()
        assert User.objects.filter(pk=legacy_qa_user.pk, email="legacy.qa@pearlix.local").exists()
        assert Patient.objects.filter(national_id_or_passport__startswith=PREFIX).count() == 24


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_demo_story_relationships_dashboards_and_media_are_coherent(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        seed("--reset-demo", "--reference-date", "2026-08-15")

        assert User.objects.filter(email__endswith=f"@{DOMAIN}", is_active=True).count() == 8
        assert User.objects.filter(email="doctor.mustchange@pearlix-demo.local", must_change_password=True).exists()
        inactive = User.objects.get(email="staff.inactive@pearlix-demo.local")
        assert not inactive.is_active
        assert StaffProfile.objects.filter(user=inactive, is_active=False).exists()
        assert Patient.objects.filter(national_id_or_passport__startswith=PREFIX).count() == 24
        assert Appointment.objects.filter(status=Appointment.Status.NEEDS_RESCHEDULE, reschedule_source_exception__isnull=False).count() >= 2
        assert Appointment.objects.filter(status=Appointment.Status.NEEDS_RESCHEDULE, reschedule_source_working_shift__isnull=False).exists()
        assert AvailabilityException.objects.filter(doctor__isnull=False).count() >= 2
        assert AvailabilityException.objects.filter(staff__isnull=False, reason="Demo staff personal leave").exists()
        assert WorkingShift.objects.filter(employee__email="doctor.four@pearlix-demo.local", start_time="08:00").exists()
        assert WorkingShift.objects.filter(employee__email="doctor.four@pearlix-demo.local", start_time="13:00").exists()
        assert Visit.objects.filter(status=Visit.Status.ACTIVE).count() == 1
        assert Visit.objects.filter(status=Visit.Status.COMPLETED, symptoms__gt="", diagnosis__gt="", treatment__gt="", clinical_notes__gt="", follow_up_notes__gt="").exists()
        assert Visit.objects.filter(patient__national_id_or_passport=f"{PREFIX}004", status=Visit.Status.COMPLETED).count() >= 2
        assert not Visit.objects.filter(status=Visit.Status.COMPLETED).exclude(appointment__status=Appointment.Status.COMPLETED).exists()
        assert AIResult.objects.filter(status=AIResult.Status.COMPLETED, overlay_file__icontains="demo14a-overlay").exists()
        assert XrayAttachment.objects.filter(stored_file_name__startswith="demo14a-").count() >= 3
        assert XrayAttachment.objects.filter(visit__patient_id=F("patient_id")).exists()
        assert ExternalXrayCase.objects.filter(status=ExternalXrayCase.Status.TEMPORARY).exists()
        assert ExternalXrayCase.objects.filter(status=ExternalXrayCase.Status.ATTACHED_TO_PATIENT, attached_xray__isnull=False).exists()
        assert ExternalXrayCase.objects.filter(status=ExternalXrayCase.Status.DISCARDED).exists()
        assert set(BillingHandoff.objects.values_list("status", flat=True)) >= {"PENDING", "CONVERTED_TO_INVOICE", "DISMISSED"}
        converted_handoff = BillingHandoff.objects.get(status=BillingHandoff.Status.CONVERTED_TO_INVOICE)
        assert converted_handoff.converted_invoice_id
        assert converted_handoff.converted_invoice.patient_id == converted_handoff.patient_id == converted_handoff.visit.patient_id
        assert set(Invoice.objects.values_list("status", flat=True)) >= {"UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"}
        for invoice in Invoice.objects.exclude(status=Invoice.Status.CANCELLED):
            assert invoice.paid_amount + invoice.remaining_amount == invoice.total_amount
            assert all(payment.currency == invoice.currency for payment in invoice.payments.all())
        assert ActivityLog.objects.filter(metadata_json__demo_story="phase-14a-integrated-demo-story").exists()
        for metadata in ActivityLog.objects.filter(metadata_json__demo_story="phase-14a-integrated-demo-story").values_list("metadata_json", flat=True):
            assert not {"password", "token", "clinical_notes", "file"}.intersection({key.lower() for key in metadata})
        factory = APIRequestFactory()
        for email, view in (("admin@pearlix-demo.local", admin_dashboard), ("staff.one@pearlix-demo.local", staff_dashboard), ("doctor.one@pearlix-demo.local", doctor_dashboard)):
            request = factory.get("/api/dashboard/")
            force_authenticate(request, user=User.objects.get(email=email))
            response = view(request)
            assert response.status_code == 200
            assert response.data
        assert any(Path(path).name.startswith("demo14a-") for path in XrayAttachment.objects.values_list("original_file", flat=True))
        first_xray = XrayAttachment.objects.filter(stored_file_name__startswith="demo14a-").first()
        with first_xray.original_file.open("rb") as image:
            assert struct.unpack(">II", image.read(24)[16:24]) == (320, 180)
        reschedule_logs = ActivityLog.objects.filter(action="appointment_rescheduled", metadata_json__demo_story="phase-14a-integrated-demo-story")
        assert any("old" in item.metadata_json and "new" in item.metadata_json for item in reschedule_logs)
