import type { Page, QueryParams } from "../../types/api";
import type { ClinicalNotesPayload, VisitCompletionPayload, VisitCompletionResponse, VisitDetail } from "../../types/visits";
import type { XrayAttachment } from "../../types/xrays";
import { api } from "../http";

export const visitsApi = {
  list: (query?: QueryParams) => api.get<Page<VisitDetail>>("/visits/", query),
  active: () => api.get<VisitDetail>("/visits/active/"),
  detail: (id: number) => api.get<VisitDetail>(`/visits/${id}/`),
  complete: (id: number, payload: VisitCompletionPayload) =>
    api.post<VisitCompletionResponse, VisitCompletionPayload>(`/visits/${id}/complete/`, payload),
  updateClinicalNotes: (id: number, payload: ClinicalNotesPayload) =>
    api.patch<VisitDetail, ClinicalNotesPayload>(`/visits/${id}/clinical-notes/`, payload),
  uploadXray: (id: number, formData: FormData) => api.postFormData<XrayAttachment>(`/visits/${id}/xrays/`, formData),
};
