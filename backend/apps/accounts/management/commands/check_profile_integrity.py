from django.core.management.base import BaseCommand, CommandError

from apps.accounts.team_services import profile_integrity_counts


class Command(BaseCommand):
    help = "Report deterministic User/DoctorProfile/StaffProfile linkage integrity counts."

    def add_arguments(self, parser):
        parser.add_argument("--strict", action="store_true", help="Exit non-zero when any integrity violation is found.")

    def handle(self, *args, **options):
        counts = profile_integrity_counts()
        for key, value in counts.items():
            self.stdout.write(f"{key}={value}")
        invalid = sum(counts[key] for key in ("dual_profiles", "role_mismatches", "active_admin_profiles"))
        if options["strict"] and invalid:
            raise CommandError(f"Profile integrity check found {invalid} inconsistent linkage(s).")
