import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { billingApi } from "../../../api/endpoints/billing";
import { useBillingMutations } from "./useBilling";

vi.mock("../../../api/endpoints/billing", () => ({ billingApi: { recordPayment: vi.fn() } }));

function PaymentMutationProbe() {
  const mutations = useBillingMutations();
  return <button onClick={() => void mutations.recordPayment.mutateAsync({ invoiceId: 14, payload: { amount: "50.00", currency: "SYP" } })}>Record production payment</button>;
}

describe("Billing payment mutation lifecycle", () => {
  it("invalidates invoice, payment, print, list, handoff, and dashboard data after a successful payment", async () => {
    vi.mocked(billingApi.recordPayment).mockResolvedValue({ id: 1 } as never);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<QueryClientProvider client={client}><PaymentMutationProbe /></QueryClientProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Record production payment" }));

    await waitFor(() => expect(billingApi.recordPayment).toHaveBeenCalledWith(14, { amount: "50.00", currency: "SYP" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoice-payments", 14] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoice", 14] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoice-print-data", 14] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoices"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["billing-handoffs"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});
