from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.contrib import admin
from django.db import close_old_connections, connection
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import AccountSecurityState, DoctorProfile, StaffProfile, User
from apps.accounts.team_services import TeamRuleError, confirm_transition, transition_preview
from apps.ai_results.models import AIResult
from apps.clinic.models import ClinicSettings


PASSWORD = "Phase6-Original!4567"
RESET_PASSWORD = "Phase6-Recovery!9472"


def _maintenance_user(email: str, *, is_active: bool = True) -> User:
    return User.objects.create_superuser(
        email=email,
        password=PASSWORD,
        full_name=email.split("@", 1)[0],
        is_active=is_active,
    )


def _client_for(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_business_admin_cannot_mutate_maintenance_principals(admin_client):
    target = _maintenance_user("protected-maintenance@example.com")
    inactive_target = _maintenance_user("inactive-maintenance@example.com", is_active=False)
    initial_version = target.version
    initial_password = target.password

    attempts = [
        admin_client.post(
            f"/api/users/{target.id}/reset-password/",
            {"temporary_password": RESET_PASSWORD},
            format="json",
        ),
        admin_client.patch(
            f"/api/users/{target.id}/",
            {"email": "attacker-controlled@example.com"},
            format="json",
        ),
        admin_client.post(
            f"/api/users/{target.id}/transition-role/",
            {"target_role": User.Role.STAFF, "mode": "PREVIEW"},
            format="json",
        ),
        admin_client.post(f"/api/users/{target.id}/deactivate/"),
        admin_client.post(f"/api/users/{inactive_target.id}/reactivate/"),
    ]

    assert [response.status_code for response in attempts] == [403, 403, 403, 403, 403]
    assert all(response.data["code"] == "PERMISSION_DENIED" for response in attempts)
    target.refresh_from_db()
    inactive_target.refresh_from_db()
    assert target.email == "protected-maintenance@example.com"
    assert target.password == initial_password
    assert target.version == initial_version
    assert target.is_active is True
    assert target.is_superuser is True
    assert inactive_target.is_active is False


@pytest.mark.django_db
def test_maintenance_superuser_can_recover_another_maintenance_account():
    actor = _maintenance_user("authorized-maintenance@example.com")
    target = _maintenance_user("maintenance-recovery-target@example.com")
    response = _client_for(actor).post(
        f"/api/users/{target.id}/reset-password/",
        {"temporary_password": RESET_PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.check_password(RESET_PASSWORD)
    assert target.must_change_password is True
    assert target.is_superuser is True
    assert target.is_staff is True


@pytest.mark.django_db
def test_final_maintenance_principal_survives_business_account_workflows(admin_client):
    target = _maintenance_user("final-maintenance@example.com")

    deactivation = admin_client.post(f"/api/users/{target.id}/deactivate/")
    transition = admin_client.post(
        f"/api/users/{target.id}/transition-role/",
        {"target_role": User.Role.DOCTOR, "mode": "PREVIEW"},
        format="json",
    )

    assert deactivation.status_code == 403
    assert transition.status_code == 403
    target.refresh_from_db()
    assert target.role == User.Role.ADMIN
    assert target.is_active is True
    assert target.is_staff is True
    assert target.is_superuser is True
    assert User.objects.filter(
        role=User.Role.ADMIN,
        is_active=True,
        is_staff=True,
        is_superuser=True,
    ).count() == 1


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_maintenance_removals_leave_one_usable_superuser():
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row-lock interleaving proof")
    AccountSecurityState.objects.get_or_create(pk=1)
    first = _maintenance_user("phase6-pg-first@example.com")
    second = _maintenance_user("phase6-pg-second@example.com")
    first_preview = transition_preview(user=first, target_role=User.Role.STAFF, actor=second)
    second_preview = transition_preview(user=second, target_role=User.Role.STAFF, actor=first)
    barrier = Barrier(2)

    def demote(target_id, actor_id, token, version):
        close_old_connections()
        barrier.wait(timeout=10)
        try:
            actor = User.objects.get(pk=actor_id)
            confirm_transition(
                user_id=target_id,
                actor=actor,
                target_role=User.Role.STAFF,
                token=token,
                version=version,
                profile={"position": "Former maintenance", "phone": ""},
            )
            return "ok"
        except TeamRuleError as exc:
            return exc.code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(
            executor.map(
                lambda args: demote(*args),
                [
                    (first.id, second.id, first_preview["confirmation_token"], first.version),
                    (second.id, first.id, second_preview["confirmation_token"], second.version),
                ],
            )
        )

    assert outcomes.count("ok") == 1
    assert User.objects.filter(
        role=User.Role.ADMIN,
        is_active=True,
        is_staff=True,
        is_superuser=True,
    ).count() == 1


@pytest.mark.django_db
def test_service_owned_django_admin_records_are_diagnostic_only(
    client,
    rf,
    doctor_user,
    staff_user,
    xray_attachment_factory,
    external_xray_case_factory,
):
    maintenance = _maintenance_user("phase6-admin-inspector@example.com")
    doctor_profile = DoctorProfile.objects.create(user=doctor_user, specialty="General")
    staff_profile = StaffProfile.objects.create(user=staff_user, position="Reception")
    xray = xray_attachment_factory()
    external = external_xray_case_factory()
    ai_result = AIResult.objects.create(
        xray_attachment=xray,
        requested_by=doctor_user,
        status=AIResult.Status.COMPLETED,
        result_summary="Stored diagnostic result",
        model_version="phase6-test",
    )
    records = [
        doctor_profile,
        staff_profile,
        ClinicSettings.get_solo(),
        xray,
        external,
        ai_result,
    ]
    client.force_login(maintenance)
    request = rf.get("/admin/")
    request.user = maintenance

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
            {"status": "TAMPERED", "size_bytes": 999999999},
        ).status_code == 403
        assert client.post(
            reverse(f"{namespace}_delete", args=[record.pk]),
            {"post": "yes"},
        ).status_code == 403
        assert model.objects.filter(pk=record.pk).exists()
