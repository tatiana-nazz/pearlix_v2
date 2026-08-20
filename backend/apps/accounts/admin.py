from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.core.exceptions import PermissionDenied

from apps.accounts.models import DoctorProfile, StaffProfile, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    filter_horizontal = ()
    fieldsets = (
        (None, {"fields": ("email", "credential_management")}),
        ("Personal info", {"fields": ("full_name", "role")}),
        ("Preferences", {"fields": ("theme_preference", "language_preference")}),
        (
            "Status",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "must_change_password",
                    "password_changed_at",
                    "version",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields = (
        "email",
        "credential_management",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "must_change_password",
        "password_changed_at",
        "version",
        "created_at",
        "updated_at",
        "last_login",
    )

    @admin.display(description="Credentials")
    def credential_management(self, obj):
        return (
            "Account authority and credentials are managed through Pearlix's "
            "audited account-lifecycle API."
        )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def user_change_password(self, request, id, form_url=""):
        raise PermissionDenied(
            "Credentials must be changed through the audited account-lifecycle API."
        )


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "specialty", "phone", "is_active")
    search_fields = ("user__email", "user__full_name", "specialty", "phone")


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "phone", "is_active")
    search_fields = ("user__email", "user__full_name", "position", "phone")
