import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateHandoffDialog, PaymentDialog } from "./BillingDialogs";

describe("Billing production dialogs", () => {
  it("omits currency when a handoff has no suggested amount and blocks pending close", () => {
    const submit = vi.fn(); const cancel = vi.fn(); render(<CreateHandoffDialog pending={false} onCancel={cancel} onSubmit={submit} />);
    fireEvent.submit(screen.getByRole("button", { name: "Create handoff" }).closest("form")!);
    expect(submit).toHaveBeenCalledWith({});
  });
  it("rejects overpayment and locks pending payment close paths", () => {
    const cancel = vi.fn(); render(<PaymentDialog currency="SYP" remaining="10.00" pending onCancel={cancel} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" }); fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
  });
});
