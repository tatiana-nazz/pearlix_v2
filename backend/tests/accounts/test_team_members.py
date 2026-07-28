import pytest
from rest_framework.test import APIClient
from django.core.management import call_command

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.audit.models import ActivityLog
from apps.scheduling.models import Appointment, Weekday, WorkingShift


@pytest.mark.django_db
def test_team_member_onboarding_is_transactional_and_sanitized(admin_client):
    response = admin_client.post("/api/team-members/", {
        "account": {"full_name": "Dr. Team", "email": "team-doctor@example.com", "temporary_password": "StrongTeam!4567"},
        "role": "DOCTOR",
        "doctor_profile": {"specialty": "Endodontics", "phone": "+9631", "bio": "Professional bio"},
    }, format="json")

    assert response.status_code == 201
    user = User.objects.get(email="team-doctor@example.com")
    assert user.must_change_password and user.check_password("StrongTeam!4567")
    assert user.role == User.Role.DOCTOR and user.doctor_profile.specialty == "Endodontics"
    assert response.data["account"]["is_active"] is True
    assert response.data["professional_status"] == "INACTIVE"
    assert response.data["operational_status"] == "SETUP_REQUIRED"
    event = ActivityLog.objects.get(action="team_member_created", entity_id=str(user.id))
    assert "password" not in str(event.metadata_json).lower()


@pytest.mark.django_db
def test_professional_activation_requires_an_active_shift_and_preserves_version(admin_client, doctor_user):
    profile = DoctorProfile.objects.create(user=doctor_user, specialty="General", is_active=False)
    rejected = admin_client.post(f"/api/team-members/{doctor_user.id}/set-professional-status/", {"version": profile.version, "is_active": True}, format="json")
    profile.refresh_from_db()
    assert rejected.status_code == 409
    assert rejected.data["code"] == "ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE"
    assert profile.is_active is False and profile.version == 1 and doctor_user.is_active is True
    WorkingShift.objects.create(employee=doctor_user, weekday=Weekday.MONDAY, name="Morning", start_time="09:00", end_time="12:00")
    activated = admin_client.post(f"/api/team-members/{doctor_user.id}/set-professional-status/", {"version": profile.version, "is_active": True}, format="json")
    assert activated.status_code == 200 and activated.data["operational_status"] == "ACTIVE"


@pytest.mark.django_db
def test_audit_professional_schedules_fixes_only_profile_status(capsys, doctor_user):
    profile = DoctorProfile.objects.create(user=doctor_user, specialty="General", is_active=True)
    call_command("audit_professional_schedules")
    assert "violations=1" in capsys.readouterr().out
    call_command("audit_professional_schedules", "--fix")
    profile.refresh_from_db(); doctor_user.refresh_from_db()
    assert profile.is_active is False and profile.version == 2 and doctor_user.is_active is True
    assert ActivityLog.objects.filter(action="professional_schedule_invariant_repaired", entity_id=str(doctor_user.id)).exists()


@pytest.mark.django_db
def test_team_onboarding_rolls_back_invalid_profile_payload(admin_client):
    response = admin_client.post("/api/team-members/", {
        "account": {"full_name": "Broken", "email": "broken-team@example.com", "temporary_password": "StrongTeam!4567"},
        "role": "DOCTOR",
        "staff_profile": {"position": "Reception", "phone": "+9632"},
    }, format="json")

    assert response.status_code == 400
    assert not User.objects.filter(email="broken-team@example.com").exists()

    unknown = admin_client.post("/api/team-members/", {
        "account": {"full_name": "Unknown", "email": "unknown-team@example.com", "temporary_password": "StrongTeam!4567", "is_active": False},
        "role": "STAFF",
        "staff_profile": {"position": "Reception", "phone": "+9632"},
    }, format="json")
    assert unknown.status_code == 400
    assert "is_active" in unknown.data["details"]["account"]


@pytest.mark.django_db
def test_team_list_excludes_admin_and_unlinked_professional_accounts(admin_client, admin_user, doctor_user, staff_user):
    DoctorProfile.objects.create(user=doctor_user, specialty="Orthodontics", phone="1")
    response = admin_client.get("/api/team-members/?role=DOCTOR")

    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [doctor_user.id]
    assert admin_user.id not in {row["id"] for row in response.data["results"]}
    assert staff_user.id not in {row["id"] for row in response.data["results"]}


@pytest.mark.django_db
def test_team_endpoints_require_authentication_and_keep_doctors_denied(api_client, doctor_client):
    for client in (api_client, doctor_client):
        response = client.get("/api/team-members/")
        assert response.status_code in {401, 403}


@pytest.mark.django_db
def test_staff_has_read_only_safe_team_directory_access(admin_client, staff_client, doctor_client, doctor_user, staff_user):
    DoctorProfile.objects.create(user=doctor_user, specialty="Endodontics", phone="111")
    StaffProfile.objects.create(user=staff_user, position="Coordinator", phone="222")
    WorkingShift.objects.create(employee=doctor_user, weekday=Weekday.MONDAY, name="Morning", start_time="09:00", end_time="12:00", is_active=True)
    WorkingShift.objects.create(employee=doctor_user, weekday=Weekday.TUESDAY, name="Afternoon", start_time="13:00", end_time="16:00", is_active=True)

    listed = staff_client.get("/api/team-members/?role=DOCTOR")
    detail = staff_client.get(f"/api/team-members/{doctor_user.id}/")

    assert admin_client.get("/api/team-members/").status_code == 200
    assert listed.status_code == 200 and listed.data["count"] == 1
    assert detail.status_code == 200
    assert listed.data["results"][0]["schedule_summary"] == {"has_active_schedule": True, "active_shift_count": 2}
    assert {"id", "role", "full_name", "email", "availability", "today_workload", "schedule_summary"} <= set(detail.data)
    forbidden = {"account", "version", "created_at", "updated_at"}
    assert not (forbidden & set(detail.data))
    assert "is_active" not in detail.data["profile"]
    assert "id" not in detail.data["active_shifts"][0]
    assert "id" not in detail.data["today_appointments"][0] if detail.data["today_appointments"] else True
    for method, path, data in (
        (staff_client.post, "/api/team-members/", {"role": "DOCTOR"}),
        (staff_client.patch, f"/api/team-members/{doctor_user.id}/", {"version": 1, "specialty": "Changed"}),
        (staff_client.post, f"/api/team-members/{doctor_user.id}/set-professional-status/", {"version": 1, "is_active": False}),
        (staff_client.delete, f"/api/team-members/{doctor_user.id}/", {}),
    ):
        response = method(path, data, format="json")
        assert response.status_code == 403
    assert doctor_client.get("/api/team-members/").status_code == 403


@pytest.mark.django_db
def test_profile_update_and_status_use_profile_version_and_preserve_login(admin_client, doctor_user):
    profile = DoctorProfile.objects.create(user=doctor_user, specialty="General", phone="1")
    missing = admin_client.patch(f"/api/team-members/{doctor_user.id}/", {"specialty": "Endodontics"}, format="json")
    stale = admin_client.patch(f"/api/team-members/{doctor_user.id}/", {"version": 99, "specialty": "Endodontics"}, format="json")
    updated = admin_client.patch(f"/api/team-members/{doctor_user.id}/", {"version": profile.version, "specialty": "Endodontics"}, format="json")
    inactive = admin_client.post(f"/api/team-members/{doctor_user.id}/set-professional-status/", {"version": updated.data["version"], "is_active": False, "reason": "Leave"}, format="json")

    assert missing.status_code == 400
    assert stale.status_code == 409 and stale.data["code"] == "VERSION_CONFLICT"
    assert updated.status_code == 200 and updated.data["specialty"] == "Endodontics"
    assert inactive.status_code == 200 and inactive.data["professional_status"] == "INACTIVE"
    doctor_user.refresh_from_db(); doctor_user.doctor_profile.refresh_from_db()
    assert doctor_user.is_active is True and doctor_user.doctor_profile.is_active is False


@pytest.mark.django_db
def test_generic_user_api_blocks_new_professional_orphans_and_role_bypass(admin_client, staff_user):
    created = admin_client.post("/api/users/", {"email": "orphan@example.com", "full_name": "Orphan", "role": "STAFF", "temporary_password": "StrongTeam!4567"}, format="json")
    patched = admin_client.patch(f"/api/users/{staff_user.id}/", {"role": "DOCTOR"}, format="json")

    assert created.status_code == 400 and "role" in created.data["details"]
    assert patched.status_code == 400 and "role" in patched.data["details"]
    assert not User.objects.filter(email="orphan@example.com").exists()


@pytest.mark.django_db
def test_linked_profile_state_and_reactivation(admin_client, staff_user):
    legacy = admin_client.get(f"/api/users/{staff_user.id}/")
    assert legacy.data["linked_profile_state"] == "PROFILE_SETUP_REQUIRED"
    StaffProfile.objects.create(user=staff_user, position="Reception", phone="1")
    admin_client.post(f"/api/users/{staff_user.id}/deactivate/")
    response = admin_client.post(f"/api/users/{staff_user.id}/reactivate/")
    already_active = admin_client.post(f"/api/users/{staff_user.id}/reactivate/")

    assert response.status_code == 200 and response.data["linked_profile_state"] == "STAFF"
    assert already_active.status_code == 409 and already_active.data["code"] == "USER_ALREADY_ACTIVE"
    assert ActivityLog.objects.filter(action="user_reactivated", entity_id=str(staff_user.id)).exists()


@pytest.mark.django_db
def test_transition_preview_confirmation_and_history_block(admin_client, admin_user, doctor_user, patient, appointment_factory):
    other_admin = User.objects.create_user(email="other-admin-team@example.com", password="password123", full_name="Other Admin", role=User.Role.ADMIN, is_staff=True)
    other_admin_client = APIClient(); other_admin_client.force_authenticate(user=other_admin)
    preview = other_admin_client.post(f"/api/users/{admin_user.id}/transition-role/", {"target_role": "DOCTOR", "mode": "PREVIEW"}, format="json")
    confirmed = other_admin_client.post(f"/api/users/{admin_user.id}/transition-role/", {"target_role": "DOCTOR", "mode": "CONFIRM", "confirmation_token": preview.data["confirmation_token"], "profile": {"specialty": "General", "phone": "1", "bio": ""}, "version": admin_user.version}, format="json")
    DoctorProfile.objects.create(user=doctor_user, specialty="General")
    appointment_factory(doctor=doctor_user, patient=patient, status=Appointment.Status.UPCOMING)
    blocked = admin_client.post(f"/api/users/{doctor_user.id}/transition-role/", {"target_role": "STAFF", "mode": "PREVIEW"}, format="json")

    assert preview.status_code == 200 and preview.data["allowed"] is True
    assert confirmed.status_code == 200 and confirmed.data["role"] == "DOCTOR"
    assert blocked.status_code == 200 and blocked.data["allowed"] is False
    assert blocked.data["blockers"][0]["code"] == "ROLE_TRANSITION_BLOCKED_BY_HISTORY"


@pytest.mark.django_db
def test_self_role_change_and_last_admin_transition_are_protected(admin_client, admin_user):
    self_change = admin_client.post(f"/api/users/{admin_user.id}/transition-role/", {"target_role": "STAFF", "mode": "PREVIEW"}, format="json")
    assert self_change.status_code == 403 and self_change.data["code"] == "SELF_ROLE_CHANGE_FORBIDDEN"
