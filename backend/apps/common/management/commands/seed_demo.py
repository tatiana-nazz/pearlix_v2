from __future__ import annotations

from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.crypto import get_random_string

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.ai_results.models import AIResult
from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.billing.services import refresh_handoff_status
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.patients.selectors import annotate_patient_directory, patient_has_archive_blocking_appointments
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    validate_appointment_slot,
    validate_capacity,
    validate_doctor_conflict,
    validate_duration,
    validate_unavailable_exception,
    validate_working_hours,
)
from apps.scheduling.exception_services import mark_overlapping_appointments_needs_reschedule
from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


DEMO_EMAIL_SUFFIX = "@pearlix.demo"
DEMO_PATIENT_PREFIX = "DEMO-P"
DEMO_SEED_AGENT = "pearlix-demo-seed"
CLINIC_TZ = ZoneInfo("Asia/Damascus")


def aware(day, hour, minute=0):
    return timezone.make_aware(datetime.combine(day, time(hour, minute)), CLINIC_TZ)


def working_day(anchor, delta, closed_weekdays):
    day = anchor + timedelta(days=delta)
    direction = 1 if delta >= 0 else -1
    while day.weekday() in closed_weekdays:
        day += timedelta(days=direction)
    return day


def next_weekday(anchor, weekday, minimum_days=1):
    day = anchor + timedelta(days=minimum_days)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day


class Command(BaseCommand):
    help = "Seed staging with coherent fictitious Pearlix demo stories and audit them."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Replace demo records only; preserve non-demo data.")
        parser.add_argument("--password", default="", help="Shared demo password; random when omitted.")

    def handle(self, *args, **options):
        password = options["password"] or get_random_string(22)
        existing = User.objects.filter(email__endswith=DEMO_EMAIL_SUFFIX).exists() or Patient.objects.filter(
            national_id_or_passport__startswith=DEMO_PATIENT_PREFIX
        ).exists()
        if existing and not options["reset"]:
            raise CommandError("Demo data already exists. Re-run with --reset to replace only demo records.")

        with transaction.atomic():
            if options["reset"]:
                self.reset_demo()
            users = self.create_users(password)
            self.configure_clinic()
            self.create_shifts(users)
            patients = self.create_patients(users["staff"])
            story = self.create_story_records(users, patients)
            self.create_audit_trail(users, story)
            errors = self.audit_consistency()
            if errors:
                raise CommandError("Seed consistency audit failed:\n- " + "\n- ".join(errors))

        self.stdout.write(self.style.SUCCESS("Pearlix demo seed completed; consistency audit PASS."))
        self.stdout.write("\nDemo accounts:")
        for label, email in (
            ("Admin", "admin@pearlix.demo"),
            ("Staff", "rana.staff@pearlix.demo"),
            ("Doctor", "sara.doctor@pearlix.demo"),
            ("Doctor", "omar.doctor@pearlix.demo"),
        ):
            self.stdout.write(f"  {label:6} {email}")
        self.stdout.write(f"  Password for all demo accounts: {password}")
        self.stdout.write("\nStories: Layla restorative; Omar endodontic; Maya periodontal; Karim no-show/rebook; Noor extraction; Rami needs-reschedule; Hala archived history; Dima new; Tarek cancel/rebook; Salma preventive.")

    def reset_demo(self):
        patient_ids = list(
            Patient.objects.filter(national_id_or_passport__startswith=DEMO_PATIENT_PREFIX).values_list("id", flat=True)
        )
        if patient_ids and XrayAttachment.objects.filter(patient_id__in=patient_ids).exists():
            raise CommandError(
                "Reset refused: demo patients now have X-rays. Delete them through Pearlix first so storage objects are cleaned intentionally."
            )
        if patient_ids:
            AIResult.objects.filter(xray_attachment__patient_id__in=patient_ids).delete()
            ExternalXrayCase.objects.filter(attached_patient_id__in=patient_ids).delete()
            Invoice.objects.filter(billing_handoff__patient_id__in=patient_ids).delete()
            BillingHandoff.objects.filter(patient_id__in=patient_ids).delete()
            Visit.objects.filter(patient_id__in=patient_ids).delete()
            Appointment.objects.filter(patient_id__in=patient_ids).delete()
            Patient.objects.filter(id__in=patient_ids).delete()

        demo_users = User.objects.filter(email__endswith=DEMO_EMAIL_SUFFIX)
        demo_user_ids = list(demo_users.values_list("id", flat=True))
        ActivityLog.objects.filter(user_agent=DEMO_SEED_AGENT).delete()
        AvailabilityException.objects.filter(reason__startswith="[DEMO]").delete()
        WorkingShift.objects.filter(employee_id__in=demo_user_ids).delete()
        DoctorProfile.objects.filter(user_id__in=demo_user_ids).delete()
        StaffProfile.objects.filter(user_id__in=demo_user_ids).delete()
        demo_users.delete()
        ClinicDefaultShift.objects.filter(name__startswith="[DEMO]").delete()

    def create_users(self, password):
        admin = User.objects.create_superuser(
            email="admin@pearlix.demo",
            password=password,
            full_name="Maya Nazzal",
            must_change_password=False,
            theme_preference=User.ThemePreference.SYSTEM,
            language_preference=User.LanguagePreference.EN,
        )
        staff = User.objects.create_user(
            email="rana.staff@pearlix.demo",
            password=password,
            full_name="Rana Saad",
            role=User.Role.STAFF,
            must_change_password=False,
            theme_preference=User.ThemePreference.SYSTEM,
            language_preference=User.LanguagePreference.EN,
        )
        sara = User.objects.create_user(
            email="sara.doctor@pearlix.demo",
            password=password,
            full_name="Dr. Sara Haddad",
            role=User.Role.DOCTOR,
            must_change_password=False,
            theme_preference=User.ThemePreference.SYSTEM,
            language_preference=User.LanguagePreference.EN,
        )
        omar = User.objects.create_user(
            email="omar.doctor@pearlix.demo",
            password=password,
            full_name="Dr. Omar Nasser",
            role=User.Role.DOCTOR,
            must_change_password=False,
            theme_preference=User.ThemePreference.SYSTEM,
            language_preference=User.LanguagePreference.EN,
        )
        StaffProfile.objects.create(user=staff, phone="+963 944 555 201", position="Front Desk & Billing", is_active=True)
        DoctorProfile.objects.create(
            user=sara,
            specialty="Restorative Dentistry",
            phone="+963 944 555 301",
            bio="Focuses on restorative care, prevention, and longitudinal follow-up.",
            is_active=True,
        )
        DoctorProfile.objects.create(
            user=omar,
            specialty="Endodontics & Oral Surgery",
            phone="+963 944 555 302",
            bio="Handles endodontic emergencies, surgical consultations, and complex pain cases.",
            is_active=True,
        )
        return {"admin": admin, "staff": staff, "sara": sara, "omar": omar}

    def configure_clinic(self):
        clinic = ClinicSettings.get_solo()
        clinic.clinic_name = "Pearl Dental Clinic"
        clinic.address = "Damascus, Syria"
        clinic.phone = "+963 11 555 0142"
        clinic.email = "hello@pearlix.demo"
        clinic.timezone = "Asia/Damascus"
        clinic.capacity_per_slot = 3
        clinic.default_appointment_duration_minutes = 30
        clinic.allowed_durations_minutes = [15, 30, 45, 60]
        clinic.default_currency = ClinicSettings.Currency.USD
        clinic.supported_currencies = ["USD", "SYP"]
        clinic.default_language = ClinicSettings.Language.EN
        # Friday is an explicit demo policy, not an application-level weekend
        # assumption. Population and auditing below always read this setting.
        clinic.weekly_closed_days = [4]
        clinic.ai_mode = ClinicSettings.AiMode.SEPARATE_SERVICE
        clinic.ai_service_url = ""
        clinic.save()

    def create_shifts(self, users):
        labels = {
            0: "Monday",
            1: "Tuesday",
            2: "Wednesday",
            3: "Thursday",
            4: "Friday",
            5: "Saturday",
            6: "Sunday",
        }
        defaults = {}
        for weekday, label in labels.items():
            defaults[weekday] = ClinicDefaultShift.objects.create(
                name=f"[DEMO] {label} clinic hours",
                weekday=weekday,
                start_time=time(9, 0),
                end_time=time(17, 0),
                is_active=True,
                created_by=users["admin"],
                updated_by=users["admin"],
            )
        for doctor in (users["sara"], users["omar"]):
            for weekday, label in labels.items():
                shift = WorkingShift(
                    employee=doctor,
                    name=f"[DEMO] {doctor.full_name} {label}",
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                    is_active=True,
                    source_default_shift=defaults[weekday],
                    created_by=users["admin"],
                    updated_by=users["admin"],
                )
                shift.full_clean()
                shift.save()
        for weekday, label in labels.items():
            shift = WorkingShift(
                employee=users["staff"],
                name=f"[DEMO] Rana {label}",
                weekday=weekday,
                start_time=time(8, 30),
                end_time=time(17, 30),
                is_active=True,
                created_by=users["admin"],
                updated_by=users["admin"],
            )
            shift.full_clean()
            shift.save()

    def create_patients(self, staff):
        rows = {
            "layla": ("Layla", "Haddad", Patient.Gender.FEMALE, "1992-06-14", "O+", "Mild asthma. No known drug allergies.", "Longitudinal restorative-care patient. Prefers morning appointments."),
            "omar_patient": ("Omar", "Darwish", Patient.Gender.MALE, "1985-11-03", "A+", "Controlled hypertension on amlodipine. Penicillin allergy.", "Endodontic emergency case; treatment notes explicitly preserve the penicillin allergy."),
            "maya": ("Maya", "Nassar", Patient.Gender.FEMALE, "1998-02-17", "B+", "No chronic conditions. Initial complaint included gingival bleeding with flossing.", "Periodontal maintenance story with documented improvement over several visits."),
            "karim": ("Karim", "Saleh", Patient.Gender.MALE, "2001-09-08", "AB+", "No known chronic conditions or drug allergies.", "Missed one appointment and has a valid rebooking."),
            "noor": ("Noor", "Khalil", Patient.Gender.FEMALE, "1977-04-12", "A-", "Type 2 diabetes, well controlled on metformin. No known drug allergies.", "Completed surgical extraction; no current follow-up is required."),
            "rami": ("Rami", "Youssef", Patient.Gender.MALE, "1990-12-29", "O-", "No known chronic conditions.", "Appointment is intentionally marked Needs Reschedule because the assigned doctor became unavailable."),
            "hala": ("Hala", "Mansour", Patient.Gender.FEMALE, "1968-03-02", "B-", "Mild osteoarthritis. No known drug allergies.", "Historical restorative patient. Archived only after treatment and billing were completed."),
            "dima": ("Dima", "Khoury", Patient.Gender.FEMALE, "2004-07-22", "O+", "No known medical conditions or drug allergies.", "New patient: first comprehensive examination is upcoming; no fabricated past history."),
            "tarek": ("Tarek", "Hamdan", Patient.Gender.MALE, "1988-01-15", "A+", "No known chronic conditions.", "One appointment was cancelled in advance and a replacement is booked."),
            "salma": ("Salma", "Barakat", Patient.Gender.FEMALE, "1994-10-10", "AB-", "No chronic conditions. Reports occasional sensitivity to cold.", "New preventive-care patient with an upcoming assessment only."),
        }
        created = {}
        for idx, (key, row) in enumerate(rows.items(), start=101):
            first, last, gender, dob, blood, medical, notes = row
            patient = Patient(
                first_name=first,
                last_name=last,
                gender=gender,
                date_of_birth=datetime.strptime(dob, "%Y-%m-%d").date(),
                phone_number=f"+963 944 100 {idx}",
                email=f"{first.lower()}.{last.lower()}@example.demo",
                national_id_or_passport=f"DEMO-P{idx}",
                address="Damascus, Syria",
                emergency_contact=f"Demo contact +963 944 900 {idx}",
                blood_group=blood,
                medical_conditions_history=medical,
                insurance_info="Demo private dental plan." if idx % 2 else "Self-pay.",
                general_notes=notes,
                is_archived=(key == "hala"),
                created_by=staff,
                updated_by=staff,
            )
            patient.full_clean()
            patient.save()
            created[key] = patient
        return created

    def create_appointment(self, *, patient, doctor, staff, start, duration, status, reason, notes=""):
        end = start + timedelta(minutes=duration)
        if status == Appointment.Status.UPCOMING:
            validate_appointment_slot(doctor, start, duration)
        else:
            validate_duration(duration)
            validate_working_hours(doctor, start, end)
            if Appointment.objects.filter(doctor=doctor, start_datetime__lt=end, end_datetime__gt=start).exists():
                raise CommandError(f"Seed would overlap {doctor.full_name} at {start}.")
        appointment = Appointment(
            patient=patient,
            doctor=doctor,
            start_datetime=start,
            end_datetime=end,
            duration_minutes=duration,
            reason=reason,
            notes=notes,
            status=status,
            created_by=staff,
            updated_by=staff,
        )
        if status == Appointment.Status.NO_SHOW:
            appointment.no_show_at = end
        elif status == Appointment.Status.CANCELLED:
            appointment.cancelled_at = start - timedelta(days=1)
        appointment.full_clean()
        appointment.save()
        return appointment

    def create_completed_visit(self, *, appointment, doctor, symptoms, diagnosis, treatment, clinical_notes, follow_up_notes):
        started = appointment.start_datetime + timedelta(minutes=2)
        completed = appointment.end_datetime - timedelta(minutes=3)
        visit = Visit(
            appointment=appointment,
            patient=appointment.patient,
            doctor=doctor,
            status=Visit.Status.COMPLETED,
            started_at=started,
            completed_at=completed,
            symptoms=symptoms,
            diagnosis=diagnosis,
            treatment=treatment,
            clinical_notes=clinical_notes,
            follow_up_notes=follow_up_notes,
            created_by=doctor,
            updated_by=doctor,
        )
        visit.full_clean()
        visit.save()
        return visit

    def create_bill(self, *, visit, doctor, staff, description, total, paid, note=""):
        handoff = BillingHandoff(
            patient=visit.patient,
            visit=visit,
            doctor=doctor,
            description=description,
            total_amount=Decimal(str(total)),
            currency=BillingHandoff.Currency.USD,
            note=note,
            status=BillingHandoff.Status.OPEN,
            origin=BillingHandoff.Origin.VISIT_COMPLETION,
            created_by=doctor,
            updated_by=doctor,
        )
        handoff.full_clean()
        handoff.save()
        if Decimal(str(paid)) > 0:
            issued = visit.completed_at + timedelta(minutes=10)
            invoice = Invoice(
                invoice_number=f"INV-{issued.astimezone(CLINIC_TZ).strftime('%Y%m%d')}-DEMO{handoff.id:03d}",
                billing_handoff=handoff,
                amount=Decimal(str(paid)),
                issued_at=issued,
                notes="Demo payment generated from the coherent seed story.",
                created_by=staff,
            )
            invoice.full_clean()
            invoice.save()
        refresh_handoff_status(handoff)
        handoff.refresh_from_db()
        return handoff

    def create_story_records(self, users, p):
        anchor = timezone.localdate()
        closed_weekdays = set(ClinicSettings.get_solo().weekly_closed_days)
        at = lambda delta, hour, minute=0: aware(
            working_day(anchor, delta, closed_weekdays), hour, minute
        )
        story = {}

        a = self.create_appointment(patient=p["layla"], doctor=users["sara"], staff=users["staff"], start=at(-90, 10), duration=60, status=Appointment.Status.COMPLETED, reason="Pain when chewing on lower-left molar")
        v = self.create_completed_visit(appointment=a, doctor=users["sara"], symptoms="Pain on chewing lower-left molar, no spontaneous night pain.", diagnosis="Occlusal caries with defective restoration on tooth 36; pulp tests normal.", treatment="Removed recurrent decay and placed composite restoration on tooth 36.", clinical_notes="Isolation achieved. No pulpal exposure. Occlusion adjusted.", follow_up_notes="Review if sensitivity persists beyond two weeks.")
        self.create_bill(visit=v, doctor=users["sara"], staff=users["staff"], description="Composite restoration - tooth 36", total="45", paid="45")
        a = self.create_appointment(patient=p["layla"], doctor=users["sara"], staff=users["staff"], start=at(-30, 10), duration=30, status=Appointment.Status.COMPLETED, reason="Post-restoration sensitivity review")
        v = self.create_completed_visit(appointment=a, doctor=users["sara"], symptoms="Brief cold sensitivity around tooth 36, improving.", diagnosis="Resolving postoperative dentinal sensitivity; restoration intact.", treatment="Minor occlusal adjustment and desensitizing varnish.", clinical_notes="No percussion tenderness. Contacts and margins satisfactory.", follow_up_notes="Routine preventive review; return earlier if pain becomes spontaneous.")
        self.create_bill(visit=v, doctor=users["sara"], staff=users["staff"], description="Sensitivity review and varnish", total="25", paid="25")
        story["layla_upcoming"] = self.create_appointment(patient=p["layla"], doctor=users["sara"], staff=users["staff"], start=at(7, 10), duration=30, status=Appointment.Status.UPCOMING, reason="Preventive review and cleaning")

        a = self.create_appointment(patient=p["omar_patient"], doctor=users["omar"], staff=users["staff"], start=at(-21, 12), duration=60, status=Appointment.Status.COMPLETED, reason="Severe spontaneous upper-right molar pain")
        v = self.create_completed_visit(appointment=a, doctor=users["omar"], symptoms="Severe spontaneous throbbing pain upper-right molar, worse at night.", diagnosis="Symptomatic irreversible pulpitis of tooth 16; no facial swelling.", treatment="Emergency pulpotomy, irrigation, temporary restoration, analgesic advice.", clinical_notes="Penicillin allergy confirmed; no penicillin-class medication prescribed. Blood pressure stable.", follow_up_notes="Return for definitive root canal treatment.")
        self.create_bill(visit=v, doctor=users["omar"], staff=users["staff"], description="Emergency endodontic treatment - tooth 16", total="120", paid="60", note="60 USD remains due at definitive treatment.")
        story["omar_upcoming"] = self.create_appointment(patient=p["omar_patient"], doctor=users["omar"], staff=users["staff"], start=at(3, 10), duration=60, status=Appointment.Status.UPCOMING, reason="Root canal continuation")

        maya_rows = [
            (-180, 11, 60, "Bleeding gums and preventive assessment", "Bleeding with brushing and flossing; no tooth pain.", "Plaque-induced generalized gingivitis without attachment loss.", "Full-mouth scaling, polishing, and individualized oral-hygiene instruction.", "Baseline plaque accumulation highest interproximally.", "Review tissue response in approximately three months.", "Initial periodontal therapy", "35", "35"),
            (-90, 14, 45, "Periodontal review", "Bleeding markedly reduced; occasional posterior bleeding.", "Gingival inflammation improved with residual localized posterior gingivitis.", "Localized debridement and reinforcement of interdental cleaning.", "Home care clearly improved since baseline.", "Continue daily interdental cleaning; maintenance in 10-12 weeks.", "Periodontal review and localized debridement", "30", "30"),
            (-14, 11, 45, "Maintenance scaling", "No current bleeding complaint; planned maintenance.", "Stable gingival health with minimal localized plaque.", "Maintenance scaling and polishing.", "No new caries detected clinically.", "Continue maintenance interval; next review already planned.", "Maintenance scaling and polishing", "40", "0"),
        ]
        for delta, hour, duration, reason, symptoms, diagnosis, treatment, clinical, follow, desc, total, paid in maya_rows:
            a = self.create_appointment(patient=p["maya"], doctor=users["sara"], staff=users["staff"], start=at(delta, hour), duration=duration, status=Appointment.Status.COMPLETED, reason=reason)
            v = self.create_completed_visit(appointment=a, doctor=users["sara"], symptoms=symptoms, diagnosis=diagnosis, treatment=treatment, clinical_notes=clinical, follow_up_notes=follow)
            self.create_bill(visit=v, doctor=users["sara"], staff=users["staff"], description=desc, total=total, paid=paid, note="Open balance retained for billing workflow demonstration." if paid == "0" else "")
        story["maya_upcoming"] = self.create_appointment(patient=p["maya"], doctor=users["sara"], staff=users["staff"], start=at(14, 11), duration=45, status=Appointment.Status.UPCOMING, reason="Periodontal maintenance follow-up")

        story["karim_no_show"] = self.create_appointment(patient=p["karim"], doctor=users["sara"], staff=users["staff"], start=at(-10, 15), duration=30, status=Appointment.Status.NO_SHOW, reason="Routine examination", notes="Patient did not attend.")
        story["karim_upcoming"] = self.create_appointment(patient=p["karim"], doctor=users["sara"], staff=users["staff"], start=at(5, 15), duration=30, status=Appointment.Status.UPCOMING, reason="Rebooked routine examination")

        a = self.create_appointment(patient=p["noor"], doctor=users["omar"], staff=users["staff"], start=at(-45, 13), duration=60, status=Appointment.Status.COMPLETED, reason="Pain from partially erupted lower wisdom tooth")
        v = self.create_completed_visit(appointment=a, doctor=users["omar"], symptoms="Recurrent pain and food trapping around partially erupted lower-right wisdom tooth.", diagnosis="Recurrent pericoronitis associated with tooth 48; extraction indicated.", treatment="Uncomplicated extraction of tooth 48 with postoperative instructions.", clinical_notes="Diabetes reported as well controlled. Hemostasis achieved before discharge.", follow_up_notes="Routine review only if pain, swelling, or delayed healing occurs.")
        self.create_bill(visit=v, doctor=users["omar"], staff=users["staff"], description="Surgical extraction - tooth 48", total="150", paid="150")

        exception_day = next_weekday(anchor, 0, minimum_days=2)
        rami_app = self.create_appointment(patient=p["rami"], doctor=users["omar"], staff=users["staff"], start=aware(exception_day, 11), duration=30, status=Appointment.Status.UPCOMING, reason="Persistent sensitivity on upper-left premolar")
        exception = AvailabilityException(doctor=users["omar"], start_datetime=aware(exception_day, 10), end_datetime=aware(exception_day, 14), type=AvailabilityException.Type.UNAVAILABLE, reason="[DEMO] Continuing education course", created_by=users["admin"], updated_by=users["admin"], is_cancelled=False)
        exception.full_clean()
        exception.save()
        marked = mark_overlapping_appointments_needs_reschedule(availability_exception=exception, actor=users["admin"])
        rami_app.refresh_from_db()
        if rami_app not in marked or rami_app.status != Appointment.Status.NEEDS_RESCHEDULE:
            raise CommandError("Rami's appointment did not transition to Needs Reschedule.")
        story["rami_needs_reschedule"] = rami_app

        for delta, duration, reason, diagnosis, treatment, total in (
            (-210, 60, "Fractured old filling", "Fractured composite restoration on tooth 24 with recurrent marginal caries.", "Removed defective material and restored tooth 24 with composite.", "30"),
            (-120, 30, "Restoration follow-up", "Tooth 24 restoration stable with healthy surrounding tissues.", "No operative treatment required; preventive review completed.", "50"),
        ):
            a = self.create_appointment(patient=p["hala"], doctor=users["sara"], staff=users["staff"], start=at(delta, 9), duration=duration, status=Appointment.Status.COMPLETED, reason=reason)
            v = self.create_completed_visit(appointment=a, doctor=users["sara"], symptoms="Rough fractured filling; no spontaneous pain." if delta == -210 else "No pain; planned restoration review.", diagnosis=diagnosis, treatment=treatment, clinical_notes="Pulp tests normal and treatment outcome stable." if delta == -210 else "Margins intact and bite comfortable.", follow_up_notes="Short restorative review planned." if delta == -210 else "Return for routine care as needed. No active treatment plan remains.")
            self.create_bill(visit=v, doctor=users["sara"], staff=users["staff"], description=reason, total=total, paid=total)

        story["dima_upcoming"] = self.create_appointment(patient=p["dima"], doctor=users["sara"], staff=users["staff"], start=at(1, 9, 30), duration=30, status=Appointment.Status.UPCOMING, reason="First comprehensive dental examination")
        story["tarek_cancelled"] = self.create_appointment(patient=p["tarek"], doctor=users["omar"], staff=users["staff"], start=at(-7, 14), duration=30, status=Appointment.Status.CANCELLED, reason="Consultation for chipped incisor", notes="Cancelled by patient one day in advance.")
        story["tarek_upcoming"] = self.create_appointment(patient=p["tarek"], doctor=users["omar"], staff=users["staff"], start=at(12, 14), duration=30, status=Appointment.Status.UPCOMING, reason="Rebooked chipped-incisor consultation")
        story["salma_upcoming"] = self.create_appointment(patient=p["salma"], doctor=users["sara"], staff=users["staff"], start=at(3, 13, 30), duration=30, status=Appointment.Status.UPCOMING, reason="Preventive assessment and cold sensitivity")
        return story

    def create_audit_trail(self, users, story):
        rows = [
            (users["staff"], "STAFF", "appointment_marked_no_show", story["karim_no_show"], {"patient_id": story["karim_no_show"].patient_id}),
            (users["staff"], "STAFF", "appointment_cancelled", story["tarek_cancelled"], {"patient_id": story["tarek_cancelled"].patient_id}),
            (users["admin"], "ADMIN", "appointment_marked_needs_reschedule", story["rami_needs_reschedule"], {"doctor_id": story["rami_needs_reschedule"].doctor_id}),
        ]
        for actor, role, action, appointment, metadata in rows:
            ActivityLog.objects.create(actor=actor, actor_role=role, action=action, entity_type="appointment", entity_id=str(appointment.id), metadata_json={"demo_seed": True, **metadata}, user_agent=DEMO_SEED_AGENT)

    def audit_consistency(self):
        errors = []
        demo = Patient.objects.filter(national_id_or_passport__startswith=DEMO_PATIENT_PREFIX)
        demo_ids = list(demo.values_list("id", flat=True))
        closed_weekdays = set(ClinicSettings.get_solo().weekly_closed_days)

        for appointment in Appointment.objects.filter(patient_id__in=demo_ids).select_related("doctor", "reschedule_source_exception"):
            local_weekday = timezone.localtime(
                appointment.start_datetime, CLINIC_TZ
            ).weekday()
            if local_weekday in closed_weekdays:
                errors.append(
                    f"Demo appointment {appointment.id} falls on configured closed weekday {local_weekday}."
                )
            has_visit = Visit.objects.filter(appointment=appointment).exists()
            if appointment.status == Appointment.Status.COMPLETED and not has_visit:
                errors.append(f"Completed appointment {appointment.id} has no visit.")
            if appointment.status in {Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW} and has_visit:
                errors.append(f"{appointment.status} appointment {appointment.id} unexpectedly has a visit.")
            if appointment.status == Appointment.Status.UPCOMING and appointment.start_datetime >= timezone.now():
                try:
                    validate_duration(appointment.duration_minutes)
                    validate_working_hours(appointment.doctor, appointment.start_datetime, appointment.end_datetime)
                    validate_unavailable_exception(appointment.doctor, appointment.start_datetime, appointment.end_datetime)
                    validate_capacity(appointment.start_datetime, appointment.end_datetime, exclude_id=appointment.id)
                    validate_doctor_conflict(appointment.doctor, appointment.start_datetime, appointment.end_datetime, exclude_id=appointment.id)
                except AppointmentRuleError as exc:
                    errors.append(f"Upcoming appointment {appointment.id} violates clinic rules: {exc.code}.")
            if appointment.status == Appointment.Status.NEEDS_RESCHEDULE:
                if not appointment.reschedule_source_exception_id and not appointment.reschedule_source_working_shift_id:
                    errors.append(f"Needs-reschedule appointment {appointment.id} has no source.")
                if appointment.reschedule_source_exception_id:
                    source = appointment.reschedule_source_exception
                    if source.is_cancelled or source.start_datetime >= appointment.end_datetime or source.end_datetime <= appointment.start_datetime:
                        errors.append(f"Needs-reschedule appointment {appointment.id} is not actually blocked by its source.")

        for visit in Visit.objects.filter(patient_id__in=demo_ids).select_related("appointment"):
            if visit.patient_id != visit.appointment.patient_id or visit.doctor_id != visit.appointment.doctor_id:
                errors.append(f"Visit {visit.id} does not match appointment patient/doctor.")
            if visit.status == Visit.Status.COMPLETED and visit.appointment.status != Appointment.Status.COMPLETED:
                errors.append(f"Completed visit {visit.id} has non-completed appointment.")
            if visit.status == Visit.Status.COMPLETED and not BillingHandoff.objects.filter(visit=visit).exists():
                errors.append(f"Completed visit {visit.id} has no billing handoff.")

        for handoff in BillingHandoff.objects.filter(patient_id__in=demo_ids).select_related("visit"):
            if handoff.visit_id and (handoff.patient_id != handoff.visit.patient_id or handoff.doctor_id != handoff.visit.doctor_id):
                errors.append(f"Bill {handoff.id} does not match visit provenance.")
            paid = handoff.invoices.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            expected = BillingHandoff.Status.OPEN if paid == 0 else BillingHandoff.Status.PARTIALLY_PAID if paid < handoff.total_amount else BillingHandoff.Status.PAID
            if handoff.status != expected:
                errors.append(f"Bill {handoff.id} status disagrees with paid amount {paid}.")

        for patient in demo.filter(is_archived=True):
            if patient_has_archive_blocking_appointments(patient):
                errors.append(f"Archived patient {patient.id} still has an operational appointment.")

        for patient in demo:
            expected = Appointment.objects.filter(patient=patient, start_datetime__gte=timezone.now(), status__in=(Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN)).order_by("start_datetime", "id").values_list("start_datetime", flat=True).first()
            annotated = annotate_patient_directory(Patient.objects.filter(pk=patient.pk)).first()
            if annotated and annotated.next_appointment_at != expected:
                errors.append(f"Patient {patient.id} next_appointment_at disagrees with the next valid upcoming appointment.")
        return errors
