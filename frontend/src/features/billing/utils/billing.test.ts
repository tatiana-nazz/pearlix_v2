import { describe, expect, it } from "vitest";
import type { BillingHandoff } from "../../../types/billing";
import { canManageHandoff, formatMoney } from "./billing";

describe("billing utilities", () => {
  it("limits bill mutations to Staff and non-cancelled Handoffs", () => {
    expect(canManageHandoff("STAFF", { status: "OPEN" } as BillingHandoff)).toBe(true);
    expect(canManageHandoff("STAFF", { status: "PARTIALLY_PAID" } as BillingHandoff)).toBe(true);
    expect(canManageHandoff("STAFF", { status: "CANCELLED" } as BillingHandoff)).toBe(false);
    expect(canManageHandoff("ADMIN", { status: "OPEN" } as BillingHandoff)).toBe(false);
  });
  it("formats API decimal strings only for display", () => { expect(formatMoney("1250.00", "USD")).toContain("USD"); });
});
