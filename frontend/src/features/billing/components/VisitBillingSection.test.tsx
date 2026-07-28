import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AuthUser } from "../../../types/auth";
import type { BillingHandoff } from "../../../types/billing";
import type { VisitDetail } from "../../../types/visits";
import type { VisitBillingDraft } from "./VisitBillingSection";

const state = vi.hoisted(() => ({
  handoffs: { data: { results: [] as BillingHandoff[] }, isLoading: false, error: null as unknown, refetch: vi.fn() },
}));
vi.mock("../hooks/useBilling", () => ({ useHandoffs: () => state.handoffs }));
vi.mock("../../../api/endpoints/clinic", () => ({ clinicApi: { getSettings: vi.fn().mockResolvedValue({ default_currency: "USD" }) } }));

import { VisitBillingSection } from "./VisitBillingSection";

const doctor: AuthUser = { id: 2, email: "doctor@example.test", full_name: "Doctor", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null };
const visit: VisitDetail = { id: 8, doctor, status: "ACTIVE", appointment: { id: 1, start_datetime: "2026-01-01T09:00:00Z", end_datetime: "2026-01-01T09:30:00Z", duration_minutes: 30, status: "ACTIVE", reason: "Review" }, patient: { id: 1, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 30, phone_number: "1", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }, started_at: "2026-01-01T09:00:00Z", completed_at: null, symptoms: "", diagnosis: "", treatment: "", clinical_notes: "", follow_up_notes: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const draft: VisitBillingDraft = { description: "Restoration", amount: "25.00", currency: "USD", note: "Front desk follow-up" };

function view(role: "ADMIN" | "STAFF" | "DOCTOR", detail = visit, onDraftChange = vi.fn()) {
  return { onDraftChange, ...render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><VisitBillingSection role={role} visit={detail} draft={draft} errors={{}} onDraftChange={onDraftChange} /></MemoryRouter></QueryClientProvider>) };
}

describe("VisitBillingSection completion handoff boundary", () => {
  afterEach(() => { state.handoffs.data = { results: [] }; useAuthStore.setState({ user: null, role: null }); });

  it("lets only the owning doctor edit the active-visit handoff draft", () => {
    useAuthStore.setState({ user: doctor });
    const { onDraftChange } = view("DOCTOR");
    expect(screen.getByRole("textbox", { name: /Treatment \/ invoice description/ })).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /invoice/i })).not.toBeInTheDocument();
  });

  it("keeps completed, non-owning, Staff, and Admin views read-only", () => {
    useAuthStore.setState({ user: doctor });
    const completed = view("DOCTOR", { ...visit, status: "COMPLETED" });
    expect(screen.getByRole("textbox", { name: /Treatment \/ invoice description/ })).toHaveAttribute("readonly");
    completed.unmount();
    view("STAFF");
    expect(screen.getByRole("textbox", { name: /Treatment \/ invoice description/ })).toHaveAttribute("readonly");
  });

  it("renders the authoritative pending handoff instead of an edit form", () => {
    state.handoffs.data = { results: [{ id: 5, patient: visit.patient, visit: { id: visit.id, status: "COMPLETED", started_at: visit.started_at, completed_at: "2026-01-01T09:30:00Z", appointment: { ...visit.appointment, doctor, status: "COMPLETED" } }, doctor, description: "Restoration", suggested_amount: "25.00", currency: "USD", note: "Front desk follow-up", status: "PENDING", converted_invoice: null, dismissed_reason: "", created_by: doctor, updated_by: doctor, created_at: "2026-01-01T09:30:00Z", updated_at: "2026-01-01T09:30:00Z" }] };
    useAuthStore.setState({ user: doctor });
    view("DOCTOR", { ...visit, status: "COMPLETED" });
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    expect(screen.getByText("Restoration")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Treatment \/ invoice description/ })).not.toBeInTheDocument();
  });
});
