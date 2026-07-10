from django.contrib import admin

from apps.patients.models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone_number", "gender", "is_archived", "version", "created_at")
    list_filter = ("gender", "is_archived")
    search_fields = ("first_name", "last_name", "phone_number", "email", "national_id_or_passport")
    readonly_fields = ("full_name", "created_at", "updated_at")
