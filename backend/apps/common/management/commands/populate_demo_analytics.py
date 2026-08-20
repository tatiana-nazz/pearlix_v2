from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.billing.models import BillingHandoff, Invoice
from apps.billing.services import create_visit_completion_handoff, issue_invoice
from apps.patients.models import Patient
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    validate_capacity,
    validate_duration,
    validate_doctor_conflict,
    validate_unavailable_exception,
    validate_working_hours,
)
from apps.scheduling.models import Appointment, WorkingShift
from apps.visits.models import Visit


CLINIC_TZ = ZoneInfo("Asia/Damascus")
MARKER = "[DEMO-ANALYTICS-2026A]"
PATIENT_PREFIX = "DEMO-P-A26-"
PATIENT_NOTES = f"{MARKER} Synthetic longitudinal demo patient for dashboard and workflow validation."
EXPECTED_PATIENT_IDENTITIES = {
    f"{PATIENT_PREFIX}{index:03d}": f"analytics.patient.{index:03d}@example.demo"
    for index in range(1, 111)
}
RANGE_START = date(2026, 8, 1)
RANGE_END = date(2026, 9, 14)
DEMO_TODAY = date(2026, 8, 19)
TARGET_PER_OPEN_DAY = 7
SLOT_TIMES = [time(9, 0), time(10, 0), time(11, 0), time(12, 0), time(14, 0), time(15, 0), time(16, 0)]
REASONS = [
    "Comprehensive examination",
    "Restorative treatment",
    "Endodontic treatment",
    "Periodontal maintenance",
    "Preventive cleaning",
    "Post-treatment follow-up",
    "Emergency dental pain",
    "Crown preparation",
]
FIRST_NAMES = ["Lina", "Yazan", "Reem", "Jad", "Nour", "Samer", "Rima", "Fadi", "Lama", "Bassel", "Mira", "Karam", "Dana", "Ziad", "Rana", "Wael", "Hiba", "Nabil", "Rasha", "Ammar"]
LAST_NAMES = ["Haddad", "Khoury", "Darwish", "Nasser", "Saleh", "Mansour", "Khalil", "Barakat", "Youssef", "Hamdan", "Saad"]


def aware(day: date, at: time) -> datetime:
    return timezone.make_aware(datetime.combine(day, at), CLINIC_TZ)


class Command(BaseCommand):
    help = "Add a deterministic, traceable Aug-Sep 2026 analytics dataset to Pearlix demo staging. Friday remains closed."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Replace only this supplemental analytics dataset.")

    def handle(self, *args, **options):
        generated_patient_ids = self.generated_patient_ids()
        if generated_patient_ids and not options["reset"]:
            raise CommandError("Supplemental analytics demo data already exists. Re-run with --reset.")

        with transaction.atomic():
            if options["reset"]:
                self.reset_generated()
            users = self.demo_users()
            self.assert_friday_closed(users)
            patients = self.create_patients(users["staff"])
            self.create_prior_history(users, patients[:35])
            self.create_main_calendar(users, patients)
            errors = self.audit(users)
            if errors:
                raise CommandError("Analytics demo consistency audit failed:\n- " + "\n- ".join(errors))
            # The finalizer is the canonical cross-module demo invariant.  Keep it
            # inside this transaction so analytics population cannot report success
            # (or leave partial data behind) when that stronger audit rejects it.
            call_command("finalize_demo_seed", stdout=self.stdout)

        counts = self.summary_counts()
        self.stdout.write(self.style.SUCCESS("Pearlix analytics demo population completed; consistency audit PASS."))
        self.stdout.write(
            f"Generated patients: {counts['patients']} | Aug-Sep appointments: {counts['appointments']} | "
            f"completed visits: {counts['visits']} | bills: {counts['bills']} | payments: {counts['invoices']}"
        )
        self.stdout.write("Friday is preserved as the weekly clinic closure; generated Friday appointments: 0.")

    def demo_users(self):
        mapping = {
            "admin": "admin@pearlix.demo",
            "staff": "rana.staff@pearlix.demo",
            "sara": "sara.doctor@pearlix.demo",
            "omar": "omar.doctor@pearlix.demo",
        }
        result = {}
        for key, email in mapping.items():
            try:
                result[key] = User.objects.get(email=email)
            except User.DoesNotExist as exc:
                raise CommandError(f"Missing demo user {email}; run seed_demo first.") from exc
        return result

    def reset_generated(self):
        patient_ids = self.generated_patient_ids()
        if not patient_ids:
            return
        Invoice.objects.filter(billing_handoff__patient_id__in=patient_ids).delete()
        BillingHandoff.objects.filter(patient_id__in=patient_ids).delete()
        Visit.objects.filter(patient_id__in=patient_ids).delete()
        Appointment.objects.filter(patient_id__in=patient_ids).delete()
        Patient.objects.filter(id__in=patient_ids).delete()

    def generated_patient_ids(self):
        generated_ids = []
        collisions = []
        candidates = Patient.objects.filter(
            national_id_or_passport__startswith=PATIENT_PREFIX
        ).only("id", "email", "national_id_or_passport", "general_notes")
        for patient in candidates:
            expected_email = EXPECTED_PATIENT_IDENTITIES.get(
                patient.national_id_or_passport
            )
            if (
                expected_email is None
                or patient.email.casefold() != expected_email.casefold()
                or patient.general_notes != PATIENT_NOTES
            ):
                collisions.append(patient.id)
            else:
                generated_ids.append(patient.id)
        if collisions:
            raise CommandError(
                "Analytics reset refused: the reserved patient prefix is used by "
                f"unrecognized records {collisions}."
            )
        return generated_ids

    def assert_friday_closed(self, users):
        friday = WorkingShift.objects.filter(employee__in=[users["sara"], users["omar"], users["staff"]], weekday=4, is_active=True)
        if friday.exists():
            raise CommandError("Friday must remain closed; an active demo Friday shift exists.")

    def create_patients(self, staff):
        patients = []
        for index in range(1, 111):
            first = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
            last = LAST_NAMES[((index - 1) * 3) % len(LAST_NAMES)]
            patient = Patient(
                first_name=first,
                last_name=f"{last} {index:03d}",
                gender=Patient.Gender.FEMALE if index % 2 else Patient.Gender.MALE,
                date_of_birth=date(1965 + (index % 40), 1 + (index % 12), 1 + (index % 27)),
                phone_number=f"+963 944 26{index:04d}",
                email=f"analytics.patient.{index:03d}@example.demo",
                national_id_or_passport=f"{PATIENT_PREFIX}{index:03d}",
                address="Damascus, Syria",
                emergency_contact=f"Demo contact +963 944 36{index:04d}",
                blood_group="O+" if index % 3 else "A+",
                medical_conditions_history="No known chronic conditions or drug allergies." if index % 7 else "Controlled hypertension; routine dental precautions documented.",
                insurance_info="Self-pay." if index % 3 else "Demo private dental plan.",
                general_notes=PATIENT_NOTES,
                created_by=staff,
                updated_by=staff,
            )
            patient.full_clean()
            patient.save()
            patients.append(patient)
        return patients

    def next_available_slot(self, doctors, day, duration):
        for slot_index, at in enumerate(SLOT_TIMES):
            for doctor in doctors:
                start = aware(day, at)
                end = start + timedelta(minutes=duration)
                conflict = Appointment.objects.filter(doctor=doctor, start_datetime__lt=end, end_datetime__gt=start).exists()
                if not conflict and self.slot_satisfies_clinic_rules(
                    doctor=doctor,
                    start=start,
                    end=end,
                    duration=duration,
                ):
                    return doctor, start
        raise CommandError(f"No non-overlapping demo slot available on {day}.")

    def slot_satisfies_clinic_rules(self, *, doctor, start, end, duration):
        try:
            validate_duration(duration)
            validate_working_hours(doctor, start, end)
            validate_unavailable_exception(doctor, start, end)
            validate_capacity(start, end)
            validate_doctor_conflict(doctor, start, end)
        except AppointmentRuleError:
            return False
        return True

    def is_historical_day(self, day):
        # Never manufacture UPCOMING appointments in the past when the fixed
        # analytics window is populated after its original snapshot date.
        return day <= max(DEMO_TODAY, timezone.localdate())

    def create_appointment(self, *, patient, doctor, staff, start, duration, status, reason, sequence):
        appointment = Appointment(
            patient=patient,
            doctor=doctor,
            start_datetime=start,
            end_datetime=start + timedelta(minutes=duration),
            duration_minutes=duration,
            reason=reason,
            notes=f"{MARKER} Story sequence {sequence}; deterministic synthetic staging data.",
            status=status,
            created_by=staff,
            updated_by=staff,
        )
        if status == Appointment.Status.NO_SHOW:
            appointment.no_show_at = appointment.end_datetime
        elif status == Appointment.Status.CANCELLED:
            appointment.cancelled_at = start - timedelta(days=1)
        appointment.full_clean()
        appointment.save()
        return appointment

    def create_visit_and_billing(self, users, appointment, sequence, force_open=False):
        started = appointment.start_datetime + timedelta(minutes=2)
        visit = Visit(
            appointment=appointment,
            patient=appointment.patient,
            doctor=appointment.doctor,
            status=Visit.Status.COMPLETED,
            started_at=started,
            completed_at=appointment.end_datetime - timedelta(minutes=2),
            symptoms="Routine findings consistent with the scheduled reason.",
            diagnosis=f"Demo diagnosis for {appointment.reason.lower()}.",
            treatment=f"Completed {appointment.reason.lower()} as planned.",
            clinical_notes=f"{MARKER} Coherent synthetic clinical record linked to appointment #{appointment.id}.",
            follow_up_notes="Review as indicated by the longitudinal demo story.",
            created_by=appointment.doctor,
            updated_by=appointment.doctor,
        )
        visit.full_clean()
        visit.save()

        currency = BillingHandoff.Currency.SYP if sequence % 5 == 0 else BillingHandoff.Currency.USD
        total = Decimal(120000 + (sequence % 6) * 25000) if currency == BillingHandoff.Currency.SYP else Decimal(55 + (sequence % 7) * 25)
        handoff = create_visit_completion_handoff(
            visit=visit,
            user=appointment.doctor,
            data={"description": f"{appointment.reason} — {MARKER}", "total_amount": total, "currency": currency, "note": "Synthetic demo bill."},
        )
        BillingHandoff.objects.filter(pk=handoff.pk).update(created_at=appointment.end_datetime, updated_at=appointment.end_datetime)
        if force_open or sequence % 8 == 1:
            return visit
        amount = total / Decimal("2") if sequence % 8 == 0 else total
        invoice, _ = issue_invoice(
            handoff=handoff,
            user=users["staff"],
            data={"amount": amount, "issued_at": appointment.end_datetime + timedelta(minutes=12), "notes": f"{MARKER} Synthetic payment."},
        )
        Invoice.objects.filter(pk=invoice.pk).update(created_at=appointment.end_datetime + timedelta(minutes=12), updated_at=appointment.end_datetime + timedelta(minutes=12))
        return visit

    def create_prior_history(self, users, patients):
        doctors = [users["sara"], users["omar"]]
        for index, patient in enumerate(patients):
            day = date(2026, 6, 1) + timedelta(days=index * 2)
            while day.weekday() == 4:
                day += timedelta(days=1)
            duration = [30, 45, 60][index % 3]
            doctor, start = self.next_available_slot(doctors, day, duration)
            appointment = self.create_appointment(
                patient=patient, doctor=doctor, staff=users["staff"], start=start, duration=duration,
                status=Appointment.Status.COMPLETED, reason=REASONS[index % len(REASONS)], sequence=1000 + index,
            )
            self.create_visit_and_billing(users, appointment, 1000 + index, force_open=(index in {0, 8, 16, 24, 32}))
            Patient.objects.filter(pk=patient.pk).update(created_at=start - timedelta(days=5), updated_at=start - timedelta(days=5))

    def historical_status(self, sequence):
        slot = sequence % 25
        if slot <= 20:
            return Appointment.Status.COMPLETED
        if slot in {21, 22}:
            return Appointment.Status.CANCELLED
        if slot == 23:
            return Appointment.Status.NO_SHOW
        return Appointment.Status.NEEDS_RESCHEDULE

    def future_status(self, sequence):
        slot = sequence % 20
        if slot == 17:
            return Appointment.Status.CANCELLED
        if slot == 18:
            return Appointment.Status.NEEDS_RESCHEDULE
        return Appointment.Status.UPCOMING

    def create_main_calendar(self, users, patients):
        doctors = [users["sara"], users["omar"]]
        sequence = 0
        first_seen = set()
        day = RANGE_START
        while day <= RANGE_END:
            if day.weekday() == 4:
                day += timedelta(days=1)
                continue
            for daily_index in range(TARGET_PER_OPEN_DAY):
                patient = patients[(sequence * 7 + daily_index * 3) % len(patients)]
                duration = [30, 45, 60, 30, 30, 45, 30][daily_index]
                doctor, start = self.next_available_slot(doctors, day, duration)
                status = self.historical_status(sequence) if self.is_historical_day(day) else self.future_status(sequence)
                appointment = self.create_appointment(
                    patient=patient,
                    doctor=doctor,
                    staff=users["staff"],
                    start=start,
                    duration=duration,
                    status=status,
                    reason=REASONS[(sequence + daily_index) % len(REASONS)],
                    sequence=sequence,
                )
                if patient.id not in first_seen and not Appointment.objects.filter(patient=patient).exclude(pk=appointment.pk).exists():
                    Patient.objects.filter(pk=patient.pk).update(created_at=start - timedelta(days=3), updated_at=start - timedelta(days=3))
                    first_seen.add(patient.id)
                if status == Appointment.Status.COMPLETED:
                    self.create_visit_and_billing(users, appointment, sequence)
                sequence += 1
            day += timedelta(days=1)

    def audit(self, users):
        errors = []
        generated = Appointment.objects.filter(notes__startswith=MARKER)
        friday_count = sum(1 for dt in generated.values_list("start_datetime", flat=True) if timezone.localtime(dt, CLINIC_TZ).weekday() == 4)
        if friday_count:
            errors.append(f"{friday_count} generated appointments fall on Friday.")
        if WorkingShift.objects.filter(employee__in=[users["sara"], users["omar"], users["staff"]], weekday=4, is_active=True).exists():
            errors.append("An active Friday demo shift exists.")
        day = RANGE_START
        while day <= RANGE_END:
            if day.weekday() != 4:
                start = aware(day, time.min)
                end = aware(day + timedelta(days=1), time.min)
                if not generated.filter(start_datetime__gte=start, start_datetime__lt=end).exists():
                    errors.append(f"Open clinic day {day} has no appointments.")
            day += timedelta(days=1)
        completed_ids = generated.filter(status=Appointment.Status.COMPLETED).values_list("id", flat=True)
        missing_visits = Appointment.objects.filter(id__in=completed_ids, visit__isnull=True).count()
        if missing_visits:
            errors.append(f"{missing_visits} generated completed appointments have no Visit.")
        missing_handoffs = Visit.objects.filter(
            appointment__in=generated,
            status=Visit.Status.COMPLETED,
            billing_handoffs__isnull=True,
        ).count()
        if missing_handoffs:
            errors.append(f"{missing_handoffs} generated completed visits have no billing handoff.")
        invalid_visits = Visit.objects.filter(appointment__in=generated.exclude(status=Appointment.Status.COMPLETED)).count()
        if invalid_visits:
            errors.append(f"{invalid_visits} non-completed generated appointments have a Visit.")
        for doctor in (users["sara"], users["omar"]):
            rows = list(generated.filter(doctor=doctor).order_by("start_datetime").values_list("start_datetime", "end_datetime"))
            for previous, current in zip(rows, rows[1:]):
                if current[0] < previous[1]:
                    errors.append(f"Generated appointments overlap for {doctor.full_name}.")
                    break
        return errors

    def summary_counts(self):
        patient_ids = Patient.objects.filter(national_id_or_passport__startswith=PATIENT_PREFIX).values_list("id", flat=True)
        range_start = aware(RANGE_START, time.min)
        range_end = aware(RANGE_END + timedelta(days=1), time.min)
        appointments = Appointment.objects.filter(patient_id__in=patient_ids, start_datetime__gte=range_start, start_datetime__lt=range_end)
        return {
            "patients": Patient.objects.filter(id__in=patient_ids).count(),
            "appointments": appointments.count(),
            "visits": Visit.objects.filter(patient_id__in=patient_ids, appointment__in=appointments).count(),
            "bills": BillingHandoff.objects.filter(patient_id__in=patient_ids).count(),
            "invoices": Invoice.objects.filter(billing_handoff__patient_id__in=patient_ids).count(),
        }
