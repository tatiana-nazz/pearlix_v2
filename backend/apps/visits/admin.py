from django.contrib import admin

from apps.visits.models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("appointment", "patient", "doctor", "status", "started_at", "completed_at")
    list_filter = ("status",)
    search_fields = ("patient__first_name", "patient__last_name", "patient__phone_number", "doctor__email", "doctor__full_name")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
