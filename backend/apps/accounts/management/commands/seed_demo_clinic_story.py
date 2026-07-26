"""Seed the coherent, development-only Phase 14A clinic demonstration story."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import binascii
import struct
import zlib

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.ai_results.models import AIResult
from apps.ai_results.services import run_ai_for_xray
from apps.audit.models import ActivityLog
from apps.audit.services import log_activity
from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.billing.services import (
    cancel_invoice,
    convert_handoff_to_invoice,
    create_billing_handoff,
    create_invoice,
    dismiss_handoff,
    record_payment,
)
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, AvailabilityException, WorkingShift
from apps.scheduling.serializers import AppointmentDetailSerializer
from apps.scheduling.services import mark_overlapping_appointments_needs_reschedule, update_appointment, update_working_shift
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment
from apps.xrays.services import (
    attach_external_case_to_patient,
    create_external_xray_case,
    create_xray_attachment,
    discard_external_case,
)


DEMO_TAG = "phase-14a-integrated-demo-story"
EMAIL_DOMAIN = "pearlix-demo.local"
PATIENT_ID_PREFIX = "DEMO14A-"
DEFAULT_PASSWORD = "PearlixDemo123!"
def _png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF)


def _synthetic_dental_png(width=320, height=180):
    """Return a visibly useful, deterministic grayscale PNG without external dependencies."""
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            center = abs(x - width / 2) / (width / 2)
            arch = abs(y - (70 + 38 * center))
            tooth = 76 if arch < 22 and 22 < x < width - 22 else 0
            roots = 36 if 92 < y < 160 and ((x // 24) % 2 == 0) else 0
            grain = (x * 7 + y * 11) % 20
            value = max(12, min(235, 26 + tooth + roots + grain))
            row.extend((value, value, value, 255))
        rows.append(bytes(row))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header) + _png_chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + _png_chunk(b"IEND", b"")


PNG_BYTES = _synthetic_dental_png()

USER_SPECS = (
    ("admin", "Nour Haddad", User.Role.ADMIN, False),
    ("staff.one", "Maya Saleh", User.Role.STAFF, False),
    ("staff.two", "Rana Darwish", User.Role.STAFF, False),
    ("doctor.one", "Dr. Samir Nasser", User.Role.DOCTOR, False),
    ("doctor.two", "Dr. Leila Hamdan", User.Role.DOCTOR, False),
    ("doctor.three", "Dr. Omar Khoury", User.Role.DOCTOR, False),
    ("doctor.four", "Dr. Yasmin Barakat", User.Role.DOCTOR, False),
)
MUST_CHANGE_SPEC = ("doctor.mustchange", "Dr. Fadi Saad", User.Role.DOCTOR, True)
INACTIVE_SPEC = ("staff.inactive", "Salma Khatib", User.Role.STAFF, False)
DOCTOR_PROFILE_SPECS = {
    "doctor.one": ("Endodontics", "+963-11-410-1001", "Root-canal and restorative care."),
    "doctor.two": ("Orthodontics", "+963-11-410-1002", "Orthodontic planning and follow-up."),
    "doctor.three": ("Periodontics", "+963-11-410-1003", "Gum-health and periodontal treatment."),
    "doctor.four": ("Prosthodontics", "+963-11-410-1004", "Restorative and prosthetic treatment."),
    "doctor.mustchange": ("General Dentistry", "+963-11-410-1005", "General dental care."),
}
STAFF_PROFILE_SPECS = {
    "staff.one": ("Clinic Coordinator", "+963-11-420-1001"),
    "staff.two": ("Reception", "+963-11-420-1002"),
    "staff.inactive": ("Former Receptionist", "+963-11-420-1003"),
}

PATIENT_NAMES = (
    ("Amina", "Khalil", "Female"), ("Karim", "Azzam", "Male"),
    ("Lina", "Mansour", "Female"), ("Tarek", "Youssef", "Male"),
    ("Hala", "Sabbagh", "Female"), ("Nabil", "Jaber", "Male"),
    ("Samar", "Daher", "Female"), ("Firas", "Najjar", "Male"),
    ("Rima", "Zein", "Female"), ("Adel", "Haddad", "Male"),
    ("Mira", "Sayegh", "Female"), ("Wissam", "Maalouf", "Male"),
    ("Dima", "Karam", "Female"), ("Jad", "Toma", "Male"),
    ("Nour", "Atieh", "Female"), ("Bassam", "Salloum", "Male"),
    ("Reem", "Assaf", "Female"), ("Hani", "Mikhael", "Male"),
    ("Sawsan", "Rahme", "Female"), ("Ibrahim", "Saad", "Male"),
    ("Yara", "Matar", "Female"), ("Maher", "Elias", "Male"),
    ("Dania", "Farhat", "Female"), ("Riad", "Hakim", "Male"),
)


class Command(BaseCommand):
    help = "Create the deterministic, development-only Phase 14A integrated clinic demo story."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Local demo password (default: PearlixDemo123!).")
        parser.add_argument("--reset-demo", action="store_true", help="Delete only records explicitly tagged as this demo story before seeding.")
        parser.add_argument("--include-must-change-user", action="store_true", help="Compatibility flag; the QA password-change account is always included.")
        parser.add_argument("--reference-date", help="Deterministic local reference date in YYYY-MM-DD format.")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Refusing to seed the demo clinic story when DEBUG is false.")
        reference_date = self._reference_date(options["reference_date"])
        if options["reset_demo"]:
            self._reset_demo()
        elif User.objects.filter(email__endswith=f"@{EMAIL_DOMAIN}").exists():
            self.stdout.write("Demo story already exists; no duplicate records were created. Use --reset-demo to rebuild it.")
            return

        with transaction.atomic():
            accounts = self._create_accounts(options["password"])
            self._configure_clinic(accounts["admin"])
            patients = self._create_patients(accounts["staff.one"], reference_date)
            self._create_schedules(accounts, reference_date)
            story = self._create_appointments_and_visits(accounts, patients, reference_date)
            story["imaging"] = self._create_imaging_story(accounts, patients, story)
            story["billing"] = self._create_billing_story(accounts, patients, story)
            self._log_story(accounts, patients, story)

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {DEMO_TAG}: {len(patients)} patients, {Appointment.objects.filter(patient__national_id_or_passport__startswith=PATIENT_ID_PREFIX).count()} appointments."
        ))
        self.stdout.write("QA accounts (local development only):")
        for key in ("admin", "staff.one", "staff.two", "doctor.one", "doctor.two", "doctor.three", "doctor.four", "doctor.mustchange"):
            self.stdout.write(f"- {accounts[key].email} / {options['password']}")
        self.stdout.write(f"  {accounts['doctor.mustchange'].email} requires a password change.")
        self.stdout.write(f"- {accounts['staff.inactive'].email} (inactive; sign-in intentionally blocked)")

    def _reference_date(self, raw):
        if not raw:
            clinic_tz = ZoneInfo(ClinicSettings.get_solo().timezone)
            return timezone.localtime(timezone.now(), clinic_tz).date()
        try:
            return date.fromisoformat(raw)
        except ValueError as exc:
            raise CommandError("--reference-date must use YYYY-MM-DD.") from exc

    def _create_accounts(self, password):
        accounts = {}
        specs = list(USER_SPECS) + [MUST_CHANGE_SPEC, INACTIVE_SPEC]
        for slug, full_name, role, must_change in specs:
            email = f"{slug}@{EMAIL_DOMAIN}"
            user = User.objects.create_user(
                email=email, password=password, full_name=full_name, role=role,
                is_active=slug != "staff.inactive", is_staff=role == User.Role.ADMIN, is_superuser=role == User.Role.ADMIN,
                must_change_password=must_change,
            )
            if role == User.Role.DOCTOR:
                specialty, phone, bio = DOCTOR_PROFILE_SPECS[slug]
                DoctorProfile.objects.create(user=user, specialty=specialty, phone=phone, bio=bio, is_active=True)
            elif role == User.Role.STAFF:
                position, phone = STAFF_PROFILE_SPECS[slug]
                StaffProfile.objects.create(user=user, position=position, phone=phone, is_active=user.is_active)
            accounts[slug] = user
            log_activity(actor=user, action="demo_user_created", entity_type="user", entity_id=user.id, metadata={"demo_story": DEMO_TAG, "role": role})
        return accounts

    def _configure_clinic(self, admin):
        clinic = ClinicSettings.get_solo()
        clinic.clinic_name = "Pearlix Dental Clinic"
        clinic.address = "Damascus, Syria"
        clinic.phone = "+963-11-400-2026"
        clinic.email = "hello@pearlix-demo.local"
        clinic.timezone = "Asia/Damascus"
        clinic.default_language = ClinicSettings.Language.EN
        clinic.default_currency = ClinicSettings.Currency.SYP
        clinic.supported_currencies = ["SYP", "USD"]
        clinic.default_appointment_duration_minutes = 30
        clinic.allowed_durations_minutes = [15, 30, 45, 60]
        clinic.capacity_per_slot = 3
        clinic.ai_mode = ClinicSettings.AiMode.MOCK_ADAPTER
        clinic.save()
        log_activity(actor=admin, action="clinic_settings_updated", entity_type="clinic_settings", entity_id=clinic.id, metadata={"demo_story": DEMO_TAG, "timezone": clinic.timezone})

    def _create_patients(self, staff, reference_date):
        patients = []
        for index, (first, last, gender) in enumerate(PATIENT_NAMES, start=1):
            patient = Patient.objects.create(
                first_name=first, last_name=last, gender=gender,
                date_of_birth=date(reference_date.year - (20 + index), max(1, (index % 12) + 1), min(28, (index % 27) + 1)),
                phone_number=f"+963-93-{index:07d}", email=f"patient{index}@{EMAIL_DOMAIN}",
                national_id_or_passport=f"{PATIENT_ID_PREFIX}{index:03d}", address="Synthetic Damascus address",
                emergency_contact="Synthetic emergency contact", blood_group="O+" if index % 2 else "A+",
                medical_conditions_history="Synthetic demo medical summary.", insurance_info="Demo self-pay", general_notes="Synthetic demo record.",
                created_by=staff, updated_by=staff,
            )
            patients.append(patient)
            log_activity(actor=staff, action="patient_created", entity_type="patient", entity_id=patient.id, metadata={"demo_story": DEMO_TAG, "patient_id": patient.id})
        patients[18].is_archived = True
        patients[18].version += 1
        patients[18].save(update_fields=["is_archived", "version", "updated_at"])
        patients[0].general_notes = "Synthetic demo record updated for the integrated story."
        patients[0].version += 1
        patients[0].save(update_fields=["general_notes", "version", "updated_at"])
        log_activity(actor=staff, action="patient_updated", entity_type="patient", entity_id=patients[0].id, metadata={"demo_story": DEMO_TAG, "patient_id": patients[0].id})
        return patients

    def _create_schedules(self, accounts, reference_date):
        for doctor_key in ("doctor.one", "doctor.two", "doctor.three", "doctor.four"):
            doctor = accounts[doctor_key]
            for weekday in range(7):
                if doctor_key == "doctor.four":
                    ranges = ((time(8), time(12)), (time(13), time(17)))
                else:
                    ranges = ((time(8), time(17)),)
                for number, (start, end) in enumerate(ranges, start=1):
                    WorkingShift.objects.create(employee=doctor, name=f"Demo {doctor_key} shift {number}", weekday=weekday, start_time=start, end_time=end, created_by=accounts["admin"], updated_by=accounts["admin"])
        for staff_key in ("staff.one", "staff.two"):
            for weekday in range(7):
                ranges = ((time(8), time(12)), (time(13), time(16))) if staff_key == "staff.two" else ((time(8), time(16)),)
                for number, (start, end) in enumerate(ranges, start=1):
                    WorkingShift.objects.create(employee=accounts[staff_key], name=f"Demo staff shift {number}", weekday=weekday, start_time=start, end_time=end, created_by=accounts["admin"], updated_by=accounts["admin"])
        AvailabilityException.objects.create(
            staff=accounts["staff.one"], start_datetime=self._dt(reference_date + timedelta(days=2), 12),
            end_datetime=self._dt(reference_date + timedelta(days=2), 16), type=AvailabilityException.Type.UNAVAILABLE,
            reason="Demo staff personal leave", created_by=accounts["admin"], updated_by=accounts["admin"],
        )

    def _dt(self, day, hour, minute=0):
        return timezone.make_aware(datetime.combine(day, time(hour, minute)), timezone.get_current_timezone())

    def _appointment(self, *, patient, doctor, start, duration, status, staff, reason):
        end = start + timedelta(minutes=duration)
        appointment = Appointment.objects.create(patient=patient, doctor=doctor, start_datetime=start, end_datetime=end, duration_minutes=duration, status=status, reason=reason, notes="Synthetic Phase 14A appointment.", created_by=staff, updated_by=staff)
        if status == Appointment.Status.CHECKED_IN:
            appointment.checked_in_at = start
            appointment.save(update_fields=["checked_in_at", "updated_at"])
        return appointment

    def _completed_visit(self, appointment, doctor, staff, *, notes=True):
        started = appointment.start_datetime + timedelta(minutes=5)
        return Visit.objects.create(appointment=appointment, patient=appointment.patient, doctor=doctor, status=Visit.Status.COMPLETED, started_at=started, completed_at=started + timedelta(minutes=25), symptoms="Synthetic sensitivity" if notes else "", diagnosis="Synthetic finding" if notes else "", treatment="Synthetic treatment" if notes else "", clinical_notes="Synthetic clinical note" if notes else "", follow_up_notes="Synthetic follow-up" if notes else "", created_by=doctor, updated_by=doctor)

    def _create_appointments_and_visits(self, accounts, patients, reference_date):
        staff, d1, d2, d3, d4 = accounts["staff.one"], accounts["doctor.one"], accounts["doctor.two"], accounts["doctor.three"], accounts["doctor.four"]
        today = reference_date
        past = today - timedelta(days=7)
        future = today + timedelta(days=3)
        app = {}
        app["today_confirmed"] = self._appointment(patient=patients[0], doctor=d1, start=self._dt(today, 10), duration=30, status=Appointment.Status.UPCOMING, staff=staff, reason="Today confirmed")
        app["checked_in"] = self._appointment(patient=patients[1], doctor=d2, start=self._dt(today, 10), duration=45, status=Appointment.Status.CHECKED_IN, staff=staff, reason="Checked in")
        active_app = self._appointment(patient=patients[2], doctor=d3, start=self._dt(today, 11), duration=30, status=Appointment.Status.ACTIVE, staff=staff, reason="Active visit")
        active_visit = Visit.objects.create(appointment=active_app, patient=patients[2], doctor=d3, status=Visit.Status.ACTIVE, started_at=self._dt(today, 11, 5), symptoms="Synthetic active symptom", created_by=d3, updated_by=d3)
        completed = []
        for index in range(3, 14):
            doctor = (d1, d2, d4)[index % 3]
            appointment = self._appointment(patient=patients[index], doctor=doctor, start=self._dt(past - timedelta(days=index % 3), 9 + (index % 5)), duration=(15, 30, 45, 60)[index % 4], status=Appointment.Status.COMPLETED, staff=staff, reason="Completed history")
            completed.append(self._completed_visit(appointment, doctor, staff, notes=index != 13))
            app[f"completed_{index}"] = appointment
        returning_appointment = self._appointment(patient=patients[3], doctor=d1, start=self._dt(past - timedelta(days=25), 15), duration=30, status=Appointment.Status.COMPLETED, staff=staff, reason="Returning patient history")
        completed.append(self._completed_visit(returning_appointment, d1, staff))
        app["returning_history"] = returning_appointment
        app["cancelled"] = self._appointment(patient=patients[19], doctor=d1, start=self._dt(today + timedelta(days=5), 9), duration=30, status=Appointment.Status.CANCELLED, staff=staff, reason="Cancelled demo")
        app["no_show"] = self._appointment(patient=patients[20], doctor=d2, start=self._dt(past, 15), duration=30, status=Appointment.Status.NO_SHOW, staff=staff, reason="No show demo")
        app["future"] = self._appointment(patient=patients[21], doctor=d4, start=self._dt(today + timedelta(days=6), 14), duration=60, status=Appointment.Status.UPCOMING, staff=staff, reason="Future split shift")
        app["future_second_doctor"] = self._appointment(patient=patients[22], doctor=d3, start=self._dt(today + timedelta(days=6), 14), duration=30, status=Appointment.Status.UPCOMING, staff=staff, reason="Parallel clinic capacity")
        leave_impacted = []
        for index, minute in ((8, 0), (9, 30), (10, 0)):
            leave_impacted.append(self._appointment(patient=patients[index], doctor=d1, start=self._dt(future, 9, minute), duration=30, status=Appointment.Status.UPCOMING, staff=staff, reason="Leave conflict workflow"))
        leave = AvailabilityException.objects.create(doctor=d1, start_datetime=self._dt(future, 9), end_datetime=self._dt(future, 11), type=AvailabilityException.Type.UNAVAILABLE, reason="Demo approved leave", created_by=accounts["admin"], updated_by=accounts["admin"])
        marked = mark_overlapping_appointments_needs_reschedule(availability_exception=leave, actor=accounts["admin"])
        for index, appointment in enumerate(marked):
            app[f"leave_{index}"] = appointment
        rescheduled = marked[0]
        old_slot = {"doctor_id": rescheduled.doctor_id, "start_datetime": rescheduled.start_datetime.isoformat()}
        appointment_serializer = AppointmentDetailSerializer(instance=rescheduled, data={"doctor_id": d2.id, "start_datetime": self._dt(future, 14), "duration_minutes": 30}, partial=True)
        appointment_serializer.is_valid(raise_exception=True)
        app["rescheduled"] = update_appointment(appointment=rescheduled, serializer=appointment_serializer, user=staff)
        log_activity(actor=staff, action="appointment_rescheduled", entity_type="appointment", entity_id=rescheduled.id, metadata={"demo_story": DEMO_TAG, "old": old_slot, "new": {"doctor_id": d2.id, "start_datetime": app["rescheduled"].start_datetime.isoformat()}})
        second_leave = AvailabilityException.objects.create(doctor=d3, start_datetime=self._dt(today + timedelta(days=5), 13), end_datetime=self._dt(today + timedelta(days=5), 17), type=AvailabilityException.Type.UNAVAILABLE, reason="Demo training leave", created_by=accounts["admin"], updated_by=accounts["admin"])
        shift = WorkingShift.objects.filter(employee=d2, weekday=(today + timedelta(days=4)).weekday(), start_time=time(8)).first()
        shift_change_day = today + timedelta(days=4)
        shifted = self._appointment(patient=patients[10], doctor=d2, start=self._dt(shift_change_day, 16), duration=30, status=Appointment.Status.UPCOMING, staff=staff, reason="Shift change conflict workflow")
        shift_serializer = type("ShiftUpdate", (), {"validated_data": {"end_time": time(15), "version": shift.version}})()
        shift, impacted_count = update_working_shift(instance=shift, serializer=shift_serializer, user=accounts["admin"], confirm_appointment_impact=True)
        if impacted_count != 1:
            raise CommandError("The deterministic shift-change story did not affect exactly one appointment.")
        shifted.refresh_from_db()
        app["shift"] = shifted
        return {"appointments": app, "active_visit": active_visit, "completed_visits": completed, "leave": leave, "second_leave": second_leave, "shift": shift}

    def _upload(self, filename):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(filename, PNG_BYTES, content_type="image/png")

    def _create_imaging_story(self, accounts, patients, story):
        d1, d2 = accounts["doctor.one"], accounts["doctor.two"]
        completed = story["completed_visits"]
        xray = create_xray_attachment(patient=patients[4], visit=completed[1], uploaded_by=completed[1].doctor, uploaded_file=self._upload("demo14a-original-ai.png"), stored_file_name="demo14a-original-ai.png", title="Synthetic demo X-ray with mock AI", notes="Non-clinical synthetic image.")
        result = run_ai_for_xray(xray_attachment=xray, user=completed[1].doctor)
        result.overlay_file.save("demo14a-overlay.png", ContentFile(PNG_BYTES), save=False)
        result.result_summary = "Mock/supportive only — not a diagnosis."
        result.save()
        create_xray_attachment(patient=patients[5], visit=completed[2], uploaded_by=completed[2].doctor, uploaded_file=self._upload("demo14a-original-no-ai.png"), stored_file_name="demo14a-original-no-ai.png", title="Synthetic demo X-ray without AI", notes="Non-clinical synthetic image.")
        temporary = create_external_xray_case(uploaded_by=d1, uploaded_file=self._upload("demo14a-external-temporary.png"), stored_file_name="demo14a-external-temporary.png", title="Temporary synthetic external image", notes="Non-clinical synthetic image.")
        attached = create_external_xray_case(uploaded_by=d2, uploaded_file=self._upload("demo14a-external-attached.png"), stored_file_name="demo14a-external-attached.png", title="Attached synthetic external image", notes="Non-clinical synthetic image.")
        attach_external_case_to_patient(external_case=attached, patient=patients[7], visit=None, user=d2, title="Attached synthetic external image", notes="Synthetic demo attachment.")
        discarded = create_external_xray_case(uploaded_by=d1, uploaded_file=self._upload("demo14a-external-discarded.png"), stored_file_name="demo14a-external-discarded.png", title="Discarded synthetic external image", notes="Non-clinical synthetic image.")
        discard_external_case(external_case=discarded, user=d1)
        return {"xray": xray, "temporary": temporary, "attached": attached, "discarded": discarded}

    def _create_billing_story(self, accounts, patients, story):
        doctor, staff = accounts["doctor.one"], accounts["staff.one"]
        visits = story["completed_visits"]
        pending = create_billing_handoff(visit=visits[7], user=visits[7].doctor, data={"note": "Pending demo handoff", "suggested_amount": "250000.00", "currency": "SYP"})
        converted = create_billing_handoff(visit=visits[8], user=visits[8].doctor, data={"note": "Convert demo handoff", "suggested_amount": "100.00", "currency": "USD"})
        converted_invoice = convert_handoff_to_invoice(handoff=converted, user=staff, data={"total_amount": "100.00", "currency": "USD", "notes": "Converted demo invoice"})
        dismissed = create_billing_handoff(visit=visits[9], user=visits[9].doctor, data={"note": "Dismiss demo handoff", "suggested_amount": "125000.00", "currency": "SYP"})
        dismiss_handoff(handoff=dismissed, user=staff, data={"dismissed_reason": "Synthetic duplicate billing route"})
        unpaid = create_invoice(user=staff, data={"patient": patients[14], "currency": "SYP", "total_amount": "300000.00", "notes": "Unpaid demo invoice"})
        partial = create_invoice(user=staff, data={"patient": patients[15], "currency": "SYP", "total_amount": "200000.00", "notes": "Partial demo invoice"})
        record_payment(invoice=partial, user=staff, data={"amount": "75000.00", "currency": "SYP"})
        paid = create_invoice(user=staff, data={"patient": patients[16], "currency": "USD", "total_amount": "120.00", "notes": "Paid demo invoice"})
        record_payment(invoice=paid, user=staff, data={"amount": "120.00", "currency": "USD"})
        cancelled = create_invoice(user=staff, data={"patient": patients[17], "currency": "SYP", "total_amount": "180000.00", "notes": "Cancelled demo invoice"})
        cancel_invoice(invoice=cancelled, user=staff, data={"cancelled_reason": "Synthetic cancellation"})
        return {"pending": pending, "converted": converted, "converted_invoice": converted_invoice, "dismissed": dismissed, "unpaid": unpaid, "partial": partial, "paid": paid, "cancelled": cancelled}

    def _log_story(self, accounts, patients, story):
        actor = accounts["admin"]
        for action, entity_type, entity_id in (
            ("appointment_created", "appointment", story["appointments"]["today_confirmed"].id),
            ("appointment_checked_in", "appointment", story["appointments"]["checked_in"].id),
            ("appointment_rescheduled", "appointment", story["appointments"]["rescheduled"].id),
            ("leave_created", "availability_exception", story["leave"].id),
            ("working_shift_changed", "working_shift", story["shift"].id),
            ("visit_started", "visit", story["active_visit"].id),
            ("visit_completed", "visit", story["completed_visits"][0].id),
        ):
            log_activity(actor=actor, action=action, entity_type=entity_type, entity_id=entity_id, metadata={"demo_story": DEMO_TAG, "record_id": entity_id})
        for xray in XrayAttachment.objects.filter(patient__national_id_or_passport__startswith=PATIENT_ID_PREFIX):
            log_activity(actor=xray.uploaded_by, action="xray_uploaded", entity_type="xray", entity_id=xray.id, metadata={"demo_story": DEMO_TAG, "xray_id": xray.id})
        for action, item in (("ai_run", story["imaging"]["xray"]),):
            if item:
                log_activity(actor=item.uploaded_by, action=action, entity_type="xray", entity_id=item.id, metadata={"demo_story": DEMO_TAG, "xray_id": item.id})
        for action, entity_type, entity_id, actor in (
            ("billing_handoff_created", "billing_handoff", story["billing"]["pending"].id, story["billing"]["pending"].doctor),
            ("billing_handoff_converted", "billing_handoff", story["billing"]["converted"].id, accounts["staff.one"]),
            ("billing_handoff_dismissed", "billing_handoff", story["billing"]["dismissed"].id, accounts["staff.one"]),
            ("invoice_created", "invoice", story["billing"]["converted_invoice"].id, accounts["staff.one"]),
            ("payment_recorded", "invoice", story["billing"]["paid"].id, accounts["staff.one"]),
        ):
            log_activity(actor=actor, action=action, entity_type=entity_type, entity_id=entity_id, metadata={"demo_story": DEMO_TAG, "record_id": entity_id})

    def _reset_demo(self):
        patient_ids = list(Patient.objects.filter(national_id_or_passport__startswith=PATIENT_ID_PREFIX).values_list("id", flat=True))
        user_ids = list(User.objects.filter(email__endswith=f"@{EMAIL_DOMAIN}").values_list("id", flat=True))
        files = []
        for field in ("original_file",):
            files.extend(XrayAttachment.objects.filter(patient_id__in=patient_ids).values_list(field, flat=True))
            files.extend(ExternalXrayCase.objects.filter(uploaded_by_id__in=user_ids).values_list(field, flat=True))
        files.extend(AIResult.objects.filter(xray_attachment__patient_id__in=patient_ids).values_list("overlay_file", flat=True))
        with transaction.atomic():
            ActivityLog.objects.filter(metadata_json__demo_story=DEMO_TAG).delete()
            Payment.objects.filter(invoice__patient_id__in=patient_ids).delete()
            Invoice.objects.filter(patient_id__in=patient_ids).delete()
            BillingHandoff.objects.filter(patient_id__in=patient_ids).delete()
            AIResult.objects.filter(xray_attachment__patient_id__in=patient_ids).delete()
            ExternalXrayCase.objects.filter(uploaded_by_id__in=user_ids).delete()
            XrayAttachment.objects.filter(patient_id__in=patient_ids).delete()
            Visit.objects.filter(patient_id__in=patient_ids).delete()
            Appointment.objects.filter(patient_id__in=patient_ids).delete()
            AvailabilityException.objects.filter(doctor_id__in=user_ids).delete()
            WorkingShift.objects.filter(employee_id__in=user_ids).delete()
            Patient.objects.filter(id__in=patient_ids).delete()
            User.objects.filter(id__in=user_ids).delete()
        for name in files:
            if name and Path(name).name.startswith("demo14a-"):
                try:
                    (Path(settings.MEDIA_ROOT) / name).unlink(missing_ok=True)
                except OSError:
                    pass
