from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import DoctorProfile, StaffProfile
from apps.audit.services import log_activity
from apps.scheduling.models import WorkingShift


class Command(BaseCommand):
    help = "Report active professional profiles that have no active WorkingShift; --fix makes profiles inactive."

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true", help="Set violating professional profiles inactive (DEBUG databases only).")

    def handle(self, *args, **options):
        violations = self._violations()
        for kind, profile in violations:
            self.stdout.write(f"violation employee_id={profile.user_id} profile={kind} active_shift_count=0")
        self.stdout.write(f"violations={len(violations)}")
        if not options["fix"]:
            return

        fixed = skipped = 0
        for kind, profile in violations:
            with transaction.atomic():
                model = DoctorProfile if kind == "DOCTOR" else StaffProfile
                locked = model.objects.select_for_update().get(pk=profile.pk)
                active_shifts = WorkingShift.objects.select_for_update().filter(employee_id=locked.user_id, is_active=True).count()
                if not locked.is_active or active_shifts:
                    skipped += 1
                    continue
                locked.is_active = False
                locked.version += 1
                locked.save(update_fields=["is_active", "version", "updated_at"])
                log_activity(action="professional_schedule_invariant_repaired", entity_type="user", entity_id=locked.user_id, metadata={"reason": "active_professional_requires_schedule", "profile": kind, "active_shift_count": active_shifts})
                fixed += 1
        self.stdout.write(f"fixed={fixed} skipped={skipped} remaining_violations={len(self._violations())}")

    @staticmethod
    def _violations():
        results = []
        for kind, model in (("DOCTOR", DoctorProfile), ("STAFF", StaffProfile)):
            profiles = model.objects.filter(is_active=True).select_related("user").order_by("user_id")
            for profile in profiles:
                if not WorkingShift.objects.filter(employee_id=profile.user_id, is_active=True).exists():
                    results.append((kind, profile))
        return results
