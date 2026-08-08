import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { BillingHandoff, Invoice } from "../../../types/billing";
import { HandoffList, InvoiceList } from "./BillingLists";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => navigate }));

const handoff = {
  id: 1, patient: { full_name: "Maya Patient" }, doctor: { full_name: "Dr. Lin" }, visit: { appointment: { reason: "Cleaning" } }, note: "Please invoice", suggested_amount: "75.00", currency: "USD", status: "PENDING", created_at: "2026-07-26T09:00:00Z",
} as BillingHandoff;
const invoice = {
  id: 2, invoice_number: "INV-20260726-000001", patient: { full_name: "Maya Patient" }, visit: { appointment: { reason: "Cleaning" } }, total_amount: "75.00", paid_amount: "25.00", remaining_amount: "50.00", currency: "USD", status: "PARTIALLY_PAID", created_at: "2026-07-26T09:00:00Z",
} as Invoice;

describe("Billing collections", () => {
  it("keeps handoff records action-free and opens the whole row by click and keyboard", () => {
    render(<MemoryRouter><HandoffList role="STAFF" handoffs={[handoff]} /></MemoryRouter>);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Visit #/)).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /open billing handoff for maya patient/i });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(navigate).toHaveBeenCalledWith("/staff/billing/handoffs/1");
    expect(navigate).toHaveBeenCalledTimes(3);
  });

  it.each(["STAFF", "ADMIN"] as const)("keeps %s invoice rows action-free and opens them", (role) => {
    navigate.mockClear();
    render(<MemoryRouter><InvoiceList role={role} invoices={[invoice]} /></MemoryRouter>);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /invoice inv-20260726-000001/i });
    fireEvent.keyDown(row, { key: " " });
    expect(navigate).toHaveBeenCalledWith(`/${role.toLowerCase()}/billing/invoices/2`);
  });
});
