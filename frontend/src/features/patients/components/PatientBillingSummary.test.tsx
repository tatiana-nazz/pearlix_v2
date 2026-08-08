import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Invoice, InvoiceFinancialSummary } from "../../../types/billing";

import { PatientBillingSummary } from "./PatientBillingSummary";

const navigate = vi.fn();
const invoice = {
  id: 71,
  invoice_number: "INV-20260808-000071",
  origin: "MANUAL",
  description: "Preventive dental care",
  patient: { id: 44, full_name: "Maya Patient" },
  total_amount: "90.00",
  paid_amount: "25.00",
  remaining_amount: "65.00",
  currency: "USD",
  status: "PARTIALLY_PAID",
  created_at: "2026-08-08T09:00:00Z",
} as Invoice;
const summary: InvoiceFinancialSummary = {
  clinic_date: "2026-08-08",
  clinic_timezone: "Asia/Damascus",
  invoice_count: 1,
  open_invoice_count: 1,
  status_counts: { UNPAID: 0, PARTIALLY_PAID: 1, PAID: 0, CANCELLED: 0 },
  currency_totals: { SYP: { invoiced: "0.00", paid: "0.00", outstanding: "0.00" }, USD: { invoiced: "90.00", paid: "25.00", outstanding: "65.00" } },
  payments_collected_in_period: { SYP: "0.00", USD: "25.00" },
};

vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => navigate }));
vi.mock("../../billing/hooks/useBilling", () => ({
  useInvoiceSummary: () => ({ data: summary, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useInvoices: () => ({ data: { count: 1, next: null, previous: null, results: [invoice] }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

describe("PatientBillingSummary", () => {
  beforeEach(() => navigate.mockClear());

  it("does not expose invoices or payments for Doctor", () => {
    render(
      <MemoryRouter>
        <PatientBillingSummary role="DOCTOR" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Invoices and payment records are not available/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows patient-scoped invoice totals and creation for Staff", () => {
    render(<MemoryRouter><PatientBillingSummary role="STAFF" patientId={44} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "New invoice for patient" })).toHaveAttribute("href", "/staff/billing/invoices/new?patient_id=44");
    expect(screen.getByText("Preventive dental care")).toBeInTheDocument();
    expect(screen.getByText("Outstanding USD").parentElement).toHaveTextContent(/USD\s*65\.00/);
  });

  it("keeps Admin patient billing read-only and opens the exact invoice", () => {
    render(<MemoryRouter><PatientBillingSummary role="ADMIN" patientId={44} /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "New invoice for patient" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("INV-20260808-000071"));
    expect(navigate).toHaveBeenCalledWith("/admin/billing/invoices/71");
  });
});
