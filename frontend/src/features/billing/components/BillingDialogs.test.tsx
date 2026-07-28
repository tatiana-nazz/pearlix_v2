import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateHandoffDialog, PaymentDialog } from "./BillingDialogs";

describe("Billing production dialogs", () => {
  it("omits a currency payload when a handoff has no suggested amount", () => {
    const submit = vi.fn(); const cancel = vi.fn(); render(<CreateHandoffDialog pending={false} onCancel={cancel} onSubmit={submit} />);
    expect(screen.getByRole("combobox", { name: "Currency" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form")!);
    expect(submit).toHaveBeenCalledWith({});
  });
  it("rejects overpayment and locks pending payment close paths", () => {
    const cancel = vi.fn(); render(<PaymentDialog currency="SYP" remaining="10.00" pending onCancel={cancel} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" }); fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
  });
  it("uses the shared V2 field contract and keeps the invoice currency read-only", () => {
    render(<PaymentDialog currency="SYP" remaining="10.00" pending={false} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Amount" }).closest("label")).toHaveClass("v2-field");
    expect(screen.getByRole("textbox", { name: "Currency" })).toHaveAttribute("readonly");
  });
});
