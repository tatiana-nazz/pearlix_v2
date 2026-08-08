import pytest

from apps.accounts.models import User
from apps.xrays.models import XrayAttachment


def _items(data):
    return data["results"] if isinstance(data, dict) and "results" in data else data


@pytest.mark.django_db
def test_login_me_and_admin_user_list_do_not_expose_sensitive_user_fields(api_client, admin_client, staff_user):
    login_response = api_client.post(
        "/api/auth/login/",
        {"email": staff_user.email, "password": "password123"},
        format="json",
    )
    admin_me_response = admin_client.get("/api/me/")
    users_response = admin_client.get("/api/users/")

    assert login_response.status_code == 200
    assert admin_me_response.status_code == 200
    assert users_response.status_code == 200

    user_payloads = [login_response.data["user"], admin_me_response.data, *_items(users_response.data)]
    for payload in user_payloads:
        assert "password" not in payload
        assert "is_staff" not in payload
        assert "is_superuser" not in payload


@pytest.mark.django_db
def test_preferences_endpoint_cannot_change_own_privilege_fields(staff_client, staff_user):
    response = staff_client.patch(
        "/api/me/preferences/",
        {
            "theme_preference": User.ThemePreference.DARK,
            "role": User.Role.ADMIN,
            "is_staff": True,
            "is_superuser": True,
            "must_change_password": True,
        },
        format="json",
    )

    assert response.status_code == 200
    staff_user.refresh_from_db()
    assert staff_user.role == User.Role.STAFF
    assert staff_user.is_staff is False
    assert staff_user.is_superuser is False
    assert staff_user.must_change_password is False
    assert response.data["role"] == User.Role.STAFF
    assert "is_staff" not in response.data
    assert "is_superuser" not in response.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path",
    [
        "/api/me/",
        "/api/clinic/settings/",
        "/api/patients/",
        "/api/appointments/",
        "/api/visits/",
        "/api/xrays/",
        "/api/external-xrays/",
        "/api/billing-handoffs/",
        "/api/invoices/",
        "/api/dashboard/admin/",
        "/api/audit-logs/",
    ],
)
def test_representative_protected_endpoints_reject_anonymous_users(api_client, path):
    response = api_client.get(path)

    assert response.status_code == 401
    assert response.data["code"] == "AUTH_REQUIRED"


@pytest.mark.django_db
def test_representative_role_boundaries_block_privilege_escalation(
    admin_client,
    staff_client,
    doctor_client,
    patient,
    appointment_factory,
    active_visit,
    xray_attachment_factory,
    invoice_factory,
):
    appointment = appointment_factory()
    xray = xray_attachment_factory()
    invoice = invoice_factory()

    assert (
        admin_client.post(
            "/api/patients/",
            {"first_name": "Blocked", "last_name": "Patient", "phone_number": "0900000000", "gender": "Female"},
            format="json",
        ).status_code
        == 403
    )
    assert admin_client.patch(f"/api/appointments/{appointment.id}/", {"reason": "Blocked"}, format="json").status_code == 403
    assert admin_client.patch(f"/api/visits/{active_visit.id}/clinical-notes/", {"diagnosis": "Blocked"}, format="json").status_code == 403
    assert admin_client.post(f"/api/xrays/{xray.id}/run-ai/").status_code == 403
    assert admin_client.post("/api/billing-handoffs/", {"patient_id": patient.id, "description": "Blocked", "total_amount": "20.00", "currency": "SYP"}, format="json").status_code == 403

    assert staff_client.post(f"/api/visits/{active_visit.id}/complete/").status_code == 403
    assert staff_client.patch(f"/api/visits/{active_visit.id}/clinical-notes/", {"diagnosis": "Blocked"}, format="json").status_code == 403
    assert staff_client.post(f"/api/xrays/{xray.id}/run-ai/").status_code == 403
    assert staff_client.get("/api/external-xrays/").status_code == 403
    assert staff_client.get("/api/audit-logs/").status_code == 403

    assert doctor_client.patch(f"/api/appointments/{appointment.id}/", {"reason": "Blocked"}, format="json").status_code == 403
    assert doctor_client.get(f"/api/invoices/{invoice.id}/").status_code == 403
    assert doctor_client.post(f"/api/billing-handoffs/{invoice.billing_handoff_id}/invoices/", {"amount": "5.00"}, format="json").status_code == 403
    assert doctor_client.get("/api/audit-logs/").status_code == 403
    assert XrayAttachment.objects.filter(id=xray.id).exists()
