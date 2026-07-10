import type { Page, QueryParams } from "../../types/api";
import type {
  AppointmentAvailability,
  AppointmentDetail,
  AppointmentList,
  AppointmentPayload,
} from "../../types/appointments";
import type { VisitDetail } from "../../types/visits";
import { api } from "../http";

export const appointmentsApi = {
  list: (query?: QueryParams) => api.get<Page<AppointmentList>>("/appointments/", query),
  create: (payload: AppointmentPayload) => api.post<AppointmentDetail, AppointmentPayload>("/appointments/", payload),
  detail: (id: number) => api.get<AppointmentDetail>(`/appointments/${id}/`),
  update: (id: number, payload: AppointmentPayload) =>
    api.patch<AppointmentDetail, AppointmentPayload>(`/appointments/${id}/`, payload),
  checkIn: (id: number) => api.post<AppointmentDetail>(`/appointments/${id}/check-in/`),
  cancel: (id: number) => api.post<AppointmentDetail>(`/appointments/${id}/cancel/`),
  noShow: (id: number) => api.post<AppointmentDetail>(`/appointments/${id}/no-show/`),
  startVisit: (id: number) => api.post<VisitDetail>(`/appointments/${id}/start-visit/`),
  availability: (query: QueryParams) => api.get<AppointmentAvailability>("/appointments/availability/", query),
};
