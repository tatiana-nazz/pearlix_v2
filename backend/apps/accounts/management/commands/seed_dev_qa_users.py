import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.common.demo_safety import assert_demo_environment_safe


NON_DEBUG_WARNING = (
    "WARNING: seed_dev_qa_users is intended only for controlled QA/dev environments. "
    "Do not run it against production data."
)
SECURITY_SENSITIVE_USER_FIELDS = {
    "role",
    "is_active",
    "is_staff",
    "is_superuser",
    "must_change_password",
}


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
            help="Deprecated compatibility flag; raw credentials are never printed.",
        )
        parser.add_argument(
            "--allow-non-debug",
            action="store_true",
            help="Allow running when DEBUG is false for controlled QA/dev environments.",
        )

    def handle(self, *args, **options):
        assert_demo_environment_safe()
        if options["show_passwords"]:
            raise CommandError("Credential output is disabled; raw passwords are never printed.")
        if not settings.DEBUG and not options["allow_non_debug"]:
            raise CommandError("Refusing to seed QA users when DEBUG is false. Use --allow-non-debug only for controlled QA/dev environments.")
        if not settings.DEBUG and options["allow_non_debug"]:
            self.stdout.write(self.style.WARNING(NON_DEBUG_WARNING))

        password = self._password_from_options(options)

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

    def _password_from_options(self, options):
        if options["password"]:
            return options["password"]
        env_password = os.environ.get("PEARLIX_DEV_QA_PASSWORD")
        if env_password:
            return env_password
        raise CommandError(
            "Provide a local QA password with --password or PEARLIX_DEV_QA_PASSWORD; credentials are never printed."
        )

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
        security_state_changed = False
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
                if field in SECURITY_SENSITIVE_USER_FIELDS:
                    security_state_changed = True

        if created or reset_passwords:
            user.set_password(password)
            changed_fields.append("password")
            if not created:
                security_state_changed = True

        if security_state_changed:
            user.version += 1
            changed_fields.append("version")

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
