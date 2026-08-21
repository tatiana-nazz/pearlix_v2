from django.contrib import admin

from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift


class ReadOnlySchedulingAdmin(admin.ModelAdmin):
    """Expose scheduling records for diagnosis without bypassing domain services."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WorkingShift)
class WorkingShiftAdmin(ReadOnlySchedulingAdmin):
    list_display = ("employee", "name", "weekday", "start_time", "end_time", "is_active", "version")
    list_filter = ("weekday", "is_active")
    search_fields = ("employee__email", "employee__full_name")


@admin.register(ClinicDefaultShift)
class ClinicDefaultShiftAdmin(ReadOnlySchedulingAdmin):
    list_display = ("name", "weekday", "start_time", "end_time", "is_active", "version")
    list_filter = ("weekday", "is_active")


@admin.register(AvailabilityException)
class AvailabilityExceptionAdmin(ReadOnlySchedulingAdmin):
    list_display = ("doctor", "staff", "type", "start_datetime", "end_datetime")
    list_filter = ("type",)
    search_fields = ("doctor__email", "doctor__full_name", "staff__email", "staff__full_name")


@admin.register(Appointment)
class AppointmentAdmin(ReadOnlySchedulingAdmin):
    list_display = ("patient", "doctor", "start_datetime", "end_datetime", "status")
    list_filter = ("status",)
    search_fields = ("patient__first_name", "patient__last_name", "patient__phone_number", "doctor__email", "doctor__full_name")
