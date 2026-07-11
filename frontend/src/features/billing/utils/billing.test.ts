import { describe, expect, it } from "vitest";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import { canManageHandoff, canManageInvoice, formatMoney } from "./billing";

describe("billing permissions", () => {
  it("keeps Staff mutations scoped to eligible records", () => {
    expect(canManageHandoff("STAFF", { status: "PENDING" } as BillingHandoff)).toBe(true);
    expect(canManageHandoff("ADMIN", { status: "PENDING" } as BillingHandoff)).toBe(false);
    expect(canManageInvoice("STAFF", { status: "UNPAID" } as Invoice)).toBe(true);
    expect(canManageInvoice("STAFF", { status: "PAID" } as Invoice)).toBe(false);
  });

  it("formats API decimal strings only for display", () => {
    expect(formatMoney("1250.00", "USD")).toContain("USD");
  });
});
