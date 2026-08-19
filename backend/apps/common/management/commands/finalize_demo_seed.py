from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.clinic.models import ClinicSettings
from apps.patients.models import Patient
from apps.patients.selectors import annotate_patient_directory, patient_has_archive_blocking_appointments
from apps.scheduling.appointment_services import (
    AppointmentRuleError,
    validate_capacity,
    validate_doctor_conflict,
    validate_duration,
    validate_unavailable_exception,
    validate_working_hours,
)
from apps.scheduling.models import Appointment, ClinicDefaultShift, WorkingShift
from apps.visits.models import Visit


DEMO_EMAIL_SUFFIX = "@pearlix.demo"
DEMO_PATIENT_PREFIX = "DEMO-P"
DEMO_SEED_AGENT = "pearlix-demo-seed"
CLINIC_TZ = ZoneInfo("Asia/Damascus")
INVOICE_RE = re.compile(r"^INV-\d{8}-\d{6}$")


def aware(year, month, day, hour=8, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute), CLINIC_TZ)


class Command(BaseCommand):
    help = "Normalize demo-seed chronology and run a stronger cross-module consistency audit."

    def handle(self, *args, **options):
        demo = Patient.objects.filter(national_id_or_passport__startswith=DEMO_PATIENT_PREFIX)
        if not demo.exists():
            raise CommandError("No Pearlix demo patients were found.")

        with transaction.atomic():
            self.normalize_timestamps(demo)
            self.normalize_invoice_numbers(demo)
            self.normalize_audit_events(demo)
            errors = self.audit_consistency(demo)
            if errors:
                raise CommandError("Final demo consistency audit failed:\n- " + "\n- ".join(errors))

        self.stdout.write(self.style.SUCCESS("Pearlix demo finalization PASS: chronology, invoices, scheduling, visits, billing, and patient summaries are coherent."))

    def normalize_timestamps(self, demo):
        now = timezone.now()
        team_origin = aware(2025, 8, 20, 8, 0)
        profile_origin = team_origin + timedelta(minutes=5)
        clinic_origin = team_origin + timedelta(minutes=10)
        shift_origin = team_origin + timedelta(minutes=15)

        demo_users = User.objects.filter(email__endswith=DEMO_EMAIL_SUFFIX)
        demo_user_ids = list(demo_users.values_list("id", flat=True))
        demo_users.update(created_at=team_origin, updated_at=team_origin)
        DoctorProfile.objects.filter(user_id__in=demo_user_ids).update(created_at=profile_origin, updated_at=profile_origin)
        StaffProfile.objects.filter(user_id__in=demo_user_ids).update(created_at=profile_origin, updated_at=profile_origin)
        ClinicSettings.objects.filter(pk=1).update(created_at=clinic_origin, updated_at=clinic_origin)
        ClinicDefaultShift.objects.filter(name__startswith="[DEMO]").update(created_at=shift_origin, updated_at=shift_origin)
        WorkingShift.objects.filter(employee_id__in=demo_user_ids).update(created_at=shift_origin, updated_at=shift_origin)

        for patient in demo:
            first_start = patient.appointments.order_by("start_datetime", "id").values_list("start_datetime", flat=True).first()
            if first_start is None:
                patient_created = now - timedelta(days=30)
            else:
                patient_created = min(now - timedelta(days=30), first_start - timedelta(days=30))
            patient_created = max(team_origin + timedelta(days=1), patient_created)
            if patient.is_archived:
                last_completed = patient.visits.order_by("-completed_at", "-id").values_list("completed_at", flat=True).first()
                patient_updated = (last_completed + timedelta(days=1)) if last_completed else now
            else:
                patient_updated = now
            Patient.objects.filter(pk=patient.pk).update(created_at=patient_created, updated_at=patient_updated)

        patient_created_map = dict(demo.values_list("id", "created_at"))
        for appointment in Appointment.objects.filter(patient__in=demo).order_by("start_datetime", "id"):
            patient_created = patient_created_map[appointment.patient_id]
            created = max(
                patient_created + timedelta(days=1),
                min(now - timedelta(days=1), appointment.start_datetime - timedelta(days=7)),
            )
            if appointment.status == Appointment.Status.COMPLETED:
                updated = appointment.end_datetime
            elif appointment.status == Appointment.Status.NO_SHOW:
                updated = appointment.no_show_at or appointment.end_datetime
            elif appointment.status == Appointment.Status.CANCELLED:
                updated = appointment.cancelled_at or appointment.start_datetime - timedelta(days=1)
            elif appointment.status == Appointment.Status.NEEDS_RESCHEDULE:
                updated = now
            else:
                updated = created
            Appointment.objects.filter(pk=appointment.pk).update(created_at=created, updated_at=updated)

        for visit in Visit.objects.filter(patient__in=demo):
            Visit.objects.filter(pk=visit.pk).update(
                created_at=visit.started_at,
                updated_at=visit.completed_at or visit.started_at,
            )

        for invoice in Invoice.objects.filter(billing_handoff__patient__in=demo):
            Invoice.objects.filter(pk=invoice.pk).update(created_at=invoice.issued_at, updated_at=invoice.issued_at)

        for handoff in BillingHandoff.objects.filter(patient__in=demo).select_related("visit"):
            event_time = (handoff.visit.completed_at or handoff.visit.started_at) + timedelta(minutes=1)
            latest_invoice = handoff.invoices.order_by("-issued_at", "-id").values_list("issued_at", flat=True).first()
            BillingHandoff.objects.filter(pk=handoff.pk).update(
                created_at=event_time,
                updated_at=latest_invoice or event_time,
            )

    def normalize_invoice_numbers(self, demo):
        demo_invoices = list(
            Invoice.objects.filter(billing_handoff__patient__in=demo)
            .select_related("billing_handoff")
            .order_by("issued_at", "id")
        )
        used = set(
            Invoice.objects.exclude(pk__in=[invoice.pk for invoice in demo_invoices]).values_list("invoice_number", flat=True)
        )
        counters = defaultdict(lambda: 900000)
        for invoice in demo_invoices:
            day = timezone.localtime(invoice.issued_at, CLINIC_TZ).strftime("%Y%m%d")
            while True:
                counters[day] += 1
                candidate = f"INV-{day}-{counters[day]:06d}"
                if candidate not in used:
                    break
            used.add(candidate)
            Invoice.objects.filter(pk=invoice.pk).update(invoice_number=candidate)

    def normalize_audit_events(self, demo):
        demo_appointment_ids = set(
            str(value) for value in Appointment.objects.filter(patient__in=demo).values_list("id", flat=True)
        )
        real_reschedule_entities = set(
            ActivityLog.objects.filter(
                action="appointment_marked_needs_reschedule",
                entity_type="appointment",
                entity_id__in=demo_appointment_ids,
            )
            .exclude(user_agent=DEMO_SEED_AGENT)
            .values_list("entity_id", flat=True)
        )
        ActivityLog.objects.filter(
            user_agent=DEMO_SEED_AGENT,
            action="appointment_marked_needs_reschedule",
            entity_type="appointment",
            entity_id__in=real_reschedule_entities,
        ).delete()

        for log in ActivityLog.objects.filter(user_agent=DEMO_SEED_AGENT, entity_type="appointment"):
            try:
                appointment = Appointment.objects.get(pk=int(log.entity_id), patient__in=demo)
            except (ValueError, Appointment.DoesNotExist):
                continue
            if log.action == "appointment_marked_no_show" and appointment.no_show_at:
                ActivityLog.objects.filter(pk=log.pk).update(created_at=appointment.no_show_at)
            elif log.action == "appointment_cancelled" and appointment.cancelled_at:
                ActivityLog.objects.filter(pk=log.pk).update(created_at=appointment.cancelled_at)

    def audit_consistency(self, demo):
        errors = []
        demo_ids = list(demo.values_list("id", flat=True))
        now = timezone.now()

        for appointment in Appointment.objects.filter(patient_id__in=demo_ids).select_related(
            "doctor", "patient", "reschedule_source_exception"
        ):
            has_visit = Visit.objects.filter(appointment=appointment).exists()
            if appointment.created_at > appointment.start_datetime:
                errors.append(f"Appointment {appointment.id} was created after its scheduled start.")
            if appointment.patient.created_at > appointment.created_at:
                errors.append(f"Appointment {appointment.id} predates its patient chart.")
            if appointment.doctor.created_at > appointment.created_at:
                errors.append(f"Appointment {appointment.id} predates its doctor account.")
            if appointment.status == Appointment.Status.COMPLETED and not has_visit:
                errors.append(f"Completed appointment {appointment.id} has no visit.")
            if appointment.status in {Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW} and has_visit:
                errors.append(f"{appointment.status} appointment {appointment.id} unexpectedly has a visit.")
            if appointment.status == Appointment.Status.UPCOMING:
                if appointment.start_datetime < now:
                    errors.append(f"Upcoming appointment {appointment.id} is already in the past.")
                try:
                    validate_duration(appointment.duration_minutes)
                    validate_working_hours(appointment.doctor, appointment.start_datetime, appointment.end_datetime)
                    validate_unavailable_exception(appointment.doctor, appointment.start_datetime, appointment.end_datetime)
                    validate_capacity(appointment.start_datetime, appointment.end_datetime, exclude_id=appointment.id)
                    validate_doctor_conflict(
                        appointment.doctor,
                        appointment.start_datetime,
                        appointment.end_datetime,
                        exclude_id=appointment.id,
                    )
                except AppointmentRuleError as exc:
                    errors.append(f"Upcoming appointment {appointment.id} violates clinic rules: {exc.code}.")
            if appointment.status == Appointment.Status.NEEDS_RESCHEDULE:
                if not appointment.reschedule_source_exception_id and not appointment.reschedule_source_working_shift_id:
                    errors.append(f"Needs-reschedule appointment {appointment.id} has no source.")
                if appointment.reschedule_source_exception_id:
                    source = appointment.reschedule_source_exception
                    if source.is_cancelled or source.start_datetime >= appointment.end_datetime or source.end_datetime <= appointment.start_datetime:
                        errors.append(f"Needs-reschedule appointment {appointment.id} is not blocked by its source.")

        for visit in Visit.objects.filter(patient_id__in=demo_ids).select_related("appointment", "patient"):
            if visit.created_at > visit.started_at:
                errors.append(f"Visit {visit.id} was created after it started.")
            if visit.patient.created_at > visit.created_at:
                errors.append(f"Visit {visit.id} predates its patient chart.")
            if visit.patient_id != visit.appointment.patient_id or visit.doctor_id != visit.appointment.doctor_id:
                errors.append(f"Visit {visit.id} does not match appointment patient/doctor.")
            if visit.status == Visit.Status.COMPLETED and visit.appointment.status != Appointment.Status.COMPLETED:
                errors.append(f"Completed visit {visit.id} has non-completed appointment.")
            if visit.status == Visit.Status.COMPLETED and not BillingHandoff.objects.filter(visit=visit).exists():
                errors.append(f"Completed visit {visit.id} has no billing handoff.")

        for handoff in BillingHandoff.objects.filter(patient_id__in=demo_ids).select_related("visit"):
            if handoff.visit_id and (handoff.patient_id != handoff.visit.patient_id or handoff.doctor_id != handoff.visit.doctor_id):
                errors.append(f"Bill {handoff.id} does not match visit provenance.")
            if handoff.visit_id and handoff.created_at < (handoff.visit.completed_at or handoff.visit.started_at):
                errors.append(f"Bill {handoff.id} predates its visit completion.")
            paid = handoff.invoices.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            expected = (
                BillingHandoff.Status.OPEN
                if paid == 0
                else BillingHandoff.Status.PARTIALLY_PAID
                if paid < handoff.total_amount
                else BillingHandoff.Status.PAID
            )
            if paid > handoff.total_amount:
                errors.append(f"Bill {handoff.id} is overpaid.")
            if handoff.status != expected:
                errors.append(f"Bill {handoff.id} status disagrees with paid amount {paid}.")

        for invoice in Invoice.objects.filter(billing_handoff__patient_id__in=demo_ids):
            if invoice.created_at > invoice.issued_at:
                errors.append(f"Invoice {invoice.id} was created after its issued_at event.")
            if not INVOICE_RE.match(invoice.invoice_number):
                errors.append(f"Invoice {invoice.id} does not use Pearlix invoice-number format.")

        for patient in demo.filter(is_archived=True):
            if patient_has_archive_blocking_appointments(patient):
                errors.append(f"Archived patient {patient.id} still has an operational appointment.")

        for patient in demo:
            expected = (
                Appointment.objects.filter(
                    patient=patient,
                    start_datetime__gte=now,
                    status__in=(Appointment.Status.UPCOMING, Appointment.Status.CHECKED_IN),
                )
                .order_by("start_datetime", "id")
                .values_list("start_datetime", flat=True)
                .first()
            )
            annotated = annotate_patient_directory(Patient.objects.filter(pk=patient.pk)).first()
            if annotated and annotated.next_appointment_at != expected:
                errors.append(f"Patient {patient.id} next_appointment_at disagrees with the next valid booked appointment.")

        duplicate_reschedule = (
            ActivityLog.objects.filter(
                action="appointment_marked_needs_reschedule",
                entity_type="appointment",
                entity_id__in=[str(i) for i in Appointment.objects.filter(patient_id__in=demo_ids).values_list("id", flat=True)],
            )
            .values("entity_id")
            .annotate(total=Sum(1))
        )
        # The seed currently has one real needs-reschedule transition; multiple rows for
        # the same appointment would make the audit trail tell the same event twice.
        for row in duplicate_reschedule:
            if row["total"] > 1:
                errors.append(f"Appointment {row['entity_id']} has duplicate needs-reschedule audit events.")

        return errors
