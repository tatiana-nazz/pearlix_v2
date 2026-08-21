import pytest
from django.contrib import admin
from django.urls import reverse

from apps.accounts.models import User
from apps.scheduling.models import (
    Appointment,
    AvailabilityException,
    ClinicDefaultShift,
    WorkingShift,
)


@pytest.mark.django_db
def test_scheduling_django_admin_is_view_only(
    client,
    rf,
    appointment_factory,
    availability_exception_factory,
    working_hour_factory,
):
    django_admin = User.objects.create_superuser(
        email="scheduling-django-admin@example.com",
        password="strong-admin-password",
        full_name="Scheduling Django Admin",
    )
    records = [
        working_hour_factory(),
        ClinicDefaultShift.objects.create(
            name="Morning",
            weekday=0,
            start_time="09:00",
            end_time="12:00",
            created_by=django_admin,
            updated_by=django_admin,
        ),
        availability_exception_factory(),
        appointment_factory(),
    ]
    client.force_login(django_admin)
    request = rf.get("/admin/scheduling/")
    request.user = django_admin

    for record in records:
        model = type(record)
        model_admin = admin.site._registry[model]
        model_name = model._meta.model_name
        namespace = f"admin:{model._meta.app_label}_{model_name}"

        assert model_admin.has_view_permission(request, record) is True
        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request, record) is False
        assert model_admin.has_delete_permission(request, record) is False

        assert client.get(reverse(f"{namespace}_changelist")).status_code == 200
        assert client.get(reverse(f"{namespace}_change", args=[record.pk])).status_code == 200
        assert client.get(reverse(f"{namespace}_add")).status_code == 403
        assert (
            client.post(
                reverse(f"{namespace}_change", args=[record.pk]),
                {"name": "Tampered"},
            ).status_code
            == 403
        )
        assert (
            client.post(
                reverse(f"{namespace}_delete", args=[record.pk]),
                {"post": "yes"},
            ).status_code
            == 403
        )
        assert model.objects.filter(pk=record.pk).exists()

    assert WorkingShift.objects.count() == 1
    assert ClinicDefaultShift.objects.count() == 1
    assert AvailabilityException.objects.count() == 1
    assert Appointment.objects.count() == 1
