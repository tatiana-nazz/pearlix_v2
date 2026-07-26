import pytest
from rest_framework.test import APIClient

from apps.accounts.models import DoctorProfile, StaffProfile, User
from apps.audit.models import ActivityLog
from apps.scheduling.models import Appointment, WorkingShift


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
    event = ActivityLog.objects.get(action="team_member_created", entity_id=str(user.id))
    assert "password" not in str(event.metadata_json).lower()


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
def test_team_directory_requires_authentication_and_a_permitted_role(api_client, staff_client, doctor_client):
    assert api_client.get("/api/team-members/").status_code == 401
    assert staff_client.get("/api/team-members/").status_code == 200
    assert doctor_client.get("/api/team-members/").status_code == 403


@pytest.mark.django_db
def test_staff_team_directory_is_read_only_and_uses_safe_projection(api_client, admin_client, staff_client, doctor_client, doctor_user, staff_user):
    DoctorProfile.objects.create(user=doctor_user, specialty="Endodontics", phone="+963-11")
    StaffProfile.objects.create(user=staff_user, position="Reception", phone="+963-22")
    WorkingShift.objects.create(employee=doctor_user, name="Morning", weekday=0, start_time="08:00", end_time="12:00")

    admin_list = admin_client.get("/api/team-members/")
    admin_detail = admin_client.get(f"/api/team-members/{doctor_user.id}/")
    staff_list = staff_client.get("/api/team-members/")
    staff_detail = staff_client.get(f"/api/team-members/{doctor_user.id}/")

    assert admin_list.status_code == 200 and admin_detail.status_code == 200
    assert staff_list.status_code == 200 and staff_detail.status_code == 200
    staff_row = next(row for row in staff_list.data["results"] if row["id"] == doctor_user.id)
    assert staff_row["email"] == doctor_user.email
    assert staff_row["schedule_summary"] == [{"name": "Morning", "weekday": 0, "start_time": "08:00:00", "end_time": "12:00:00"}]
    assert "account" not in staff_row
    assert "account" not in staff_detail.data
    assert "today_appointments" not in staff_detail.data
    assert "version" not in staff_detail.data["active_shifts"][0]
    assert admin_detail.data["account"]["must_change_password"] is False

    assert staff_client.post("/api/team-members/", {}, format="json").status_code == 403
    assert staff_client.patch(f"/api/team-members/{doctor_user.id}/", {"specialty": "Other"}, format="json").status_code == 403
    assert staff_client.post(f"/api/team-members/{doctor_user.id}/set-professional-status/", {}, format="json").status_code == 403
    assert doctor_client.get("/api/team-members/").status_code == 403
    assert doctor_client.get(f"/api/team-members/{doctor_user.id}/").status_code == 403
    assert api_client.get("/api/team-members/").status_code == 401


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
