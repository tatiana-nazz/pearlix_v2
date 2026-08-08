from decimal import Decimal

import pytest

from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.visits.services import complete_visit


def completion_payload(visit, **billing_overrides):
    billing = {
        "description": "Composite restoration and exam",
        "total_amount": "275000.00",
        "currency": "SYP",
        "note": "Collect at reception",
    }
    billing.update(billing_overrides)
    return {
        "version": visit.updated_at.isoformat(),
        "notes": {
            "symptoms": "Sensitivity",
            "diagnosis": "Caries",
            "treatment": "Composite restoration",
            "clinical_notes": "Procedure completed successfully.",
            "follow_up_notes": "Review in six months.",
        },
        "billing": billing,
    }


@pytest.mark.django_db
def test_doctor_completion_atomically_creates_exact_invoice_and_converted_provenance(
    doctor_client,
    doctor_user,
    visit_factory,
):
    visit = visit_factory(status=Visit.Status.ACTIVE)

    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", completion_payload(visit), format="json")

    assert response.status_code == 200
    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    invoice = Invoice.objects.get(visit=visit)
    handoff = BillingHandoff.objects.get(visit=visit)
    assert visit.status == Visit.Status.COMPLETED
    assert visit.completed_at is not None
    assert visit.clinical_notes == "Procedure completed successfully."
    assert visit.appointment.status == Appointment.Status.COMPLETED
    assert Invoice.objects.filter(visit=visit).count() == 1
    assert invoice.patient_id == visit.patient_id
    assert invoice.appointment_id == visit.appointment_id
    assert invoice.visit_id == visit.id
    assert invoice.created_by_id == doctor_user.id
    assert invoice.origin == Invoice.Origin.VISIT_COMPLETION
    assert invoice.description == "Composite restoration and exam"
    assert invoice.total_amount == Decimal("275000.00")
    assert invoice.currency == Invoice.Currency.SYP
    assert invoice.notes == "Collect at reception"
    assert invoice.status == Invoice.Status.UNPAID
    assert invoice.paid_amount == Decimal("0.00")
    assert handoff.status == BillingHandoff.Status.CONVERTED_TO_INVOICE
    assert handoff.converted_invoice_id == invoice.id
    assert invoice.billing_handoff_id == handoff.id
    assert not BillingHandoff.objects.filter(visit=visit, status=BillingHandoff.Status.PENDING).exists()
    assert response.data["created_invoice"]["id"] == invoice.id
    assert response.data["created_invoice"]["invoice_number"] == invoice.invoice_number
    assert response.data["created_invoice"]["status"] == Invoice.Status.UNPAID
    assert response.data["billing_provenance"]["status"] == BillingHandoff.Status.CONVERTED_TO_INVOICE

    completion_log = ActivityLog.objects.get(action="visit_completed", entity_id=str(visit.id))
    invoice_log = ActivityLog.objects.get(action="invoice_created", entity_id=str(invoice.id))
    for log in (completion_log, invoice_log):
        assert log.actor_id == doctor_user.id
        assert log.metadata_json["visit_id"] == visit.id
        assert log.metadata_json["appointment_id"] == visit.appointment_id
        assert log.metadata_json["patient_id"] == visit.patient_id
        assert log.metadata_json["invoice_id"] == invoice.id


@pytest.mark.django_db
def test_duplicate_completion_and_version_conflict_never_create_extra_financial_records(
    doctor_client,
    visit_factory,
):
    visit = visit_factory(status=Visit.Status.ACTIVE)
    payload = completion_payload(visit)
    first = doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json")
    second = doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json")
    assert first.status_code == 200
    assert second.status_code == 409
    assert Invoice.objects.filter(visit=visit).count() == 1
    assert BillingHandoff.objects.filter(visit=visit).count() == 1

    conflict_visit = visit_factory(status=Visit.Status.ACTIVE)
    conflict_payload = completion_payload(conflict_visit)
    conflict_payload["version"] = "2020-01-01T00:00:00Z"
    conflict = doctor_client.post(f"/api/visits/{conflict_visit.id}/complete/", conflict_payload, format="json")
    assert conflict.status_code == 409
    conflict_visit.refresh_from_db()
    assert conflict_visit.status == Visit.Status.ACTIVE
    assert not Invoice.objects.filter(visit=conflict_visit).exists()
    assert not BillingHandoff.objects.filter(visit=conflict_visit).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "billing",
    [
        {"description": "", "total_amount": "100.00", "currency": "SYP", "note": ""},
        {"description": "Treatment", "total_amount": "0", "currency": "SYP", "note": ""},
        {"description": "Treatment", "total_amount": "100.00", "currency": "EUR", "note": ""},
    ],
)
def test_invalid_billing_rolls_back_visit_appointment_and_invoice(
    doctor_client,
    visit_factory,
    billing,
):
    visit = visit_factory(status=Visit.Status.ACTIVE, clinical_notes="Original note")
    payload = completion_payload(visit)
    payload["billing"] = billing
    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json")
    assert response.status_code == 400
    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert visit.clinical_notes == "Original note"
    assert not Invoice.objects.filter(visit=visit).exists()
    assert not BillingHandoff.objects.filter(visit=visit).exists()


@pytest.mark.django_db
def test_audit_failure_rolls_back_completed_visit_and_financial_records(
    monkeypatch,
    doctor_user,
    visit_factory,
):
    visit = visit_factory(status=Visit.Status.ACTIVE, clinical_notes="Original note")

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit storage unavailable")

    monkeypatch.setattr("apps.visits.services.log_activity", fail_audit)
    payload = completion_payload(visit)
    with pytest.raises(RuntimeError, match="audit storage unavailable"):
        complete_visit(
            visit=visit,
            user=doctor_user,
            expected_updated_at=visit.updated_at,
            notes=payload["notes"],
            billing=payload["billing"],
        )

    visit.refresh_from_db()
    visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.completed_at is None
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert visit.clinical_notes == "Original note"
    assert not Invoice.objects.filter(visit=visit).exists()
    assert not BillingHandoff.objects.filter(visit=visit).exists()


@pytest.mark.django_db
def test_manual_invoice_permissions_and_required_description(
    doctor_client,
    staff_client,
    admin_client,
    patient,
):
    payload = {
        "patient_id": patient.id,
        "description": "Manual consultation invoice",
        "total_amount": "90.00",
        "currency": "USD",
        "notes": "Optional note",
    }
    assert doctor_client.post("/api/invoices/", payload, format="json").status_code == 403
    assert admin_client.post("/api/invoices/", payload, format="json").status_code == 403

    missing_description = dict(payload)
    missing_description.pop("description")
    response = staff_client.post("/api/invoices/", missing_description, format="json")
    assert response.status_code == 400
    assert "description" in response.data["details"]

    response = staff_client.post("/api/invoices/", payload, format="json")
    assert response.status_code == 201
    invoice = Invoice.objects.get(id=response.data["id"])
    assert invoice.patient_id == patient.id
    assert invoice.description == payload["description"]
    assert invoice.origin == Invoice.Origin.MANUAL
    assert invoice.created_by.role == "STAFF"

    assert admin_client.get(f"/api/invoices/{invoice.id}/").status_code == 200
    assert admin_client.patch(f"/api/invoices/{invoice.id}/", {"notes": "No"}, format="json").status_code == 403
    assert admin_client.post(f"/api/invoices/{invoice.id}/payments/", {"amount": "1.00", "currency": "USD"}, format="json").status_code == 403
