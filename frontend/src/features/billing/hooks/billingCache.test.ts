import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateBillingQueries } from "./billingCache";

describe("invalidateBillingQueries", () => {
  it("awaits the complete cross-workspace invalidation set", async () => {
    const calls: unknown[][] = [];
    const invalidateQueries = vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
      calls.push(queryKey);
      return Promise.resolve();
    });

    await invalidateBillingQueries({ invalidateQueries } as unknown as QueryClient, {
      invoiceId: 9,
      handoffId: 10,
      patientId: 11,
      visitId: 12,
      appointmentId: 13,
    });

    expect(calls).toEqual(expect.arrayContaining([
      ["billing-handoffs"], ["invoices"], ["invoice-summary"], ["dashboard"],
      ["invoice", 9], ["invoice-payments", 9], ["invoice-print-data", 9],
      ["billing-handoff", 10], ["patient", 11], ["patient", 11, "billing"],
      ["visit", 12], ["appointments", 13], ["active-visit"], ["appointments"],
    ]));
    expect(invalidateQueries).toHaveBeenCalledTimes(14);
  });
});
