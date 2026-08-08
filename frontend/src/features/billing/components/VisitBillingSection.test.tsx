import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { BillingHandoff } from "../../../types/billing";
import type { VisitDetail } from "../../../types/visits";
import { VisitBillingSection, type VisitBillingDraft } from "./VisitBillingSection";

const state = vi.hoisted(() => ({
  data: undefined as { count: number; next: null; previous: null; results: BillingHandoff[] } | undefined,
  settings: vi.fn(),
}));

vi.mock("../hooks/useBilling", () => ({
  useHandoffs: () => ({ data: state.data, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("../../../api/endpoints/clinic", () => ({ clinicApi: { getSettings: state.settings } }));

const visit = {
  id: 91,
  appointment: { id: 17, start_datetime: "2026-07-26T09:00:00Z", end_datetime: "2026-07-26T09:30:00Z", duration_minutes: 30, status: "CHECKED_IN", reason: "Restorative treatment" },
  patient: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  doctor: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR" },
  status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null, symptoms: "", diagnosis: "", treatment: "Composite restoration", clinical_notes: "", follow_up_notes: "", created_at: "2026-07-26", updated_at: "2026-07-26",
} as VisitDetail;

function BillingHarness({ currentVisit = visit }: { currentVisit?: VisitDetail }) {
  const [draft, setDraft] = useState<VisitBillingDraft>({ description: "", amount: "", currency: "", note: "" });
  return <VisitBillingSection role="DOCTOR" visit={currentVisit} draft={draft} errors={{}} onDraftChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} />;
}

describe("VisitBillingSection", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } });
    state.data = { count: 0, next: null, previous: null, results: [] };
    state.settings.mockReset();
    state.settings.mockResolvedValue({ default_currency: "SYP" });
  });

  it("keeps the active-visit billing form editable and uses the clinic currency", async () => {
    render(<BillingHarness />);
    expect(screen.getByText("Completing the visit creates one OPEN Handoff bill with zero invoices.")).toBeInTheDocument();
    expect(screen.queryByText("Complete the visit before sending the invoice handoff to Billing.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Treatment / bill description"), { target: { value: "Restorative dental treatment" } });
    fireEvent.change(screen.getByLabelText("Total treatment charge"), { target: { value: "250.00" } });
    fireEvent.change(screen.getByLabelText("Billing note"), { target: { value: "Collect at reception" } });
    expect(screen.getByLabelText("Treatment / bill description")).toHaveValue("Restorative dental treatment");
    expect(screen.getByLabelText("Total treatment charge")).toHaveValue("250.00");
    expect(screen.getByLabelText("Billing note")).toHaveValue("Collect at reception");
    await waitFor(() => expect(screen.getByLabelText("Currency")).toHaveValue("SYP"));
    expect(screen.queryByRole("button", { name: "Send to Billing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /payment/i })).not.toBeInTheDocument();
  });

  it("shows a persisted Handoff and its invoice count read-only without Doctor payment actions", () => {
    state.data = { count: 1, next: null, previous: null, results: [{
      id: 4, description: "Restorative dental treatment", patient: visit.patient, visit: { id: 91, status: "COMPLETED", started_at: visit.started_at, completed_at: "2026-07-26T10:00:00Z", appointment: visit.appointment }, doctor: visit.doctor, note: "Front desk note", total_amount: "1250.00", paid_amount: "250.00", remaining_amount: "1000.00", invoice_count: 1, invoices: [], currency: "SYP", status: "PARTIALLY_PAID", origin: "VISIT_COMPLETION", legacy_reference: "", cancelled_at: null, cancelled_reason: "", created_by: visit.doctor, updated_by: visit.doctor, created_at: "2026-07-26T10:00:00Z", updated_at: "2026-07-26T11:00:00Z",
    } as BillingHandoff] };
    render(<BillingHarness currentVisit={{ ...visit, status: "COMPLETED" }} />);
    expect(screen.getByText("Restorative dental treatment")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY PAID")).toBeInTheDocument();
    expect(screen.getByText("Invoices").parentElement).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: /payment|paid|invoice/i })).not.toBeInTheDocument();
  });
});
