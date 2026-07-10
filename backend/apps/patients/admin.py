from django.contrib import admin

from apps.patients.models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "gender", "is_archived", "created_at")
    list_filter = ("gender", "is_archived")
    search_fields = ("full_name", "phone")
    readonly_fields = ("created_at", "updated_at")
