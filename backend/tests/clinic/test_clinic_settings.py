import pytest
from django.contrib import admin

from apps.clinic.admin import ClinicSettingsAdmin
from apps.clinic.models import ClinicSettings


@pytest.mark.django_db
def test_unauthenticated_user_cannot_read_clinic_settings(api_client):
    response = api_client.get("/api/clinic/settings/")

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_admin_can_get_full_clinic_settings(admin_client):
    settings = ClinicSettings.get_solo()
    settings.save()

    response = admin_client.get("/api/clinic/settings/")

    assert response.status_code == 200
    assert response.data["clinic_name"] == "Pearl Dental Clinic"
    assert response.data["timezone"] == "Asia/Damascus"
    assert response.data["capacity_per_slot"] == 3
    assert response.data["default_appointment_duration_minutes"] == 30
    assert response.data["allowed_durations_minutes"] == [15, 30, 45, 60]
    assert response.data["weekly_closed_days"] == [4]
    assert response.data["default_currency"] == "SYP"
    assert response.data["supported_currencies"] == ["SYP", "USD"]
    assert response.data["default_language"] == "EN"
    assert response.data["ai_mode"] == ClinicSettings.AiMode.MOCK_ADAPTER


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_staff_and_doctor_get_safe_clinic_settings_only(request, client_fixture):
    client = request.getfixturevalue(client_fixture)
    settings = ClinicSettings.get_solo()
    settings.save()

    response = client.get("/api/clinic/settings/")

    assert response.status_code == 200
    assert response.data["clinic_name"] == "Pearl Dental Clinic"
    assert response.data["timezone"] == "Asia/Damascus"
    assert response.data["capacity_per_slot"] == 3
    assert response.data["default_appointment_duration_minutes"] == 30
    assert response.data["allowed_durations_minutes"] == [15, 30, 45, 60]
    assert response.data["weekly_closed_days"] == [4]
    assert response.data["default_currency"] == "SYP"
    assert response.data["supported_currencies"] == ["SYP", "USD"]
    assert response.data["default_language"] == "EN"
    assert "ai_mode" not in response.data


@pytest.mark.django_db
def test_admin_can_update_clinic_settings(admin_client):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"capacity_per_slot": 5, "default_language": "AR"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["capacity_per_slot"] == 5
    assert response.data["default_language"] == "AR"


@pytest.mark.django_db
def test_admin_can_update_ai_mode_and_service_url(admin_client):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"ai_mode": ClinicSettings.AiMode.DJANGO_INTERNAL},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["ai_mode"] == ClinicSettings.AiMode.DJANGO_INTERNAL


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_staff_and_doctor_cannot_update_clinic_settings(request, client_fixture):
    client = request.getfixturevalue(client_fixture)

    response = client.patch("/api/clinic/settings/", {"capacity_per_slot": 5}, format="json")
    ai_response = client.patch(
        "/api/clinic/settings/",
        {"ai_mode": ClinicSettings.AiMode.SEPARATE_SERVICE},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert ai_response.status_code == 403
    assert ai_response.data["code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_invalid_capacity_rejected(admin_client):
    response = admin_client.patch("/api/clinic/settings/", {"capacity_per_slot": 0}, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "capacity_per_slot" in response.data["details"]


@pytest.mark.django_db
def test_invalid_default_duration_rejected(admin_client):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"default_appointment_duration_minutes": 45, "allowed_durations_minutes": [15, 30]},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "default_appointment_duration_minutes" in response.data["details"]


@pytest.mark.django_db
def test_invalid_currency_rejected(admin_client):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"supported_currencies": ["SYP", "EUR"]},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "supported_currencies" in response.data["details"]


@pytest.mark.django_db
def test_invalid_language_rejected(admin_client):
    response = admin_client.patch("/api/clinic/settings/", {"default_language": "FR"}, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "default_language" in response.data["details"]


@pytest.mark.django_db
def test_clinic_settings_singleton_behavior(admin_client):
    first = admin_client.get("/api/clinic/settings/")
    second = admin_client.get("/api/clinic/settings/")

    assert first.status_code == 200
    assert second.status_code == 200
    assert ClinicSettings.objects.count() == 1
    assert ClinicSettings.objects.get().pk == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("submitted", "expected"),
    [([], []), ([4], [4]), ([6], [6]), ([5, 4], [4, 5])],
)
def test_admin_can_configure_valid_weekly_closed_days(admin_client, submitted, expected):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": submitted},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["weekly_closed_days"] == expected
    assert ClinicSettings.objects.get(pk=1).weekly_closed_days == expected


@pytest.mark.django_db
@pytest.mark.parametrize(
    "submitted",
    [[4, 4], [-1], [7], [0, 1, 2, 3, 4, 5, 6], [True], "4"],
)
def test_invalid_weekly_closed_days_are_rejected(admin_client, submitted):
    response = admin_client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": submitted},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "VALIDATION_ERROR"
    assert "weekly_closed_days" in response.data["details"]
    assert ClinicSettings.objects.get(pk=1).weekly_closed_days == [4]


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["staff_client", "doctor_client"])
def test_non_admin_cannot_mutate_weekly_closed_days(request, client_fixture):
    client = request.getfixturevalue(client_fixture)
    ClinicSettings.get_solo()

    response = client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": [6]},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["code"] == "PERMISSION_DENIED"
    assert ClinicSettings.objects.get(pk=1).weekly_closed_days == [4]


@pytest.mark.django_db
def test_anonymous_cannot_mutate_weekly_closed_days(api_client):
    ClinicSettings.get_solo()
    response = api_client.patch(
        "/api/clinic/settings/",
        {"weekly_closed_days": [6]},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


def test_django_admin_cannot_bypass_operating_week_impact_workflow():
    model_admin = ClinicSettingsAdmin(ClinicSettings, admin.site)

    assert {"weekly_closed_days", "timezone"}.issubset(model_admin.readonly_fields)
    assert model_admin.has_add_permission(request=None) is False
    assert model_admin.has_delete_permission(request=None) is False
