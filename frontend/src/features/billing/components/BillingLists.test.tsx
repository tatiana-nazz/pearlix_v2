import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { BillingHandoff, Invoice } from "../../../types/billing";
import { HandoffList, InvoiceList } from "./BillingLists";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => navigate }));

const handoff = { id: 1, patient: { id: 44, full_name: "Maya Patient" }, doctor: { full_name: "Dr. Lin" }, description: "Cleaning", total_amount: "75.00", paid_amount: "25.00", remaining_amount: "50.00", invoice_count: 1, currency: "USD", status: "PARTIALLY_PAID", created_at: "2026-07-26T09:00:00Z" } as unknown as BillingHandoff;
const invoice = { id: 2, invoice_number: "INV-20260726-000001", billing_handoff_id: 1, description: "Cleaning", patient: { id: 44, full_name: "Maya Patient" }, amount: "25.00", currency: "USD", issued_at: "2026-07-26T09:00:00Z", notes: "Deposit", created_by: { full_name: "Staff User" }, created_at: "2026-07-26T09:00:00Z", updated_at: "2026-07-26T09:00:00Z" } as unknown as Invoice;

describe("Billing collections", () => {
  it("shows Handoffs as financial obligations with row navigation", () => {
    render(<MemoryRouter><HandoffList role="STAFF" handoffs={[handoff]} /></MemoryRouter>);
    const row = screen.getByRole("row", { name: /open bill 1 for maya patient/i });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith("/staff/billing/handoffs/1");
    expect(screen.getByText("Partially paid")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Remaining" })).toBeInTheDocument();
  });

  it("shows Invoices as payment receipts linked to one Handoff", () => {
    navigate.mockClear();
    render(<MemoryRouter><InvoiceList role="STAFF" invoices={[invoice]} /></MemoryRouter>);
    const row = screen.getByRole("row", { name: /invoice inv-20260726-000001/i });
    fireEvent.click(row);
    expect(navigate).toHaveBeenCalledWith("/staff/billing/invoices/2");
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Staff User")).toBeInTheDocument();
  });
});
