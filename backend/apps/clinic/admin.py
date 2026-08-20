from django.contrib import admin

from apps.clinic.models import ClinicSettings


@admin.register(ClinicSettings)
class ClinicSettingsAdmin(admin.ModelAdmin):
    list_display = ("clinic_name", "timezone", "capacity_per_slot", "default_currency", "default_language")
    readonly_fields = ("weekly_closed_days", "timezone")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
