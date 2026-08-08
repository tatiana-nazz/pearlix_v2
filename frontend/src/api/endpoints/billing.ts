import type { Page, QueryParams } from "../../types/api";
import type {
  BillingHandoff,
  BillingHandoffPayload,
  BillingHandoffUpdatePayload,
  HandoffFinancialSummary,
  HandoffInvoiceResponse,
  Invoice,
  InvoiceFinancialSummary,
  InvoiceIssuePayload,
} from "../../types/billing";
import { api } from "../http";

export const billingApi = {
  handoffs: (query?: QueryParams) => api.get<Page<BillingHandoff>>("/billing-handoffs/", query),
  handoffSummary: (query?: QueryParams) => api.get<HandoffFinancialSummary>("/billing-handoffs/summary/", query),
  handoffDetail: (id: number) => api.get<BillingHandoff>(`/billing-handoffs/${id}/`),
  createHandoff: (payload: BillingHandoffPayload) => api.post<BillingHandoff, BillingHandoffPayload>("/billing-handoffs/", payload),
  updateHandoff: (id: number, payload: BillingHandoffUpdatePayload) => api.patch<BillingHandoff, BillingHandoffUpdatePayload>(`/billing-handoffs/${id}/`, payload),
  cancelHandoff: (id: number, cancelled_reason?: string) =>
    api.post<BillingHandoff, { cancelled_reason?: string }>(`/billing-handoffs/${id}/cancel/`, { cancelled_reason }),
  issueInvoice: (id: number, payload: InvoiceIssuePayload) =>
    api.post<HandoffInvoiceResponse, InvoiceIssuePayload>(`/billing-handoffs/${id}/invoices/`, payload),
  invoices: (query?: QueryParams) => api.get<Page<Invoice>>("/invoices/", query),
  invoiceSummary: (query?: QueryParams) => api.get<InvoiceFinancialSummary>("/invoices/summary/", query),
  invoiceDetail: (id: number) => api.get<Invoice>(`/invoices/${id}/`),
  printData: (invoiceId: number) => api.get<Record<string, unknown>>(`/invoices/${invoiceId}/print-data/`),
};
