import type { QueryClient } from "@tanstack/react-query";

export interface BillingInvalidationContext {
  invoiceId?: number;
  handoffId?: number;
  patientId?: number;
  visitId?: number;
  appointmentId?: number;
  refetchActiveVisit?: boolean;
}

export async function invalidateBillingQueries(queryClient: QueryClient, context: BillingInvalidationContext = {}) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ["billing-handoffs"] }),
    queryClient.invalidateQueries({ queryKey: ["handoff-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["invoice-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ];

  if (context.invoiceId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ["invoice", context.invoiceId] }),
      queryClient.invalidateQueries({ queryKey: ["invoice-print-data", context.invoiceId] }),
    );
  }
  if (context.handoffId) invalidations.push(queryClient.invalidateQueries({ queryKey: ["billing-handoff", context.handoffId] }));
  if (context.patientId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ["patient", context.patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patient", context.patientId, "billing"] }),
    );
  }
  if (context.visitId) invalidations.push(queryClient.invalidateQueries({ queryKey: ["visit", context.visitId] }));
  if (context.appointmentId) invalidations.push(queryClient.invalidateQueries({ queryKey: ["appointments", context.appointmentId] }));
  if (context.visitId || context.appointmentId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ["active-visit"], refetchType: context.refetchActiveVisit === false ? "none" : "active" }),
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    );
  }

  await Promise.all(invalidations);
}
