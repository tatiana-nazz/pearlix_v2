from django.contrib import admin

from apps.clinic.models import ClinicSettings


@admin.register(ClinicSettings)
class ClinicSettingsAdmin(admin.ModelAdmin):
    list_display = ("clinic_name", "timezone", "capacity_per_slot", "default_currency", "default_language")
