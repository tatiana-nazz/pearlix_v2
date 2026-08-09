import type { Page, QueryParams } from "../../types/api";
import type { AIResult } from "../../types/ai";
import type { ExternalAttachPayload, ExternalXrayCase, XrayAttachment } from "../../types/xrays";
import { api } from "../http";

export const xraysApi = {
  list: (query?: QueryParams) => api.get<Page<XrayAttachment>>("/xrays/", query),
  detail: (id: number) => api.get<XrayAttachment>(`/xrays/${id}/`),
  delete: (id: number) => api.delete<void>(`/xrays/${id}/`),
  file: (id: number) => api.getBlob(`/xrays/${id}/file/`),
  runAi: (id: number) => api.post<AIResult>(`/xrays/${id}/run-ai/`),
  aiResult: (id: number) => api.get<AIResult>(`/xrays/${id}/ai-result/`),
  aiOverlay: (id: number) => api.getBlob(`/xrays/${id}/ai-overlay/`),
  externalList: (query?: QueryParams) => api.get<Page<ExternalXrayCase>>("/external-xrays/", query),
  createExternal: (formData: FormData) => api.postFormData<ExternalXrayCase>("/external-xrays/", formData),
  externalDetail: (id: number) => api.get<ExternalXrayCase>(`/external-xrays/${id}/`),
  externalFile: (id: number) => api.getBlob(`/external-xrays/${id}/file/`),
  runExternalAi: (id: number) => api.post<AIResult>(`/external-xrays/${id}/run-ai/`),
  externalAiResult: (id: number) => api.get<AIResult>(`/external-xrays/${id}/ai-result/`),
  externalAiOverlay: (id: number) => api.getBlob(`/external-xrays/${id}/ai-overlay/`),
  discardExternal: (id: number) => api.post<ExternalXrayCase>(`/external-xrays/${id}/discard/`),
  attachExternalToPatient: (id: number, payload: ExternalAttachPayload) =>
    api.post<ExternalXrayCase, ExternalAttachPayload>(`/external-xrays/${id}/attach-to-patient/`, payload),
};
