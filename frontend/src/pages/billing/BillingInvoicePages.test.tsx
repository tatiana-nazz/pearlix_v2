import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Invoice } from "../../types/billing";

const invoice: Invoice = {
  id: 14, invoice_number: "INV-0014", patient: { id: 4, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 30, phone_number: "1", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }, appointment: null, visit: null, billing_handoff: null, created_by: null, currency: "SYP", total_amount: "50.00", paid_amount: "0.00", remaining_amount: "50.00", payment_count: 0, notes: "", status: "UNPAID", cancelled_at: null, cancelled_reason: "", payments: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z"
};

const state = vi.hoisted(() => ({ invoice: { data: null as Invoice | null, isLoading: false, isError: false, refetch: vi.fn() }, payments: { data: [] as Invoice["payments"] }, mutations: { updateInvoice: { isPending: false, error: null, mutateAsync: vi.fn().mockResolvedValue({}) }, recordPayment: { isPending: false, error: null, mutateAsync: vi.fn().mockResolvedValue({}) }, cancelInvoice: { isPending: false, error: null, mutateAsync: vi.fn().mockResolvedValue({}) } } }));
vi.mock("../../features/billing/hooks/useBilling", () => ({ useInvoice: () => state.invoice, useInvoicePayments: () => state.payments, useBillingMutations: () => state.mutations }));

import { InvoiceDetailPage } from "./BillingPages";

function view(role: "ADMIN" | "STAFF") { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/staff/billing/invoices/14"]}><Routes><Route path="/staff/billing/invoices/:invoiceId" element={<InvoiceDetailPage role={role} />} /></Routes></MemoryRouter></QueryClientProvider>); }

describe("Billing invoice detail production controls", () => {
  it("keeps the Admin detail read-only", () => { state.invoice.data = invoice; view("ADMIN"); expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Edit invoice" })).not.toBeInTheDocument(); });
  it("locks paid and cancelled invoice actions", () => { state.invoice.data = { ...invoice, status: "PAID", paid_amount: "50.00", remaining_amount: "0.00", payment_count: 1 }; view("STAFF"); expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument(); state.invoice.data = { ...invoice, status: "CANCELLED" }; view("STAFF"); expect(screen.queryByRole("button", { name: "Edit invoice" })).not.toBeInTheDocument(); });
  it("lets Staff open a payment dialog and validates the remaining balance", () => { state.invoice.data = invoice; view("STAFF"); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "60" } }); const paymentButtons = screen.getAllByRole("button", { name: "Record payment" }); fireEvent.submit(paymentButtons[paymentButtons.length - 1].closest("form")!); expect(screen.getByRole("alert")).toHaveTextContent("Payment cannot exceed the remaining balance."); });
  it("accepts the exact remaining payment in the invoice currency", () => { state.invoice.data = invoice; state.mutations.recordPayment.mutateAsync.mockClear(); view("STAFF"); fireEvent.click(screen.getByRole("button", { name: "Record payment" })); fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "50.00" } }); const paymentButtons = screen.getAllByRole("button", { name: "Record payment" }); fireEvent.submit(paymentButtons[paymentButtons.length - 1].closest("form")!); expect(state.mutations.recordPayment.mutateAsync).toHaveBeenCalledWith({ invoiceId: 14, payload: { amount: "50.00", currency: "SYP" } }); });
  it("lets Staff edit unlocked invoice fields without exposing relationship fields", () => { state.invoice.data = invoice; view("STAFF"); fireEvent.click(screen.getByRole("button", { name: "Edit invoice" })); expect(screen.getByRole("textbox", { name: "Total amount" })).toHaveValue("50.00"); expect(screen.queryByLabelText(/patient id|visit id|appointment id/i)).not.toBeInTheDocument(); });
});
