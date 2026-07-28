import type { Page, QueryParams } from "../../types/api";
import type { BillingHandoff, BillingHandoffCreatePayload, DoctorFinalChargePayload, Invoice, InvoiceSummary } from "../../types/billing";
import type { ClinicalNotesPayload, VisitDetail } from "../../types/visits";
import type { XrayAttachment } from "../../types/xrays";
import { api } from "../http";

export const visitsApi = {
  list: (query?: QueryParams) => api.get<Page<VisitDetail>>("/visits/", query),
  active: () => api.get<VisitDetail>("/visits/active/"),
  detail: (id: number) => api.get<VisitDetail>(`/visits/${id}/`),
  complete: (id: number, payload: {
    version: string;
    notes: ClinicalNotesPayload;
    billing_handoff: { description: string; suggested_amount: string; currency: "SYP" | "USD"; note: string };
  }) => api.post<{ visit: VisitDetail; billing_handoff: BillingHandoff }, typeof payload>(`/visits/${id}/complete/`, payload),
  updateClinicalNotes: (id: number, payload: ClinicalNotesPayload) =>
    api.patch<VisitDetail, ClinicalNotesPayload>(`/visits/${id}/clinical-notes/`, payload),
  uploadXray: (id: number, formData: FormData) => api.postFormData<XrayAttachment>(`/visits/${id}/xrays/`, formData),
  createBillingHandoff: (id: number, payload: BillingHandoffCreatePayload) =>
    api.post<BillingHandoff, BillingHandoffCreatePayload>(`/visits/${id}/billing-handoff/`, payload),
  createInvoice: (id: number, payload: DoctorFinalChargePayload) =>
    api.post<InvoiceSummary, DoctorFinalChargePayload>(`/visits/${id}/create-invoice/`, payload),
  invoice: (id: number) => api.get<(InvoiceSummary & { notes: string; created_at: string }) | null>(`/visits/${id}/invoice/`),
};
