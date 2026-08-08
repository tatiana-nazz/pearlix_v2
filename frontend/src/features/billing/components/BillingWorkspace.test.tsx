import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { billingApi } from "../../../api/endpoints/billing";
import { useAuthStore } from "../../../auth/authStore";
import type { BillingHandoff, HandoffFinancialSummary, Invoice, InvoiceFinancialSummary } from "../../../types/billing";
import { BillingOverviewPage, InvoiceHistoryPage } from "./BillingWorkspace";

const patient = { id: 4, full_name: "Maya Hassan", phone_number: "0911000000" };
const handoff = { id: 3, patient, visit: null, doctor: null, description: "Comprehensive dental treatment", total_amount: "300.00", paid_amount: "125.00", remaining_amount: "175.00", invoice_count: 2, currency: "USD", note: "", status: "PARTIALLY_PAID", origin: "MANUAL", legacy_reference: "", cancelled_at: null, cancelled_reason: "", invoices: [], created_by: null, updated_by: null, created_at: "2026-07-15T09:00:00Z", updated_at: "2026-07-15T09:00:00Z" } as unknown as BillingHandoff;
const invoice = { id: 9, invoice_number: "INV-20260715-000009", billing_handoff_id: 3, patient, description: handoff.description, amount: "25.00", currency: "USD", issued_at: "2026-07-15T10:00:00Z", notes: "Deposit", created_by: null, created_at: "2026-07-15T10:00:00Z", updated_at: "2026-07-15T10:00:00Z" } as Invoice;
const handoffSummary: HandoffFinancialSummary = { clinic_date: "2026-07-15", clinic_timezone: "Asia/Damascus", status_counts: { OPEN: 2, PARTIALLY_PAID: 1, PAID: 2, CANCELLED: 1 }, open_count: 2, partially_paid_count: 1, paid_count: 2, cancelled_count: 1, currency_totals: { SYP: { bill_total: "500000.00", paid: "200000.00", outstanding: "300000.00" }, USD: { bill_total: "300.00", paid: "125.00", outstanding: "175.00" } } };
const invoiceSummary: InvoiceFinancialSummary = { clinic_date: "2026-07-15", clinic_timezone: "Asia/Damascus", invoice_count: 6, collected_by_currency: { SYP: "50000.00", USD: "25.00" } };
const handoffPage = { count: 1, next: null, previous: null, results: [handoff] };
const invoicePage = { count: 1, next: null, previous: null, results: [invoice] };

function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderBilling(node: React.ReactNode, initial = "/staff/billing/overview") { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initial]}>{node}<LocationProbe /></MemoryRouter></QueryClientProvider>); }
function setUser(role: "ADMIN" | "STAFF") { useAuthStore.setState({ user: { id: 1, full_name: "Billing User", email: "billing@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } }); }

describe("billing overview and invoice history", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(billingApi, "handoffSummary").mockResolvedValue(handoffSummary); vi.spyOn(billingApi, "invoiceSummary").mockResolvedValue(invoiceSummary); vi.spyOn(billingApi, "handoffs").mockResolvedValue(handoffPage); vi.spyOn(billingApi, "invoices").mockResolvedValue(invoicePage); });
  afterEach(() => useAuthStore.getState().clearAuth());

  it("makes Handoffs first-class and keeps invoices as receipts", async () => {
    setUser("STAFF"); renderBilling(<BillingOverviewPage role="STAFF" />);
    expect(await screen.findByRole("link", { name: /Open bills/ })).toHaveAttribute("href", "/staff/billing/handoffs?status=OPEN");
    expect(screen.getByRole("link", { name: /Partially paid bills/ })).toHaveAttribute("href", "/staff/billing/handoffs?status=PARTIALLY_PAID");
    expect(screen.queryByRole("link", { name: /New bill/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Handoffs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.queryByText(/approval/i)).not.toBeInTheDocument();
  });

  it("keeps Admin billing read-only", async () => {
    setUser("ADMIN"); renderBilling(<BillingOverviewPage role="ADMIN" />, "/admin/billing/overview");
    expect(await screen.findByRole("heading", { name: "Billing overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New bill/i })).not.toBeInTheDocument();
  });

  it("filters immutable invoice receipts by clinic date, search, and currency", async () => {
    setUser("STAFF"); renderBilling(<InvoiceHistoryPage role="STAFF" />, "/staff/billing/invoices?page=2");
    expect(await screen.findByText("INV-20260715-000009")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "Maya" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Currency" }), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-01" } });
    await waitFor(() => { const location = screen.getByTestId("location").textContent ?? ""; expect(location).toContain("search=Maya"); expect(location).toContain("currency=USD"); expect(location).toContain("date_from=2026-07-01"); expect(location).not.toContain("page="); });
  });
});
