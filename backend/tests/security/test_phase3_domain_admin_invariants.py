import pytest
from django.contrib import admin
from django.urls import reverse

from apps.accounts.models import User


@pytest.mark.django_db
def test_patient_visit_and_billing_django_admins_are_view_only(
    client,
    rf,
    patient,
    visit_factory,
    billing_handoff_factory,
    invoice_factory,
):
    django_admin = User.objects.create_superuser(
        email="phase3-domain-django-admin@example.com",
        password="strong-admin-password",
        full_name="Phase 3 Domain Django Admin",
    )
    visit = visit_factory()
    handoff = billing_handoff_factory()
    invoice = invoice_factory(billing_handoff=handoff)
    records = [patient, visit, handoff, invoice]
    client.force_login(django_admin)
    request = rf.get("/admin/")
    request.user = django_admin

    for record in records:
        model = type(record)
        model_admin = admin.site._registry[model]
        namespace = f"admin:{model._meta.app_label}_{model._meta.model_name}"

        assert model_admin.has_view_permission(request, record) is True
        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request, record) is False
        assert model_admin.has_delete_permission(request, record) is False

        assert client.get(reverse(f"{namespace}_changelist")).status_code == 200
        assert client.get(reverse(f"{namespace}_change", args=[record.pk])).status_code == 200
        assert client.get(reverse(f"{namespace}_add")).status_code == 403
        assert client.post(
            reverse(f"{namespace}_change", args=[record.pk]),
            {"status": "TAMPERED", "amount": "999999.00"},
        ).status_code == 403
        assert client.post(
            reverse(f"{namespace}_delete", args=[record.pk]),
            {"post": "yes"},
        ).status_code == 403
        assert model.objects.filter(pk=record.pk).exists()
