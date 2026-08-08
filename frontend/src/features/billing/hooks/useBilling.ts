import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "../../../api/endpoints/billing";
import { visitsApi } from "../../../api/endpoints/visits";
import type { BillingHandoffCreatePayload, HandoffConversionPayload, Invoice, InvoicePayload, PaymentPayload } from "../../../types/billing";
import { invalidateBillingQueries } from "./billingCache";

const OPERATIONAL_QUERY_OPTIONS = {
  refetchOnWindowFocus: "always",
  refetchInterval: 30_000,
  staleTime: 15_000,
} as const;

export function useHandoffs(query?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ["billing-handoffs", query], queryFn: () => billingApi.handoffs(query) });
}

export function useHandoff(id: number) {
  return useQuery({ queryKey: ["billing-handoff", id], queryFn: () => billingApi.handoffDetail(id), enabled: id > 0 });
}

export function useInvoices(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({
    queryKey: ["invoices", query],
    queryFn: () => billingApi.invoices(query),
    enabled,
    ...OPERATIONAL_QUERY_OPTIONS,
  });
}

export function useInvoiceSummary(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({
    queryKey: ["invoice-summary", query],
    queryFn: () => billingApi.invoiceSummary(query),
    enabled,
    ...OPERATIONAL_QUERY_OPTIONS,
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => billingApi.invoiceDetail(id),
    enabled: id > 0,
    refetchOnWindowFocus: "always",
  });
}

export function useInvoicePayments(id: number) {
  return useQuery({ queryKey: ["invoice-payments", id], queryFn: () => billingApi.payments(id), enabled: id > 0, refetchOnWindowFocus: "always" });
}

export function useInvoicePrintData(id: number) {
  return useQuery({ queryKey: ["invoice-print-data", id], queryFn: () => billingApi.printData(id), enabled: id > 0, refetchOnWindowFocus: "always" });
}

function invoiceContext(invoice: Invoice) {
  return {
    invoiceId: invoice.id,
    patientId: invoice.patient.id,
    visitId: invoice.visit?.id,
    appointmentId: invoice.appointment?.id,
  };
}

export function useBillingMutations() {
  const client = useQueryClient();
  return {
    createHandoff: useMutation({
      mutationFn: ({ visitId, payload }: { visitId: number; payload: BillingHandoffCreatePayload }) => visitsApi.createBillingHandoff(visitId, payload),
      onSuccess: (handoff) => invalidateBillingQueries(client, { handoffId: handoff.id, patientId: handoff.patient.id, visitId: handoff.visit.id, appointmentId: handoff.visit.appointment.id }),
    }),
    convert: useMutation({
      mutationFn: ({ handoffId, payload }: { handoffId: number; payload: HandoffConversionPayload }) => billingApi.convertHandoff(handoffId, payload),
      onSuccess: (invoice, vars) => invalidateBillingQueries(client, { ...invoiceContext(invoice), handoffId: vars.handoffId }),
    }),
    dismiss: useMutation({
      mutationFn: ({ handoffId, reason }: { handoffId: number; reason?: string }) => billingApi.dismissHandoff(handoffId, reason),
      onSuccess: (handoff) => invalidateBillingQueries(client, { handoffId: handoff.id, patientId: handoff.patient.id, visitId: handoff.visit.id, appointmentId: handoff.visit.appointment.id }),
    }),
    createInvoice: useMutation({
      mutationFn: (payload: InvoicePayload) => billingApi.createInvoice(payload),
      onSuccess: (invoice) => invalidateBillingQueries(client, invoiceContext(invoice)),
    }),
    updateInvoice: useMutation({
      mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: InvoicePayload }) => billingApi.updateInvoice(invoiceId, payload),
      onSuccess: (invoice) => invalidateBillingQueries(client, invoiceContext(invoice)),
    }),
    cancelInvoice: useMutation({
      mutationFn: ({ invoiceId, reason }: { invoiceId: number; reason?: string }) => billingApi.cancelInvoice(invoiceId, reason),
      onSuccess: (invoice) => invalidateBillingQueries(client, invoiceContext(invoice)),
    }),
    recordPayment: useMutation({
      mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: PaymentPayload }) => billingApi.recordPayment(invoiceId, payload),
      onSuccess: (_result, vars) => invalidateBillingQueries(client, { invoiceId: vars.invoiceId }),
    }),
  };
}
