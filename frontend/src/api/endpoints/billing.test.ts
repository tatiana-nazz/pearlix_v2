import { describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn()); const patch = vi.hoisted(() => vi.fn()); const remove = vi.hoisted(() => vi.fn());
vi.mock("../http", () => ({ api: { post, patch, delete: remove } }));
import { billingApi } from "./billing";

describe("Billing mutation endpoint contracts", () => {
  it("uses POST-only handoff dismissal and invoice cancellation; never DELETE or direct status mutation", () => {
    void billingApi.dismissHandoff(7, "Duplicate"); void billingApi.cancelInvoice(8, "Patient request"); void billingApi.convertHandoff(7, { total_amount: "10.00", currency: "SYP" });
    expect(post).toHaveBeenNthCalledWith(1, "/billing-handoffs/7/dismiss/", { dismissed_reason: "Duplicate" });
    expect(post).toHaveBeenNthCalledWith(2, "/invoices/8/cancel/", { cancelled_reason: "Patient request" });
    expect(post).toHaveBeenNthCalledWith(3, "/billing-handoffs/7/convert-to-invoice/", { total_amount: "10.00", currency: "SYP" });
    expect(patch).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });
});
