import type { Page, QueryParams } from "../../types/api";
import type {
  AppointmentAvailability,
  AppointmentDetail,
  AppointmentAvailabilityFilters,
  AppointmentListFilters,
  AppointmentList,
  CreateAppointmentPayload,
  UpdateAppointmentPayload,
} from "../../types/appointments";
import type { VisitDetail } from "../../types/visits";
import { api } from "../http";

export function appointmentListQuery(filters?: AppointmentListFilters): QueryParams | undefined {
  if (!filters) return undefined;
  return {
    page: filters.page,
    doctor_id: filters.doctor_id,
    patient_id: filters.patient_id,
    status: filters.status,
    date: filters.date,
    start_from: filters.start_from,
    start_to: filters.start_to,
  };
}

export function availabilityQuery(filters: AppointmentAvailabilityFilters): QueryParams {
  return {
    doctor_id: filters.doctor_id,
    date: filters.date,
    duration_minutes: filters.duration_minutes,
  };
}

export function getAppointments(filters?: AppointmentListFilters) {
  return api.get<Page<AppointmentList>>("/appointments/", appointmentListQuery(filters));
}

export function getAppointment(id: number) {
  return api.get<AppointmentDetail>(`/appointments/${id}/`);
}

export function createAppointment(payload: CreateAppointmentPayload) {
  return api.post<AppointmentDetail, CreateAppointmentPayload>("/appointments/", payload);
}

export function updateAppointment(id: number, payload: UpdateAppointmentPayload) {
  return api.patch<AppointmentDetail, UpdateAppointmentPayload>(`/appointments/${id}/`, payload);
}

export function checkInAppointment(id: number) {
  return api.post<AppointmentDetail>(`/appointments/${id}/check-in/`);
}

export function cancelAppointment(id: number) {
  return api.post<AppointmentDetail>(`/appointments/${id}/cancel/`);
}

export function markAppointmentNoShow(id: number) {
  return api.post<AppointmentDetail>(`/appointments/${id}/no-show/`);
}

export function startAppointmentVisit(id: number) {
  return api.post<VisitDetail>(`/appointments/${id}/start-visit/`);
}

export function getAppointmentAvailability(filters: AppointmentAvailabilityFilters) {
  return api.get<AppointmentAvailability>("/appointments/availability/", availabilityQuery(filters));
}

export const appointmentsApi = {
  list: getAppointments,
  create: createAppointment,
  detail: getAppointment,
  update: updateAppointment,
  checkIn: checkInAppointment,
  cancel: cancelAppointment,
  noShow: markAppointmentNoShow,
  startVisit: startAppointmentVisit,
  availability: getAppointmentAvailability,
};
