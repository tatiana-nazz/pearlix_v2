from django.contrib import admin

from apps.scheduling.models import Appointment, AvailabilityException, WorkingHour


@admin.register(WorkingHour)
class WorkingHourAdmin(admin.ModelAdmin):
    list_display = ("doctor", "weekday", "start_time", "end_time", "is_active")
    list_filter = ("weekday", "is_active")
    search_fields = ("doctor__email", "doctor__full_name")


@admin.register(AvailabilityException)
class AvailabilityExceptionAdmin(admin.ModelAdmin):
    list_display = ("doctor", "staff", "type", "start_datetime", "end_datetime")
    list_filter = ("type",)
    search_fields = ("doctor__email", "doctor__full_name", "staff__email", "staff__full_name")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor", "start_datetime", "end_datetime", "status")
    list_filter = ("status",)
    search_fields = ("patient__full_name", "patient__phone", "doctor__email", "doctor__full_name")
