import type { Page, QueryParams } from "../../types/api";
import type { AIResult } from "../../types/ai";
import type { PatientDetail, PatientList, PatientPayload, PatientUpdatePayload } from "../../types/patients";
import type { VisitDetail } from "../../types/visits";
import type { XrayAttachment } from "../../types/xrays";
import { api } from "../http";

export const patientsApi = {
  list: (query?: QueryParams) => api.get<Page<PatientList>>("/patients/", query),
  create: (payload: PatientPayload) => api.post<PatientDetail, PatientPayload>("/patients/", payload),
  detail: (id: number) => api.get<PatientDetail>(`/patients/${id}/`),
  update: (id: number, payload: PatientUpdatePayload) =>
    api.patch<PatientDetail, PatientUpdatePayload>(`/patients/${id}/`, payload),
  archive: (id: number) => api.post<PatientDetail>(`/patients/${id}/archive/`),
  unarchive: (id: number) => api.post<PatientDetail>(`/patients/${id}/unarchive/`),
  visits: (id: number, query?: QueryParams) => api.get<Page<VisitDetail>>(`/patients/${id}/visits/`, query),
  xrays: (id: number, query?: QueryParams) => api.get<Page<XrayAttachment>>(`/patients/${id}/xrays/`, query),
  uploadXray: (id: number, formData: FormData) => api.postFormData<XrayAttachment>(`/patients/${id}/xrays/`, formData),
  aiResults: (id: number, query?: QueryParams) => api.get<Page<AIResult>>(`/patients/${id}/ai-results/`, query),
};
