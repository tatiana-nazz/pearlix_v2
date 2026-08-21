from django.contrib import admin

from apps.clinic.models import ClinicSettings
from apps.common.admin import ServiceOwnedReadOnlyAdmin


@admin.register(ClinicSettings)
class ClinicSettingsAdmin(ServiceOwnedReadOnlyAdmin):
    list_display = ("clinic_name", "timezone", "capacity_per_slot", "default_currency", "default_language")
    readonly_fields = ("weekly_closed_days", "timezone")
