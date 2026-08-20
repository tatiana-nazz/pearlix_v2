from __future__ import annotations

from datetime import date, time, timedelta

from apps.scheduling.models import Appointment

from .populate_demo_analytics import (
    RANGE_END,
    RANGE_START,
    REASONS,
    Command as BaseAnalyticsCommand,
    aware,
)


# Deliberately non-uniform clinic load. Every configured open day has activity,
# but the calendar does not look machine-generated. Average load stays near
# seven appointments per open day.
DAILY_LOAD_PATTERN = (6, 9, 5, 8, 7, 4, 10, 6, 8, 5, 7, 9, 6, 5)

# Search appointments across the day instead of consuming 09:00, 10:00, 11:00
# first. Exact display order is still chronological after the API sorts rows.
SPREAD_SLOT_TIMES = (
    time(9, 0),
    time(14, 0),
    time(10, 0),
    time(15, 0),
    time(11, 0),
    time(16, 0),
    time(12, 0),
)


class Command(BaseAnalyticsCommand):
    help = (
        "Populate Pearlix with a realistic, deterministic Aug-Sep 2026 clinic "
        "dataset: varied daily load, morning/afternoon distribution, traceable "
        "history, and configured weekly clinic closures."
    )

    def next_available_slot(self, doctors, day, duration):
        for at in SPREAD_SLOT_TIMES:
            for doctor in doctors:
                start = aware(day, at)
                end = start + timedelta(minutes=duration)
                conflict = Appointment.objects.filter(
                    doctor=doctor,
                    start_datetime__lt=end,
                    end_datetime__gt=start,
                ).exists()
                if not conflict and self.slot_satisfies_clinic_rules(
                    doctor=doctor,
                    start=start,
                    end=end,
                    duration=duration,
                ):
                    return doctor, start
        raise RuntimeError(f"No non-overlapping demo slot available on {day}.")

    def create_prior_history(self, users, patients):
        # Keep the returning-patient baseline strictly before August so the
        # Aug-Sep analytics window is not inflated by records labelled history.
        doctors = [users["sara"], users["omar"]]
        closed_weekdays = self.configured_closed_weekdays()
        for index, patient in enumerate(patients):
            day = date(2026, 5, 10) + timedelta(days=index * 2)
            while day.weekday() in closed_weekdays:
                day += timedelta(days=1)
            duration = [30, 45, 60][index % 3]
            doctor, start = self.next_available_slot(doctors, day, duration)
            appointment = self.create_appointment(
                patient=patient,
                doctor=doctor,
                staff=users["staff"],
                start=start,
                duration=duration,
                status=Appointment.Status.COMPLETED,
                reason=REASONS[index % len(REASONS)],
                sequence=1000 + index,
            )
            self.create_visit_and_billing(
                users,
                appointment,
                1000 + index,
                force_open=(index in {0, 8, 16, 24, 32}),
            )
            type(patient).objects.filter(pk=patient.pk).update(
                created_at=start - timedelta(days=5),
                updated_at=start - timedelta(days=5),
            )

    def historical_status(self, sequence):
        # Supplemental data must not manufacture NEEDS_RESCHEDULE without a
        # leave/shift-change provenance record. The canonical base demo already
        # contains a real reschedule story produced by the domain workflow.
        slot = sequence % 25
        if slot <= 21:
            return Appointment.Status.COMPLETED
        if slot in {22, 23}:
            return Appointment.Status.CANCELLED
        return Appointment.Status.NO_SHOW

    def future_status(self, sequence):
        # Future supplemental bookings are predominantly UPCOMING; a small
        # pre-cancelled subset makes the calendar realistic without inventing
        # untraceable reschedule state.
        return Appointment.Status.CANCELLED if sequence % 19 == 17 else Appointment.Status.UPCOMING

    def create_main_calendar(self, users, patients):
        doctors = [users["sara"], users["omar"]]
        closed_weekdays = self.configured_closed_weekdays()
        sequence = 0
        first_seen = set()
        open_day_index = 0
        day = RANGE_START

        while day <= RANGE_END:
            if day.weekday() in closed_weekdays:
                day += timedelta(days=1)
                continue

            daily_target = DAILY_LOAD_PATTERN[open_day_index % len(DAILY_LOAD_PATTERN)]
            for daily_index in range(daily_target):
                patient = patients[(sequence * 7 + daily_index * 3 + open_day_index) % len(patients)]
                duration = [30, 45, 30, 60, 30, 45, 30, 30, 60, 30][daily_index % 10]
                doctor, start = self.next_available_slot(doctors, day, duration)
                status = self.historical_status(sequence) if self.is_historical_day(day) else self.future_status(sequence)
                appointment = self.create_appointment(
                    patient=patient,
                    doctor=doctor,
                    staff=users["staff"],
                    start=start,
                    duration=duration,
                    status=status,
                    reason=REASONS[(sequence + daily_index + open_day_index) % len(REASONS)],
                    sequence=sequence,
                )
                if patient.id not in first_seen and not Appointment.objects.filter(patient=patient).exclude(pk=appointment.pk).exists():
                    type(patient).objects.filter(pk=patient.pk).update(
                        created_at=start - timedelta(days=3),
                        updated_at=start - timedelta(days=3),
                    )
                    first_seen.add(patient.id)
                if status == Appointment.Status.COMPLETED:
                    self.create_visit_and_billing(users, appointment, sequence)
                sequence += 1

            open_day_index += 1
            day += timedelta(days=1)
