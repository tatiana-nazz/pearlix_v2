import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "../../../api/endpoints/billing";
import type { BillingHandoffCreatePayload, DoctorFinalChargePayload, HandoffConversionPayload, InvoicePayload, PaymentPayload } from "../../../types/billing";
import { visitsApi } from "../../../api/endpoints/visits";

export function useHandoffs(query?: Record<string, string | number | undefined>) { return useQuery({ queryKey: ["billing-handoffs", query], queryFn: () => billingApi.handoffs(query) }); }
export function useHandoff(id: number) { return useQuery({ queryKey: ["billing-handoff", id], queryFn: () => billingApi.handoffDetail(id), enabled: id > 0 }); }
export function useInvoices(query?: Record<string, string | number | undefined>) { return useQuery({ queryKey: ["invoices", query], queryFn: () => billingApi.invoices(query) }); }
export function useInvoice(id: number) { return useQuery({ queryKey: ["invoice", id], queryFn: () => billingApi.invoiceDetail(id), enabled: id > 0 }); }
export function useInvoicePayments(id: number) { return useQuery({ queryKey: ["invoice-payments", id], queryFn: () => billingApi.payments(id), enabled: id > 0 }); }
export function useInvoicePrintData(id: number) { return useQuery({ queryKey: ["invoice-print-data", id], queryFn: () => billingApi.printData(id), enabled: id > 0 }); }
export function useVisitInvoice(id: number) { return useQuery({ queryKey: ["visit-invoice", id], queryFn: () => visitsApi.invoice(id), enabled: id > 0 }); }

function invalidate(queryClient: ReturnType<typeof useQueryClient>, invoiceId?: number, handoffId?: number) {
  void queryClient.invalidateQueries({ queryKey: ["billing-handoffs"] }); void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  if (invoiceId) { void queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] }); void queryClient.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] }); void queryClient.invalidateQueries({ queryKey: ["invoice-print-data", invoiceId] }); }
  if (handoffId) void queryClient.invalidateQueries({ queryKey: ["billing-handoff", handoffId] });
}

export function useBillingMutations() {
  const client = useQueryClient();
  return {
    createHandoff: useMutation({ mutationFn: ({ visitId, payload }: { visitId: number; payload: BillingHandoffCreatePayload }) => visitsApi.createBillingHandoff(visitId, payload), onSuccess: (handoff, vars) => { invalidate(client, undefined, handoff.id); void client.invalidateQueries({ queryKey: ["visit", vars.visitId] }); void client.invalidateQueries({ queryKey: ["patient", handoff.patient.id] }); } }),
    createFinalChargeInvoice: useMutation({ mutationFn: ({ visitId, payload }: { visitId: number; payload: DoctorFinalChargePayload }) => visitsApi.createInvoice(visitId, payload), onSuccess: (invoice, vars) => { invalidate(client, invoice.id); void client.invalidateQueries({ queryKey: ["visit", vars.visitId] }); void client.invalidateQueries({ queryKey: ["visit-invoice", vars.visitId] }); } }),
    convert: useMutation({ mutationFn: ({ handoffId, payload }: { handoffId: number; payload: HandoffConversionPayload }) => billingApi.convertHandoff(handoffId, payload), onSuccess: (invoice, vars) => invalidate(client, invoice.id, vars.handoffId) }),
    dismiss: useMutation({ mutationFn: ({ handoffId, reason }: { handoffId: number; reason?: string }) => billingApi.dismissHandoff(handoffId, reason), onSuccess: (_, vars) => invalidate(client, undefined, vars.handoffId) }),
    createInvoice: useMutation({ mutationFn: (payload: InvoicePayload) => billingApi.createInvoice(payload), onSuccess: (invoice) => { invalidate(client, invoice.id); void client.invalidateQueries({ queryKey: ["patient", invoice.patient.id] }); } }),
    updateInvoice: useMutation({ mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: InvoicePayload }) => billingApi.updateInvoice(invoiceId, payload), onSuccess: (invoice) => invalidate(client, invoice.id) }),
    cancelInvoice: useMutation({ mutationFn: ({ invoiceId, reason }: { invoiceId: number; reason?: string }) => billingApi.cancelInvoice(invoiceId, reason), onSuccess: (invoice) => invalidate(client, invoice.id) }),
    recordPayment: useMutation({ mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: PaymentPayload }) => billingApi.recordPayment(invoiceId, payload), onSuccess: (_result, vars) => invalidate(client, vars.invoiceId) }),
  };
}
