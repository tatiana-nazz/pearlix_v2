import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { BillingHandoff } from "../../../types/billing";
import type { VisitDetail } from "../../../types/visits";
import { VisitBillingSection } from "./VisitBillingSection";

const state = vi.hoisted(() => ({
  data: undefined as { count: number; next: null; previous: null; results: BillingHandoff[] } | undefined,
  create: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("../hooks/useBilling", () => ({
  useHandoffs: () => ({ data: state.data, isLoading: false, error: null, refetch: vi.fn() }),
  useBillingMutations: () => ({ createHandoff: { mutateAsync: state.create, reset: state.reset, isPending: false, error: null } }),
}));

const visit = {
  id: 91,
  appointment: { id: 17, start_datetime: "2026-07-26T09:00:00Z", end_datetime: "2026-07-26T09:30:00Z", duration_minutes: 30, status: "CHECKED_IN", reason: "Restorative treatment" },
  patient: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  doctor: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR" },
  status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null, symptoms: "", diagnosis: "", treatment: "Composite restoration", clinical_notes: "", follow_up_notes: "", created_at: "2026-07-26", updated_at: "2026-07-26",
} as VisitDetail;

describe("VisitBillingSection", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } });
    state.data = { count: 0, next: null, previous: null, results: [] };
    state.create.mockReset();
    state.create.mockResolvedValue({});
  });

  it("shows the backend completion requirement for an active visit", () => {
    render(<VisitBillingSection role="DOCTOR" visit={visit} />);
    expect(screen.getByText("Complete the visit before sending the invoice handoff to Billing.")).toBeInTheDocument();
    expect(screen.queryByText("Billing handoff visibility follows your backend role permissions.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Treatment / invoice description")).toHaveValue("Composite restoration");
    expect(screen.getByLabelText("Total treatment charge")).toBeDisabled();
    expect(screen.getByLabelText("Currency")).toBeDisabled();
    expect(screen.getByLabelText("Billing note")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send to Billing" })).toBeDisabled();
  });

  it("uses the existing visit-scoped handoff mutation for an eligible visit", async () => {
    render(<VisitBillingSection role="DOCTOR" visit={{ ...visit, status: "COMPLETED", completed_at: "2026-07-26T10:00:00Z" }} />);
    expect(screen.getByLabelText("Treatment / invoice description")).toHaveValue("Composite restoration");
    fireEvent.change(screen.getByLabelText("Total treatment charge"), { target: { value: "1250.50" } });
    fireEvent.change(screen.getByLabelText("Billing note"), { target: { value: "Review at reception" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Billing" }));
    await waitFor(() => expect(state.create).toHaveBeenCalledWith({ visitId: 91, payload: { note: "Review at reception", suggested_amount: "1250.50", currency: "SYP" } }));
  });

  it("shows a linked invoice read-only without Doctor payment actions", () => {
    state.data = { count: 1, next: null, previous: null, results: [{
      id: 4, patient: visit.patient, visit: { id: 91, status: "COMPLETED", started_at: visit.started_at, completed_at: "2026-07-26T10:00:00Z", appointment: visit.appointment }, doctor: visit.doctor, note: "Front desk note", suggested_amount: "1250.00", currency: "SYP", status: "CONVERTED_TO_INVOICE", converted_invoice: { id: 8, invoice_number: "INV-2026-008", currency: "SYP", total_amount: "1250.00", paid_amount: "250.00", remaining_amount: "1000.00", status: "PARTIALLY_PAID" }, dismissed_reason: "", created_by: visit.doctor, updated_by: visit.doctor, created_at: "2026-07-26T10:00:00Z", updated_at: "2026-07-26T11:00:00Z",
    } as BillingHandoff] };
    render(<VisitBillingSection role="DOCTOR" visit={{ ...visit, status: "COMPLETED" }} />);
    expect(screen.getByText("INV-2026-008")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY PAID")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /payment|paid|invoice/i })).not.toBeInTheDocument();
  });
});
