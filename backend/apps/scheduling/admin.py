from django.contrib import admin

from apps.scheduling.models import Appointment, AvailabilityException, ClinicDefaultShift, WorkingShift


@admin.register(WorkingShift)
class WorkingShiftAdmin(admin.ModelAdmin):
    list_display = ("employee", "name", "weekday", "start_time", "end_time", "is_active", "version")
    list_filter = ("weekday", "is_active")
    search_fields = ("employee__email", "employee__full_name")


@admin.register(ClinicDefaultShift)
class ClinicDefaultShiftAdmin(admin.ModelAdmin):
    list_display = ("name", "weekday", "start_time", "end_time", "is_active", "version")
    list_filter = ("weekday", "is_active")


@admin.register(AvailabilityException)
class AvailabilityExceptionAdmin(admin.ModelAdmin):
    list_display = ("doctor", "staff", "type", "start_datetime", "end_datetime")
    list_filter = ("type",)
    search_fields = ("doctor__email", "doctor__full_name", "staff__email", "staff__full_name")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor", "start_datetime", "end_datetime", "status")
    list_filter = ("status",)
    search_fields = ("patient__first_name", "patient__last_name", "patient__phone_number", "doctor__email", "doctor__full_name")
