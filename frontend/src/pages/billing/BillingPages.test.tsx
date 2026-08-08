import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRole } from "../../types/auth";
import type { BillingHandoff } from "../../types/billing";
import { BillingHandoffDetailPage } from "./BillingPages";

const handoff = {
  id: 41,
  patient: { id: 9, full_name: "Visit Patient", phone_number: "0911000000" },
  visit: {
    id: 18,
    status: "COMPLETED",
    started_at: "2026-08-08T08:00:00Z",
    completed_at: "2026-08-08T08:30:00Z",
    appointment: { id: 12, status: "COMPLETED" },
  },
  doctor: { id: 3, full_name: "Dr. Visit Owner" },
  description: "Visit-generated treatment",
  total_amount: "100.00",
  paid_amount: "25.00",
  remaining_amount: "75.00",
  invoice_count: 1,
  currency: "USD",
  note: "Visit completion bill",
  status: "PARTIALLY_PAID",
  origin: "VISIT_COMPLETION",
  legacy_reference: "",
  cancelled_at: null,
  cancelled_reason: "",
  invoices: [],
  created_by: { id: 3, full_name: "Dr. Visit Owner" },
  updated_by: { id: 3, full_name: "Dr. Visit Owner" },
  created_at: "2026-08-08T08:30:00Z",
  updated_at: "2026-08-08T09:00:00Z",
} as unknown as BillingHandoff;

const issueInvoice = {
  isPending: false,
  error: null,
  reset: vi.fn(),
  mutateAsync: vi.fn(),
};

vi.mock("../../features/billing/hooks/useBilling", () => ({
  useBillingMutations: () => ({ issueInvoice }),
  useHandoff: () => ({ data: handoff, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useHandoffSummary: vi.fn(),
  useHandoffs: vi.fn(),
  useInvoice: vi.fn(),
  useInvoicePrintData: vi.fn(),
}));

function renderDetail(role: UserRole) {
  const base = role.toLowerCase();
  return render(
    <MemoryRouter initialEntries={[`/${base}/billing/handoffs/${handoff.id}`]}>
      <Routes>
        <Route path={`/${base}/billing/handoffs/:handoffId`} element={<BillingHandoffDetailPage role={role} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("immutable Handoff detail authority", () => {
  beforeEach(() => {
    issueInvoice.reset.mockReset();
    issueInvoice.mutateAsync.mockReset().mockResolvedValue({
      invoice: { invoice_number: "INV-20260808-000101" },
      handoff,
    });
  });

  it("lets Staff record a payment but never edit or cancel the bill", async () => {
    renderDetail("STAFF");
    expect(screen.queryByRole("button", { name: /Edit bill/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel bill/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.queryByLabelText(/patient/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /currency/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Payment amount" }), { target: { value: "20.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment & issue invoice" }));
    await waitFor(() => expect(issueInvoice.mutateAsync).toHaveBeenCalledWith({
      handoffId: handoff.id,
      payload: { amount: "20.00", issued_at: undefined, notes: "" },
    }));
  });

  it.each(["ADMIN", "DOCTOR"] as const)("keeps %s Handoff detail read-only", (role) => {
    renderDetail(role);
    expect(screen.queryByRole("button", { name: /Record payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit bill/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel bill/i })).not.toBeInTheDocument();
  });
});
