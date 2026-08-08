from datetime import timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.clinic.models import ClinicSettings


def calculate_end_datetime(start_datetime, duration_minutes):
    return start_datetime + timedelta(minutes=duration_minutes)


def get_clinic_settings():
    return ClinicSettings.get_solo()


def get_clinic_timezone(settings=None):
    return ZoneInfo((settings or get_clinic_settings()).timezone)


def clinic_localtime(value, settings=None):
    return timezone.localtime(value, get_clinic_timezone(settings))


def clinic_now(settings=None, current_time=None):
    return clinic_localtime(current_time or timezone.now(), settings)
