import { describe, expect, it } from "vitest";
import type { BillingHandoff } from "../../../types/billing";
import { canRecordPayment, formatMoney } from "./billing";

describe("billing utilities", () => {
  it("limits bill mutations to Staff and non-cancelled Handoffs", () => {
    expect(canRecordPayment("STAFF", { status: "OPEN", remaining_amount: "100.00" } as BillingHandoff)).toBe(true);
    expect(canRecordPayment("STAFF", { status: "PARTIALLY_PAID", remaining_amount: "25.00" } as BillingHandoff)).toBe(true);
    expect(canRecordPayment("STAFF", { status: "PAID", remaining_amount: "0.00" } as BillingHandoff)).toBe(false);
    expect(canRecordPayment("STAFF", { status: "CANCELLED", remaining_amount: "100.00" } as BillingHandoff)).toBe(false);
    expect(canRecordPayment("ADMIN", { status: "OPEN", remaining_amount: "100.00" } as BillingHandoff)).toBe(false);
  });
  it("formats API decimal strings only for display", () => { expect(formatMoney("1250.00", "USD")).toContain("USD"); });
});
