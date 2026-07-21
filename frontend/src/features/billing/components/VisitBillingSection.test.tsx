import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../auth/authStore";
import type { AuthUser } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
const state = vi.hoisted(() => ({ invoice: { data: null as { id: number; invoice_number: string; status: "UNPAID"; total_amount: string; paid_amount: string; remaining_amount: string; currency: "USD"; created_at: string; notes: string } | null, isLoading: false, isError: false, refetch: vi.fn() }, mutations: { createFinalChargeInvoice: { isPending: false, error: null, mutateAsync: vi.fn() } } }));
vi.mock("../hooks/useBilling", () => ({ useVisitInvoice: () => state.invoice, useBillingMutations: () => state.mutations }));
import { VisitBillingSection } from "./VisitBillingSection";
const doctor: AuthUser = { id: 2, email: "doctor@example.test", full_name: "Doctor", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null };
const visit: VisitDetail = { id: 8, doctor, status: "COMPLETED", appointment: { id: 1, start_datetime: "2026-01-01T09:00:00Z", end_datetime: "2026-01-01T09:30:00Z", duration_minutes: 30, status: "COMPLETED", reason: "Review" }, patient: { id: 1, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 30, phone_number: "1", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }, started_at: "2026-01-01T09:00:00Z", completed_at: "2026-01-01T09:30:00Z", symptoms: "", diagnosis: "", treatment: "", clinical_notes: "", follow_up_notes: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
function view(role: "ADMIN" | "STAFF" | "DOCTOR", detail = visit) { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><VisitBillingSection role={role} visit={detail} /></MemoryRouter></QueryClientProvider>); }
describe("VisitBillingSection production role boundary", () => {
  afterEach(() => { state.invoice.data = null; useAuthStore.setState({ user: null, role: null }); });
  it("shows the final-charge form only for an owning completed visit", () => { useAuthStore.setState({ user: doctor }); view("DOCTOR"); expect(screen.getByRole("button", { name: "Create invoice" })).toBeInTheDocument(); expect(screen.getByRole("textbox", { name: "Final charge" })).toBeInTheDocument(); });
  it("keeps active and non-owning Doctor visits read-only", () => { useAuthStore.setState({ user: doctor }); view("DOCTOR", { ...visit, status: "ACTIVE" }); expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument(); view("DOCTOR", { ...visit, doctor: { ...doctor, id: 3 } }); expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument(); });
  it("keeps Admin and Staff read-only", () => { useAuthStore.setState({ user: doctor }); view("ADMIN"); expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument(); view("STAFF"); expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument(); });
  it("replaces the form with an invoice summary", () => { state.invoice.data = { id: 9, invoice_number: "INV-9", status: "UNPAID", total_amount: "10.00", paid_amount: "0.00", remaining_amount: "10.00", currency: "USD", created_at: "2026-01-01T00:00:00Z", notes: "" }; useAuthStore.setState({ user: doctor }); view("DOCTOR"); expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument(); expect(screen.getByText("INV-9")).toBeInTheDocument(); });
});
