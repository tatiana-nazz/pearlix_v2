import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { billingApi } from "../../../api/endpoints/billing";
import { useAuthStore } from "../../../auth/authStore";
import type { Invoice, InvoiceFinancialSummary } from "../../../types/billing";
import { BillingOverviewPage, InvoiceHistoryPage } from "./BillingWorkspace";

const invoice = {
  id: 9,
  invoice_number: "INV-20260715-000009",
  origin: "MANUAL",
  description: "Comprehensive dental treatment",
  patient: { id: 4, full_name: "Maya Hassan" },
  total_amount: "100.00",
  paid_amount: "25.00",
  remaining_amount: "75.00",
  currency: "USD",
  status: "PARTIALLY_PAID",
  created_at: "2026-07-15T09:00:00Z",
} as Invoice;

const summary: InvoiceFinancialSummary = {
  clinic_date: "2026-07-15",
  clinic_timezone: "Asia/Damascus",
  invoice_count: 6,
  open_invoice_count: 3,
  status_counts: { UNPAID: 2, PARTIALLY_PAID: 1, PAID: 2, CANCELLED: 1 },
  currency_totals: {
    SYP: { invoiced: "500000.00", paid: "200000.00", outstanding: "300000.00" },
    USD: { invoiced: "300.00", paid: "125.00", outstanding: "175.00" },
  },
  payments_collected_in_period: { SYP: "50000.00", USD: "25.00" },
};

const page = { count: 1, next: null, previous: null, results: [invoice] };
const handoffs = { count: 2, next: null, previous: null, results: [] };

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderBilling(node: React.ReactNode, initial = "/staff/billing/overview") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initial]}>{node}<LocationProbe /></MemoryRouter></QueryClientProvider>);
}

function setUser(role: "ADMIN" | "STAFF", language_preference: "EN" | "AR" = "EN") {
  useAuthStore.setState({ user: { id: 1, full_name: "Billing User", email: "billing@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } });
}

describe("billing overview and invoice history", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(billingApi, "invoiceSummary").mockResolvedValue(summary);
    vi.spyOn(billingApi, "invoices").mockResolvedValue(page);
    vi.spyOn(billingApi, "handoffs").mockResolvedValue(handoffs);
  });

  afterEach(() => useAuthStore.getState().clearAuth());

  it("shows Staff overview KPIs, separate currencies, exact invoice rows, and operational creation", async () => {
    setUser("STAFF");
    renderBilling(<BillingOverviewPage role="STAFF" />);
    expect(await screen.findByRole("link", { name: /Invoices today/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Invoices today/ })).toHaveAttribute("href", "/staff/billing/invoices?date_from=2026-07-15&date_to=2026-07-15");
    expect(screen.queryByText(/Pending handoffs/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open invoices/ })).toHaveAttribute("href", "/staff/billing/invoices");
    expect(screen.getByRole("link", { name: "New invoice" })).toHaveAttribute("href", "/staff/billing/invoices/new");
    expect(screen.getAllByText(/SYP/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("INV-20260715-000009")).toHaveLength(1);
    expect(screen.getByText("Comprehensive dental treatment")).toBeInTheDocument();
    expect(screen.getByText(/Unpaid: 2/)).toBeInTheDocument();
  });

  it("keeps the Admin overview read-only", async () => {
    setUser("ADMIN");
    renderBilling(<BillingOverviewPage role="ADMIN" />, "/admin/billing/overview");
    expect(await screen.findByRole("heading", { name: "Billing overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New invoice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /payment|cancel|convert|dismiss/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Handoffs/i })).not.toBeInTheDocument();
  });

  it("loads all-time history from the summary endpoint rather than page rows", async () => {
    setUser("STAFF");
    renderBilling(<InvoiceHistoryPage role="STAFF" />, "/staff/billing/invoices");
    expect(await screen.findByText("INV-20260715-000009")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll(".billing-history-summary .billing-summary-card")).toHaveLength(4);
    expect(document.querySelector(".billing-history-summary")?.textContent).toContain("6");
    expect(document.querySelector(".billing-history-summary")?.textContent).toContain("3");
    expect(billingApi.invoiceSummary).toHaveBeenCalledWith({});
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Related visit" })).not.toBeInTheDocument();
  });

  it("applies Today from backend clinic date and resets pagination", async () => {
    setUser("STAFF");
    renderBilling(<InvoiceHistoryPage role="STAFF" />, "/staff/billing/invoices?page=3");
    const today = await screen.findByRole("button", { name: "Today" });
    await waitFor(() => expect(today).not.toBeDisabled());
    fireEvent.click(today);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/staff/billing/invoices?date_from=2026-07-15&date_to=2026-07-15"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(billingApi.invoices).toHaveBeenCalledWith({ date_from: "2026-07-15", date_to: "2026-07-15" }));
  });

  it("combines search, status, currency, and custom dates in the URL", async () => {
    setUser("STAFF");
    renderBilling(<InvoiceHistoryPage role="STAFF" />, "/staff/billing/invoices?page=2");
    await screen.findByRole("heading", { name: "Invoice history" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "Maya" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "UNPAID" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Currency" }), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-07-10" } });
    await waitFor(() => {
      const location = screen.getByTestId("location").textContent ?? "";
      expect(location).toContain("search=Maya");
      expect(location).toContain("status=UNPAID");
      expect(location).toContain("currency=USD");
      expect(location).toContain("date_from=2026-07-01");
      expect(location).toContain("date_to=2026-07-10");
      expect(location).not.toContain("page=");
    });
    expect(screen.getByText("Custom")).toHaveClass("active");
  });

  it("localizes new billing UI in Arabic while keeping identifiers and money isolated", async () => {
    setUser("ADMIN", "AR");
    renderBilling(<InvoiceHistoryPage role="ADMIN" />, "/admin/billing/invoices");
    expect(await screen.findByText("INV-20260715-000009")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "سجل الفواتير" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "نظرة عامة" })).toHaveAttribute("href", "/admin/billing/overview");
    expect(screen.getByRole("columnheader", { name: "الفاتورة" })).toBeInTheDocument();
    expect(screen.getByText("INV-20260715-000009").closest("td")).toHaveClass("bidi-ltr");
    expect(screen.getByLabelText("Status: مدفوعة جزئياً")).toBeInTheDocument();
  });
});
