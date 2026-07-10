from django.urls import path

from apps.clinic.views import ClinicSettingsView


urlpatterns = [
    path("settings/", ClinicSettingsView.as_view(), name="clinic-settings"),
]
