import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BillingHandoff } from "../../../types/billing";
import { RecordPaymentDialog } from "./BillingDialogs";

const handoff = {
  id: 8,
  patient: { id: 2, full_name: "Maya Patient" },
  description: "Restorative treatment",
  total_amount: "100.00",
  paid_amount: "25.00",
  remaining_amount: "75.00",
  currency: "USD",
} as unknown as BillingHandoff;

describe("RecordPaymentDialog", () => {
  it("inherits bill context, rejects overpayment, and issues an amount-only receipt", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentDialog handoff={handoff} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    expect(screen.getByText("Restorative treatment")).toBeInTheDocument();
    expect(screen.queryByLabelText(/patient/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Payment amount" }), { target: { value: "80.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment & issue invoice" }));
    expect(screen.getByRole("alert")).toHaveTextContent("no greater than the remaining balance");
    fireEvent.change(screen.getByRole("textbox", { name: "Payment amount" }), { target: { value: "30.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment & issue invoice" }));
    expect(onSubmit).toHaveBeenCalledWith({ amount: "30.00", issued_at: undefined, notes: "" });
  });

  it("fills the exact remaining balance without submitting", () => {
    const onSubmit = vi.fn();
    render(<RecordPaymentDialog handoff={handoff} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay remaining balance" }));
    expect(screen.getByRole("textbox", { name: "Payment amount" })).toHaveValue("75.00");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
