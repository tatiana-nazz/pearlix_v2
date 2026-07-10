from django.urls import path

from apps.dashboard.views import admin_dashboard, doctor_dashboard, staff_dashboard


urlpatterns = [
    path("dashboard/admin/", admin_dashboard, name="dashboard-admin"),
    path("dashboard/staff/", staff_dashboard, name="dashboard-staff"),
    path("dashboard/doctor/", doctor_dashboard, name="dashboard-doctor"),
]
