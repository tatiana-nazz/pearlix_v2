import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { PearlixToothMark } from "../../../components/PearlixBrandMark";
import type { VisitDetail } from "../../../types/visits";
import { VisitWorkspace } from "./VisitWorkspace";

const mutationState = vi.hoisted(() => ({ complete: vi.fn(), update: vi.fn(), completePending: false }));
vi.mock("../hooks/useVisits", () => ({
  useUpdateClinicalNotes: () => ({ mutateAsync: mutationState.update, reset: vi.fn(), isPending: false, error: null }),
  useCompleteVisit: () => ({ mutateAsync: mutationState.complete, reset: vi.fn(), isPending: mutationState.completePending, error: null }),
}));
vi.mock("../../patients/hooks/usePatient", () => ({
  usePatient: () => ({ isLoading: false, isError: false, error: null, refetch: vi.fn(), data: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01", address: "Analytical Engine Lane", emergency_contact: "Charles Babbage", medical_conditions_history: "Penicillin allergy", insurance_info: "Clinic plan", general_notes: "", created_by: null, updated_by: null } }),
}));
vi.mock("../../xrays/components/ActiveVisitXrayWorkspace", () => ({ ActiveVisitXrayWorkspace: () => <p>Attachment panel</p> }));
vi.mock("../../billing/components/VisitBillingSection", () => ({
  VisitBillingSection: ({ draft, errors, onDraftChange }: { draft: Record<string, string>; errors: Record<string, string>; onDraftChange: (key: string, value: string) => void }) => <div>
    <label htmlFor="billing-description">Treatment / invoice description</label><input id="billing-description" value={draft.description} aria-invalid={Boolean(errors.description)} onChange={(event) => onDraftChange("description", event.target.value)} />{errors.description ? <span role="alert">{errors.description}</span> : null}
    <label htmlFor="billing-amount">Total treatment charge</label><input id="billing-amount" value={draft.amount} aria-invalid={Boolean(errors.amount)} onChange={(event) => onDraftChange("amount", event.target.value)} />{errors.amount ? <span role="alert">{errors.amount}</span> : null}
    <label htmlFor="billing-currency">Currency</label><select id="billing-currency" value={draft.currency} aria-invalid={Boolean(errors.currency)} onChange={(event) => onDraftChange("currency", event.target.value)}><option value="">Select currency</option><option value="SYP">SYP</option><option value="USD">USD</option></select>{errors.currency ? <span role="alert">{errors.currency}</span> : null}
    <label htmlFor="billing-note">Billing note</label><textarea id="billing-note" value={draft.note} onChange={(event) => onDraftChange("note", event.target.value)} />
  </div>,
}));

const visit = {
  id: 91,
  appointment: { id: 17, start_datetime: "2026-07-26T09:00:00Z", end_datetime: "2026-07-26T09:30:00Z", duration_minutes: 30, status: "CHECKED_IN", reason: "Review" },
  patient: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  doctor: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR" },
  status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null, symptoms: "Pain", diagnosis: "Caries", treatment: "Cleaning", clinical_notes: "Stable", follow_up_notes: "Review in six months", created_at: "2026-07-26", updated_at: "2026-07-26T09:01:00Z",
} as VisitDetail;

function renderWorkspace(role: "DOCTOR" | "STAFF" | "ADMIN" = "DOCTOR") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><VisitWorkspace role={role} visit={visit} /></MemoryRouter></QueryClientProvider>);
}
function setUser(role: "DOCTOR" | "STAFF" | "ADMIN", language_preference: "EN" | "AR" = "EN") {
  useAuthStore.setState({ user: { id: role === "DOCTOR" ? 7 : 8, full_name: "Workspace User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } });
}
function openBilling() { fireEvent.click(screen.getByRole("tab", { name: "Billing" })); }
function fillBilling(amount = "250.00") {
  fireEvent.change(screen.getByLabelText("Treatment / invoice description"), { target: { value: "Restorative dental treatment" } });
  fireEvent.change(screen.getByLabelText("Total treatment charge"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "SYP" } });
  fireEvent.change(screen.getByLabelText("Billing note"), { target: { value: "Collect at reception" } });
}

describe("VisitWorkspace", () => {
  beforeEach(() => {
    setUser("DOCTOR");
    mutationState.completePending = false;
    mutationState.update.mockReset();
    mutationState.update.mockResolvedValue(visit);
    mutationState.complete.mockReset();
    mutationState.complete.mockResolvedValue({ visit: { ...visit, status: "COMPLETED", completed_at: "2026-07-26T10:00:00Z" }, billing_handoff: { id: 5, status: "PENDING", suggested_amount: "250.00", currency: "SYP" } });
  });

  it("uses one accessible three-tab workspace with the action bar after the active panel", () => {
    const { container } = renderWorkspace();
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Visit Notes", "X-rays & AI", "Billing"]);
    const notesPanel = container.querySelector(".visit-tab-panel");
    const actionBar = container.querySelector(".active-visit-action-bar");
    expect(notesPanel).toBeInTheDocument();
    expect(actionBar).toBeInTheDocument();
    expect(notesPanel!.compareDocumentPosition(actionBar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "X-rays & AI" }));
    const xrayPanel = container.querySelector(".visit-tab-panel");
    expect(xrayPanel).toBeInTheDocument();
    expect(xrayPanel!.compareDocumentPosition(actionBar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps note and billing drafts across tabs and includes both in unsaved state", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Objective Notes"), { target: { value: "Unsaved tab-safe note" } });
    openBilling();
    fillBilling();
    fireEvent.click(screen.getByRole("tab", { name: "Visit Notes" }));
    expect(screen.getByLabelText("Objective Notes")).toHaveValue("Unsaved tab-safe note");
    openBilling();
    expect(screen.getByLabelText("Treatment / invoice description")).toHaveValue("Restorative dental treatment");
    expect(screen.getByLabelText("Total treatment charge")).toHaveValue("250.00");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("blocks missing or invalid billing, switches to Billing, and focuses the first invalid field", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Complete Visit" }));
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByLabelText("Treatment / invoice description")).toHaveFocus());
    expect(screen.getByText("Complete the billing details before completing the visit.")).toBeInTheDocument();
    expect(mutationState.complete).not.toHaveBeenCalled();
    fillBilling("0");
    fireEvent.click(screen.getByRole("button", { name: "Complete Visit" }));
    expect(screen.getByText("Enter a valid positive treatment charge.")).toBeInTheDocument();
    expect(mutationState.complete).not.toHaveBeenCalled();
  });

  it("summarizes billing and completes notes plus handoff through one coordinated mutation", async () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Objective Notes"), { target: { value: "Atomic note" } });
    openBilling();
    fillBilling();
    fireEvent.click(screen.getByRole("button", { name: "Complete Visit" }));
    expect(screen.getByRole("dialog", { name: "Complete this visit?" })).toBeInTheDocument();
    expect(screen.getByText("The visit will be completed and the billing handoff will be sent to Staff.")).toBeInTheDocument();
    expect(screen.getByText("Restorative dental treatment")).toBeInTheDocument();
    expect(screen.getByText("250.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete Visit and Send to Billing" }));
    await waitFor(() => expect(mutationState.complete).toHaveBeenCalledTimes(1));
    expect(mutationState.complete).toHaveBeenCalledWith({ version: visit.updated_at, notes: expect.objectContaining({ clinical_notes: "Atomic note" }), billing_handoff: { description: "Restorative dental treatment", suggested_amount: "250.00", currency: "SYP", note: "Collect at reception" } });
    expect(mutationState.update).not.toHaveBeenCalled();
    expect(await screen.findByText("Visit completed and sent to Staff Billing.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /payment/i })).not.toBeInTheDocument();
  });

  it("disables completion while its coordinated mutation is pending", () => {
    mutationState.completePending = true;
    renderWorkspace();
    expect(screen.getByRole("button", { name: "Complete Visit" })).toBeDisabled();
  });

  it("protects clinical editing, completion, and payments for Staff", () => {
    setUser("STAFF");
    renderWorkspace("STAFF");
    expect(screen.getByText("Clinical notes are read-only for your role and this visit.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Visit" })).not.toBeInTheDocument();
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument();
  });

  it("exports an inline dependency-free Pearlix tooth mark", () => {
    const { container } = render(<PearlixToothMark aria-label="Pearlix" />);
    expect(container.querySelector("[data-brand-mark='pearlix-tooth']")).toBeInTheDocument();
    expect(container.querySelector("image, use[href^='http']")).not.toBeInTheDocument();
  });
});
