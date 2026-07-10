import type { Page, QueryParams } from "../../types/api";
import type { AIResult } from "../../types/ai";
import type {
  CreatePatientPayload,
  PatientDetail,
  PatientListFilters,
  PatientListItem,
  PatientPayload,
  PatientUpdatePayload,
  UpdatePatientPayload,
} from "../../types/patients";
import type { VisitDetail } from "../../types/visits";
import type { XrayAttachment } from "../../types/xrays";
import { api } from "../http";

export function patientListQuery(filters?: PatientListFilters): QueryParams | undefined {
  if (!filters) return undefined;
  return {
    page: filters.page,
    search: filters.search || undefined,
    name: filters.name || undefined,
    phone: filters.phone || undefined,
    is_archived: filters.is_archived,
    my_patients: filters.my_patients || undefined,
    upcoming_with_me: filters.upcoming_with_me || undefined,
    last_visit_with_me: filters.last_visit_with_me || undefined,
  };
}

export function getPatients(filters?: PatientListFilters) {
  return api.get<Page<PatientListItem>>("/patients/", patientListQuery(filters));
}

export function getPatient(id: number) {
  return api.get<PatientDetail>(`/patients/${id}/`);
}

export function createPatient(payload: CreatePatientPayload) {
  return api.post<PatientDetail, CreatePatientPayload>("/patients/", payload);
}

export function updatePatient(id: number, payload: UpdatePatientPayload) {
  return api.patch<PatientDetail, UpdatePatientPayload>(`/patients/${id}/`, payload);
}

export function archivePatient(id: number) {
  return api.post<PatientDetail>(`/patients/${id}/archive/`);
}

export function unarchivePatient(id: number) {
  return api.post<PatientDetail>(`/patients/${id}/unarchive/`);
}

export function getPatientVisits(id: number, query?: QueryParams) {
  return api.get<Page<VisitDetail>>(`/patients/${id}/visits/`, query);
}

export function getPatientXrays(id: number, query?: QueryParams) {
  return api.get<Page<XrayAttachment>>(`/patients/${id}/xrays/`, query);
}

export function getPatientAiResults(id: number, query?: QueryParams) {
  return api.get<Page<AIResult>>(`/patients/${id}/ai-results/`, query);
}

export const patientsApi = {
  list: getPatients,
  create: (payload: PatientPayload) => api.post<PatientDetail, PatientPayload>("/patients/", payload),
  detail: getPatient,
  update: (id: number, payload: PatientUpdatePayload) =>
    api.patch<PatientDetail, PatientUpdatePayload>(`/patients/${id}/`, payload),
  archive: archivePatient,
  unarchive: unarchivePatient,
  visits: getPatientVisits,
  xrays: getPatientXrays,
  uploadXray: (id: number, formData: FormData) => api.postFormData<XrayAttachment>(`/patients/${id}/xrays/`, formData),
  aiResults: getPatientAiResults,
};
