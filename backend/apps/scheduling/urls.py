from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.scheduling.views import AppointmentViewSet, AvailabilityExceptionViewSet, ClinicDefaultShiftViewSet, WorkingShiftViewSet, doctor_working_hours, doctors_list


router = DefaultRouter()
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("availability-exceptions", AvailabilityExceptionViewSet, basename="availability-exception")
router.register("clinic-default-shifts", ClinicDefaultShiftViewSet, basename="clinic-default-shift")
router.register("working-shifts", WorkingShiftViewSet, basename="working-shift")

urlpatterns = [
    path("doctors/", doctors_list, name="doctor-list"),
    path("doctors/<int:doctor_id>/working-hours/", doctor_working_hours, name="doctor-working-hours"),
]

urlpatterns += router.urls
