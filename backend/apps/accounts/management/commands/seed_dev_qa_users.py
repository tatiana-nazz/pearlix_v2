import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import DoctorProfile, StaffProfile, User


FALLBACK_PASSWORD = "PearlixDev123!"
FALLBACK_WARNING = "Using local development fallback password. Never use this password in production."
NON_DEBUG_WARNING = (
    "WARNING: seed_dev_qa_users is intended only for controlled QA/dev environments. "
    "Do not run it against production data."
)


QA_USERS = [
    {
        "email": "admin.qa@pearlix.local",
        "full_name": "Pearlix QA Admin",
        "role": User.Role.ADMIN,
        "must_change_password": False,
    },
    {
        "email": "staff.qa@pearlix.local",
        "full_name": "Pearlix QA Staff",
        "role": User.Role.STAFF,
        "must_change_password": False,
    },
    {
        "email": "doctor.qa@pearlix.local",
        "full_name": "Pearlix QA Doctor",
        "role": User.Role.DOCTOR,
        "must_change_password": False,
    },
]

MUST_CHANGE_USER = {
    "email": "doctor.mustchange@pearlix.local",
    "full_name": "Pearlix Must Change Doctor",
    "role": User.Role.DOCTOR,
    "must_change_password": True,
}


class Command(BaseCommand):
    help = "Create or update local-development QA users for browser QA."

    def add_arguments(self, parser):
        parser.add_argument("--password", help="Explicit local QA password.")
        parser.add_argument("--reset-passwords", action="store_true", help="Reset passwords for existing QA users.")
        parser.add_argument(
            "--include-must-change-user",
            action="store_true",
            help="Create the optional Doctor account that must change password.",
        )
        parser.add_argument(
            "--show-passwords",
            action="store_true",
            help="Print local-only credentials. Allowed only when DEBUG is true.",
        )
        parser.add_argument(
            "--allow-non-debug",
            action="store_true",
            help="Allow running when DEBUG is false for controlled QA/dev environments.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["allow_non_debug"]:
            raise CommandError("Refusing to seed QA users when DEBUG is false. Use --allow-non-debug only for controlled QA/dev environments.")
        if options["show_passwords"] and not settings.DEBUG:
            raise CommandError("--show-passwords is only allowed when DEBUG is true.")
        if not settings.DEBUG and options["allow_non_debug"]:
            self.stdout.write(self.style.WARNING(NON_DEBUG_WARNING))

        password, used_fallback = self._password_from_options(options)
        if used_fallback:
            self.stdout.write(self.style.WARNING(FALLBACK_WARNING))

        users = list(QA_USERS)
        if options["include_must_change_user"]:
            users.append(MUST_CHANGE_USER)

        self.stdout.write("Local QA users:")
        results = []
        with transaction.atomic():
            for spec in users:
                results.append(self._upsert_user(spec, password=password, reset_passwords=options["reset_passwords"]))

        for result in results:
            self.stdout.write(
                "{action}: {email} role={role} active={active} must_change_password={must_change_password} profile={profile}".format(
                    **result
                )
            )

        if options["show_passwords"]:
            self.stdout.write("")
            self.stdout.write("Local-only credentials:")
            for spec in users:
                self.stdout.write(f"{spec['email']} / {password}")

    def _password_from_options(self, options):
        if options["password"]:
            return options["password"], False
        env_password = os.environ.get("PEARLIX_DEV_QA_PASSWORD")
        if env_password:
            return env_password, False
        return FALLBACK_PASSWORD, True

    def _upsert_user(self, spec, *, password, reset_passwords):
        email = User.objects.normalize_email(spec["email"])
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": spec["full_name"],
                "role": spec["role"],
                "is_active": True,
                "is_staff": spec["role"] == User.Role.ADMIN,
                "is_superuser": spec["role"] == User.Role.ADMIN,
                "must_change_password": spec["must_change_password"],
            },
        )

        changed_fields = []
        for field, value in {
            "full_name": spec["full_name"],
            "role": spec["role"],
            "is_active": True,
            "is_staff": spec["role"] == User.Role.ADMIN,
            "is_superuser": spec["role"] == User.Role.ADMIN,
            "must_change_password": spec["must_change_password"],
        }.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed_fields.append(field)

        if created or reset_passwords:
            user.set_password(password)
            changed_fields.append("password")

        if changed_fields:
            user.save(update_fields=sorted(set([*changed_fields, "updated_at"])))

        profile_status = self._ensure_profile(user)
        return {
            "action": "created" if created else "updated",
            "email": user.email,
            "role": user.role,
            "active": user.is_active,
            "must_change_password": user.must_change_password,
            "profile": profile_status,
        }

    def _ensure_profile(self, user):
        if user.role == User.Role.DOCTOR:
            _, created = DoctorProfile.objects.get_or_create(
                user=user,
                defaults={
                    "specialty": "General Dentistry",
                    "phone": "",
                    "bio": "Local QA doctor profile.",
                    "is_active": True,
                },
            )
            return "doctor created" if created else "doctor present"
        if user.role == User.Role.STAFF:
            _, created = StaffProfile.objects.get_or_create(
                user=user,
                defaults={
                    "phone": "",
                    "position": "Local QA Staff",
                    "is_active": True,
                },
            )
            return "staff created" if created else "staff present"
        return "not applicable"
