from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, TimeStampedModel):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        STAFF = "STAFF", "Staff"
        DOCTOR = "DOCTOR", "Doctor"

    class ThemePreference(models.TextChoices):
        LIGHT = "LIGHT", "Light"
        DARK = "DARK", "Dark"
        SYSTEM = "SYSTEM", "System"

    class LanguagePreference(models.TextChoices):
        EN = "EN", "English"
        AR = "AR", "Arabic"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    theme_preference = models.CharField(
        max_length=20,
        choices=ThemePreference.choices,
        default=ThemePreference.SYSTEM,
    )
    language_preference = models.CharField(
        max_length=10,
        choices=LanguagePreference.choices,
        default=LanguagePreference.EN,
    )
    must_change_password = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    # Used by explicit account-linkage transitions and bound into JWTs so a
    # completed role transition invalidates authority issued for the old role.
    version = models.PositiveIntegerField(default=1)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["role", "is_active"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(role="ADMIN")
                | models.Q(is_staff=False, is_superuser=False),
                name="accounts_non_admin_no_django_privilege",
            ),
        ]

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        # Django-admin authority is an explicit maintenance capability reserved
        # for ADMIN accounts.  Promoting a business role to ADMIN does not grant
        # it automatically, while demotion must clear both flags atomically in
        # the role-transition service.
        if self.role != self.Role.ADMIN and (self.is_staff or self.is_superuser):
            raise ValidationError(
                "Django staff and superuser privileges are reserved for ADMIN accounts."
            )
        return super().save(*args, **kwargs)

    def has_perm(self, perm, obj=None) -> bool:
        return self.is_active and self.is_superuser

    def has_module_perms(self, app_label) -> bool:
        return self.is_active and self.is_superuser

    def set_user_password(self, raw_password, *, must_change_password: bool, mark_changed: bool = False) -> None:
        self.set_password(raw_password)
        self.must_change_password = must_change_password
        self.password_changed_at = timezone.now() if mark_changed else None


class DoctorProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    specialty = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.user_id and self.user.role != User.Role.DOCTOR:
            raise ValidationError({"user": "DoctorProfile requires a DOCTOR user."})
        if self.user_id and StaffProfile.objects.filter(user_id=self.user_id).exclude(pk=self.pk).exists():
            raise ValidationError({"user": "A user cannot have both professional profiles."})

    def __str__(self) -> str:
        return self.user.full_name


class StaffProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    phone = models.CharField(max_length=50, blank=True)
    position = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.user_id and self.user.role != User.Role.STAFF:
            raise ValidationError({"user": "StaffProfile requires a STAFF user."})
        if self.user_id and DoctorProfile.objects.filter(user_id=self.user_id).exclude(pk=self.pk).exists():
            raise ValidationError({"user": "A user cannot have both professional profiles."})

    def __str__(self) -> str:
        return self.user.full_name
