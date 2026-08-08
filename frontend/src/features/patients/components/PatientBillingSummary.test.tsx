import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { BillingHandoff, HandoffFinancialSummary, Invoice } from "../../../types/billing";
import { PatientBillingSummary } from "./PatientBillingSummary";

const patient = { id: 44, full_name: "Maya Patient", phone_number: "0911000000" };
const handoff = { id: 7, patient, description: "Preventive dental care", total_amount: "90.00", paid_amount: "25.00", remaining_amount: "65.00", invoice_count: 1, currency: "USD", status: "PARTIALLY_PAID", created_at: "2026-08-08T09:00:00Z" } as unknown as BillingHandoff;
const invoice = { id: 71, invoice_number: "INV-20260808-000071", billing_handoff_id: 7, patient, description: handoff.description, amount: "25.00", currency: "USD", issued_at: "2026-08-08T10:00:00Z", notes: "Deposit", created_by: null, created_at: "2026-08-08T10:00:00Z", updated_at: "2026-08-08T10:00:00Z" } as Invoice;
const summary: HandoffFinancialSummary = { clinic_date: "2026-08-08", clinic_timezone: "Asia/Damascus", status_counts: { OPEN: 0, PARTIALLY_PAID: 1, PAID: 0, CANCELLED: 0 }, open_count: 0, partially_paid_count: 1, paid_count: 0, cancelled_count: 0, currency_totals: { SYP: { bill_total: "0.00", paid: "0.00", outstanding: "0.00" }, USD: { bill_total: "90.00", paid: "25.00", outstanding: "65.00" } } };

vi.mock("../../billing/hooks/useBilling", () => ({
  useHandoffSummary: () => ({ data: summary, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useHandoffs: () => ({ data: { count: 1, next: null, previous: null, results: [handoff] }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useInvoices: () => ({ data: { count: 1, next: null, previous: null, results: [invoice] }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

describe("PatientBillingSummary", () => {
  it("does not expose financial records for Doctor", () => { render(<MemoryRouter><PatientBillingSummary role="DOCTOR" /></MemoryRouter>); expect(screen.getByText(/Financial records are not available/i)).toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument(); });
  it("keeps Staff patient billing as read-only financial history", () => { render(<MemoryRouter><PatientBillingSummary role="STAFF" patientId={44} /></MemoryRouter>); expect(screen.queryByRole("link", { name: /New bill/i })).not.toBeInTheDocument(); expect(screen.getByText("Preventive dental care")).toBeInTheDocument(); expect(screen.getByText("Outstanding USD").parentElement).toHaveTextContent(/USD\s*65\.00/); expect(screen.getByText("INV-20260808-000071")).toBeInTheDocument(); });
  it("keeps Admin patient billing read-only", () => { render(<MemoryRouter><PatientBillingSummary role="ADMIN" patientId={44} /></MemoryRouter>); expect(screen.queryByRole("link", { name: "New bill for patient" })).not.toBeInTheDocument(); expect(screen.getByRole("link", { name: "View all bills" })).toHaveAttribute("href", "/admin/billing/handoffs?patient_id=44"); });
});
