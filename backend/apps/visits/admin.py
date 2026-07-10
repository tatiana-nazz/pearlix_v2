from django.contrib import admin

from apps.visits.models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("appointment", "patient", "doctor", "status", "started_at", "completed_at")
    list_filter = ("status",)
    search_fields = ("patient__full_name", "patient__phone", "doctor__email", "doctor__full_name")
