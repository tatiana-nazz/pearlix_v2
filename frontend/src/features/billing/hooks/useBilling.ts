import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "../../../api/endpoints/billing";
import type { BillingHandoffPayload, BillingHandoffUpdatePayload, InvoiceIssuePayload } from "../../../types/billing";
import { invalidateBillingQueries } from "./billingCache";

const OPERATIONAL_QUERY_OPTIONS = {
  refetchOnWindowFocus: "always",
  refetchInterval: 30_000,
  staleTime: 15_000,
} as const;

export function useHandoffs(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({ queryKey: ["billing-handoffs", query], queryFn: () => billingApi.handoffs(query), enabled, ...OPERATIONAL_QUERY_OPTIONS });
}

export function useHandoffSummary(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({ queryKey: ["handoff-summary", query], queryFn: () => billingApi.handoffSummary(query), enabled, ...OPERATIONAL_QUERY_OPTIONS });
}

export function useHandoff(id: number) {
  return useQuery({ queryKey: ["billing-handoff", id], queryFn: () => billingApi.handoffDetail(id), enabled: id > 0, refetchOnWindowFocus: "always" });
}

export function useInvoices(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({ queryKey: ["invoices", query], queryFn: () => billingApi.invoices(query), enabled, ...OPERATIONAL_QUERY_OPTIONS });
}

export function useInvoiceSummary(query?: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({ queryKey: ["invoice-summary", query], queryFn: () => billingApi.invoiceSummary(query), enabled, ...OPERATIONAL_QUERY_OPTIONS });
}

export function useInvoice(id: number) {
  return useQuery({ queryKey: ["invoice", id], queryFn: () => billingApi.invoiceDetail(id), enabled: id > 0, refetchOnWindowFocus: "always" });
}

export function useInvoicePrintData(id: number) {
  return useQuery({ queryKey: ["invoice-print-data", id], queryFn: () => billingApi.printData(id), enabled: id > 0, refetchOnWindowFocus: "always" });
}

export function useBillingMutations() {
  const client = useQueryClient();
  return {
    createHandoff: useMutation({
      mutationFn: (payload: BillingHandoffPayload) => billingApi.createHandoff(payload),
      onSuccess: (handoff) => invalidateBillingQueries(client, { handoffId: handoff.id, patientId: handoff.patient.id }),
    }),
    updateHandoff: useMutation({
      mutationFn: ({ handoffId, payload }: { handoffId: number; payload: BillingHandoffUpdatePayload }) => billingApi.updateHandoff(handoffId, payload),
      onSuccess: (handoff) => invalidateBillingQueries(client, { handoffId: handoff.id, patientId: handoff.patient.id, visitId: handoff.visit?.id, appointmentId: handoff.visit?.appointment.id }),
    }),
    cancelHandoff: useMutation({
      mutationFn: ({ handoffId, reason }: { handoffId: number; reason?: string }) => billingApi.cancelHandoff(handoffId, reason),
      onSuccess: (handoff) => invalidateBillingQueries(client, { handoffId: handoff.id, patientId: handoff.patient.id }),
    }),
    issueInvoice: useMutation({
      mutationFn: ({ handoffId, payload }: { handoffId: number; payload: InvoiceIssuePayload }) => billingApi.issueInvoice(handoffId, payload),
      onSuccess: (result) => invalidateBillingQueries(client, {
        handoffId: result.handoff.id,
        invoiceId: result.invoice.id,
        patientId: result.handoff.patient.id,
        visitId: result.handoff.visit?.id,
        appointmentId: result.handoff.visit?.appointment.id,
      }),
    }),
  };
}
