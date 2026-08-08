import type { Page, QueryParams } from "../../types/api";
import type {
  BillingHandoff,
  HandoffConversionPayload,
  Invoice,
  InvoiceFinancialSummary,
  InvoicePayload,
  Payment,
  PaymentPayload,
  PaymentResponse,
} from "../../types/billing";
import { api } from "../http";

export const billingApi = {
  handoffs: (query?: QueryParams) => api.get<Page<BillingHandoff>>("/billing-handoffs/", query),
  handoffDetail: (id: number) => api.get<BillingHandoff>(`/billing-handoffs/${id}/`),
  dismissHandoff: (id: number, dismissed_reason?: string) =>
    api.post<BillingHandoff, { dismissed_reason?: string }>(`/billing-handoffs/${id}/dismiss/`, { dismissed_reason }),
  convertHandoff: (id: number, payload: HandoffConversionPayload) =>
    api.post<Invoice, HandoffConversionPayload>(`/billing-handoffs/${id}/convert-to-invoice/`, payload),
  invoices: (query?: QueryParams) => api.get<Page<Invoice>>("/invoices/", query),
  invoiceSummary: (query?: QueryParams) => api.get<InvoiceFinancialSummary>("/invoices/summary/", query),
  createInvoice: (payload: InvoicePayload) => api.post<Invoice, InvoicePayload>("/invoices/", payload),
  invoiceDetail: (id: number) => api.get<Invoice>(`/invoices/${id}/`),
  updateInvoice: (id: number, payload: InvoicePayload) => api.patch<Invoice, InvoicePayload>(`/invoices/${id}/`, payload),
  cancelInvoice: (id: number, cancelled_reason?: string) =>
    api.post<Invoice, { cancelled_reason?: string }>(`/invoices/${id}/cancel/`, { cancelled_reason }),
  payments: (invoiceId: number) => api.get<Payment[]>(`/invoices/${invoiceId}/payments/`),
  recordPayment: (invoiceId: number, payload: PaymentPayload) =>
    api.post<PaymentResponse, PaymentPayload>(`/invoices/${invoiceId}/payments/`, payload),
  printData: (invoiceId: number) => api.get<Record<string, unknown>>(`/invoices/${invoiceId}/print-data/`),
};
