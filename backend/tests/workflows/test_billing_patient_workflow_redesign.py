from decimal import Decimal

import pytest

from apps.audit.models import ActivityLog
from apps.billing.models import BillingHandoff, Invoice
from apps.scheduling.models import Appointment
from apps.visits.models import Visit
from apps.visits.services import complete_visit


def completion_payload(visit, **overrides):
    billing = {"description": "Composite restoration and exam", "total_amount": "275000.00", "currency": "SYP", "note": "Collect at reception"}
    billing.update(overrides)
    return {"version": visit.updated_at.isoformat(), "notes": {"symptoms": "Sensitivity", "diagnosis": "Caries", "treatment": "Composite restoration", "clinical_notes": "Procedure completed successfully.", "follow_up_notes": "Review in six months."}, "billing": billing}


@pytest.mark.django_db
def test_doctor_completion_atomically_creates_exactly_one_open_handoff_and_zero_invoices(doctor_client, doctor_user, visit_factory):
    visit = visit_factory(status=Visit.Status.ACTIVE)
    response = doctor_client.post(f"/api/visits/{visit.id}/complete/", completion_payload(visit), format="json")
    assert response.status_code == 200
    visit.refresh_from_db(); visit.appointment.refresh_from_db()
    handoff = BillingHandoff.objects.get(visit=visit)
    assert visit.status == Visit.Status.COMPLETED
    assert visit.appointment.status == Appointment.Status.COMPLETED
    assert handoff.patient_id == visit.patient_id
    assert handoff.doctor_id == doctor_user.id
    assert handoff.description == "Composite restoration and exam"
    assert handoff.total_amount == Decimal("275000.00")
    assert handoff.status == BillingHandoff.Status.OPEN
    assert handoff.origin == BillingHandoff.Origin.VISIT_COMPLETION
    assert handoff.paid_amount == Decimal("0.00")
    assert handoff.remaining_amount == handoff.total_amount
    assert handoff.invoice_count == 0
    assert not Invoice.objects.filter(billing_handoff=handoff).exists()
    assert response.data["created_handoff"]["id"] == handoff.id
    assert ActivityLog.objects.filter(action="visit_completed", entity_id=str(visit.id)).exists()
    assert ActivityLog.objects.filter(action="billing_handoff_created", entity_id=str(handoff.id)).exists()


@pytest.mark.django_db
def test_duplicate_or_stale_completion_never_creates_extra_financial_records(doctor_client, visit_factory):
    visit = visit_factory(status=Visit.Status.ACTIVE)
    payload = completion_payload(visit)
    assert doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json").status_code == 200
    assert doctor_client.post(f"/api/visits/{visit.id}/complete/", payload, format="json").status_code == 409
    assert BillingHandoff.objects.filter(visit=visit).count() == 1
    assert Invoice.objects.filter(billing_handoff__visit=visit).count() == 0
    stale = visit_factory(status=Visit.Status.ACTIVE)
    stale_payload = completion_payload(stale); stale_payload["version"] = "2020-01-01T00:00:00Z"
    assert doctor_client.post(f"/api/visits/{stale.id}/complete/", stale_payload, format="json").status_code == 409
    stale.refresh_from_db()
    assert stale.status == Visit.Status.ACTIVE
    assert not BillingHandoff.objects.filter(visit=stale).exists()


@pytest.mark.django_db
def test_audit_failure_rolls_back_visit_appointment_and_handoff(monkeypatch, doctor_user, visit_factory):
    visit = visit_factory(status=Visit.Status.ACTIVE, clinical_notes="Original note")
    monkeypatch.setattr("apps.visits.services.log_activity", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("audit unavailable")))
    payload = completion_payload(visit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        complete_visit(visit=visit, user=doctor_user, expected_updated_at=visit.updated_at, notes=payload["notes"], billing=payload["billing"])
    visit.refresh_from_db(); visit.appointment.refresh_from_db()
    assert visit.status == Visit.Status.ACTIVE
    assert visit.appointment.status == Appointment.Status.ACTIVE
    assert not BillingHandoff.objects.filter(visit=visit).exists()


@pytest.mark.django_db
def test_manual_charge_is_a_bill_not_an_invoice(staff_client, patient):
    response = staff_client.post("/api/billing-handoffs/", {"patient_id": patient.id, "description": "Manual consultation", "total_amount": "90.00", "currency": "USD", "note": "Optional"}, format="json")
    assert response.status_code == 201
    handoff = BillingHandoff.objects.get(pk=response.data["id"])
    assert handoff.origin == BillingHandoff.Origin.MANUAL
    assert handoff.invoice_count == 0
    assert not Invoice.objects.filter(billing_handoff=handoff).exists()
    assert staff_client.post("/api/invoices/", {"patient_id": patient.id, "amount": "90.00"}, format="json").status_code in {403, 405}
