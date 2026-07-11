import pytest
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.ai_results.models import AIResult
from apps.accounts.models import User
from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.patients.models import Patient
from apps.scheduling.models import Appointment, AvailabilityException, Weekday, WorkingShift
from apps.visits.models import Visit
from apps.xrays.models import ExternalXrayCase, XrayAttachment


@pytest.fixture
def api_client():
    return APIClient()


def make_user(email, role, password="password123", **extra_fields):
    defaults = {
        "full_name": f"{role.title()} User",
        "role": role,
        "is_active": True,
        "must_change_password": False,
    }
    defaults.update(extra_fields)
    return User.objects.create_user(email=email, password=password, **defaults)


@pytest.fixture
def admin_user(db):
    return make_user("admin@example.com", User.Role.ADMIN, is_staff=True)


@pytest.fixture
def staff_user(db):
    return make_user("staff@example.com", User.Role.STAFF)


@pytest.fixture
def doctor_user(db):
    return make_user("doctor@example.com", User.Role.DOCTOR)


@pytest.fixture
def other_doctor_user(db):
    return make_user("other-doctor@example.com", User.Role.DOCTOR)


@pytest.fixture
def inactive_user(db):
    return make_user("inactive@example.com", User.Role.STAFF, is_active=False)


def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def admin_client(admin_user):
    return authenticated_client(admin_user)


@pytest.fixture
def staff_client(staff_user):
    return authenticated_client(staff_user)


@pytest.fixture
def doctor_client(doctor_user):
    return authenticated_client(doctor_user)


@pytest.fixture
def other_doctor_client(other_doctor_user):
    return authenticated_client(other_doctor_user)


@pytest.fixture
def patient_factory(db, staff_user):
    def create_patient(**overrides):
        full_name = overrides.pop("full_name", None)
        if full_name:
            name_parts = full_name.split(" ", 1)
            overrides.setdefault("first_name", name_parts[0])
            overrides.setdefault("last_name", name_parts[1] if len(name_parts) > 1 else "Patient")
        if "phone" in overrides:
            overrides.setdefault("phone_number", overrides.pop("phone"))
        if "birth_date" in overrides:
            overrides.setdefault("date_of_birth", overrides.pop("birth_date"))
        if "medical_summary" in overrides:
            overrides.setdefault("medical_conditions_history", overrides.pop("medical_summary"))
        if overrides.get("gender") == "MALE":
            overrides["gender"] = Patient.Gender.MALE
        if overrides.get("gender") == "FEMALE":
            overrides["gender"] = Patient.Gender.FEMALE
        if overrides.get("gender") in {"OTHER", "UNSPECIFIED"}:
            overrides["gender"] = Patient.Gender.FEMALE
        defaults = {
            "first_name": "Ahmad",
            "last_name": "Khaled",
            "phone_number": "0933000000",
            "gender": Patient.Gender.MALE,
            "created_by": staff_user,
            "updated_by": staff_user,
        }
        defaults.update(overrides)
        return Patient.objects.create(**defaults)

    return create_patient


@pytest.fixture
def patient(patient_factory):
    return patient_factory()


@pytest.fixture
def working_hour_factory(db, doctor_user):
    def create_working_hour(**overrides):
        if "doctor" in overrides:
            overrides["employee"] = overrides.pop("doctor")
        defaults = {
            "employee": doctor_user,
            "weekday": Weekday.MONDAY,
            "name": "Test shift",
            "start_time": "09:00",
            "end_time": "13:00",
            "is_active": True,
        }
        defaults.update(overrides)
        return WorkingShift.objects.create(**defaults)

    return create_working_hour


@pytest.fixture
def availability_exception_factory(db, admin_user, doctor_user):
    def create_exception(**overrides):
        defaults = {
            "doctor": doctor_user,
            "start_datetime": "2026-07-10T09:00:00+03:00",
            "end_datetime": "2026-07-10T10:00:00+03:00",
            "type": AvailabilityException.Type.UNAVAILABLE,
            "reason": "Conference",
            "created_by": admin_user,
            "updated_by": admin_user,
        }
        defaults.update(overrides)
        return AvailabilityException.objects.create(**defaults)

    return create_exception


@pytest.fixture
def appointment_factory(db, patient, doctor_user, staff_user):
    def create_appointment(**overrides):
        defaults = {
            "patient": patient,
            "doctor": doctor_user,
            "start_datetime": "2026-07-20T09:00:00+03:00",
            "end_datetime": "2026-07-20T09:30:00+03:00",
            "duration_minutes": 30,
            "reason": "Tooth pain",
            "notes": "",
            "status": Appointment.Status.UPCOMING,
            "created_by": staff_user,
            "updated_by": staff_user,
        }
        defaults.update(overrides)
        return Appointment.objects.create(**defaults)

    return create_appointment


@pytest.fixture
def visit_factory(db, appointment_factory, doctor_user):
    def create_visit(**overrides):
        appointment = overrides.pop("appointment", None)
        visit_status = overrides.get("status", Visit.Status.ACTIVE)
        if appointment is None:
            appointment_status = Appointment.Status.ACTIVE if visit_status == Visit.Status.ACTIVE else Appointment.Status.COMPLETED
            appointment = appointment_factory(status=appointment_status)

        now = timezone.now()
        defaults = {
            "appointment": appointment,
            "patient": appointment.patient,
            "doctor": appointment.doctor,
            "status": visit_status,
            "started_at": now,
            "completed_at": now if visit_status == Visit.Status.COMPLETED else None,
            "created_by": appointment.doctor,
            "updated_by": appointment.doctor,
        }
        defaults.update(overrides)
        return Visit.objects.create(**defaults)

    return create_visit


@pytest.fixture
def active_visit(visit_factory):
    return visit_factory(status=Visit.Status.ACTIVE)


@pytest.fixture
def completed_visit(visit_factory):
    return visit_factory(status=Visit.Status.COMPLETED)


@pytest.fixture
def xray_file_factory():
    def create_file(name="xray.png", content_type="image/png", size=18):
        content = b"x" * size
        return SimpleUploadedFile(name, content, content_type=content_type)

    return create_file


@pytest.fixture
def xray_attachment_factory(db, active_visit, doctor_user, xray_file_factory):
    def create_xray(**overrides):
        uploaded_file = overrides.pop("uploaded_file", xray_file_factory())
        defaults = {
            "patient": active_visit.patient,
            "visit": active_visit,
            "uploaded_by": active_visit.doctor,
            "source": XrayAttachment.Source.ACTIVE_VISIT,
            "original_file": uploaded_file,
            "stored_file_name": "factory-xray.png",
            "original_file_name": uploaded_file.name,
            "content_type": uploaded_file.content_type,
            "size_bytes": uploaded_file.size,
        }
        defaults.update(overrides)
        return XrayAttachment.objects.create(**defaults)

    return create_xray


@pytest.fixture
def external_xray_case_factory(db, doctor_user, xray_file_factory):
    def create_external_case(**overrides):
        uploaded_file = overrides.pop("uploaded_file", xray_file_factory(name="external.png"))
        defaults = {
            "uploaded_by": doctor_user,
            "original_file": uploaded_file,
            "stored_file_name": "factory-external.png",
            "original_file_name": uploaded_file.name,
            "content_type": uploaded_file.content_type,
            "size_bytes": uploaded_file.size,
            "status": ExternalXrayCase.Status.TEMPORARY,
        }
        defaults.update(overrides)
        return ExternalXrayCase.objects.create(**defaults)

    return create_external_case


@pytest.fixture
def ai_result_factory(db, xray_attachment_factory):
    def create_ai_result(**overrides):
        external_case = overrides.pop("external_xray_case", None)
        xray = overrides.pop("xray_attachment", None) if external_case else overrides.pop("xray_attachment", None) or xray_attachment_factory()
        defaults = {
            "xray_attachment": xray,
            "external_xray_case": external_case,
            "status": AIResult.Status.COMPLETED,
            "result_summary": "Research-only AI analysis completed.",
            "overall_confidence": 0.74,
            "findings_json": [
                {
                    "fdi_tooth_id": "36",
                    "disease_label": "Caries",
                    "confidence_score": 0.82,
                }
            ],
            "model_version": "pearlix-mock-xray-v1",
        }
        defaults.update(overrides)
        return AIResult.objects.create(**defaults)

    return create_ai_result


@pytest.fixture
def billing_handoff_factory(db, completed_visit, doctor_user):
    def create_billing_handoff(**overrides):
        defaults = {
            "patient": completed_visit.patient,
            "visit": completed_visit,
            "doctor": completed_visit.doctor,
            "note": "Please invoice patient.",
            "suggested_amount": "100.00",
            "currency": BillingHandoff.Currency.SYP,
            "status": BillingHandoff.Status.PENDING,
            "created_by": completed_visit.doctor,
            "updated_by": completed_visit.doctor,
        }
        defaults.update(overrides)
        return BillingHandoff.objects.create(**defaults)

    return create_billing_handoff


@pytest.fixture
def invoice_factory(db, patient, staff_user):
    def create_invoice(**overrides):
        defaults = {
            "invoice_number": f"INV-FACTORY-{Invoice.objects.count() + 1:06d}",
            "patient": patient,
            "currency": Invoice.Currency.SYP,
            "total_amount": "100.00",
            "notes": "",
            "status": Invoice.Status.UNPAID,
            "created_by": staff_user,
        }
        defaults.update(overrides)
        return Invoice.objects.create(**defaults)

    return create_invoice


@pytest.fixture
def payment_factory(db, invoice_factory, staff_user):
    def create_payment(**overrides):
        invoice = overrides.pop("invoice", None) or invoice_factory()
        defaults = {
            "invoice": invoice,
            "amount": "50.00",
            "currency": invoice.currency,
            "payment_date": timezone.now(),
            "notes": "",
            "created_by": staff_user,
        }
        defaults.update(overrides)
        return Payment.objects.create(**defaults)

    return create_payment
