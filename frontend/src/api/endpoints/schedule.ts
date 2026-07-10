import type { Page, QueryParams } from "../../types/api";
import type {
  AvailabilityCancelResponse,
  AvailabilityException,
  AvailabilityExceptionPayload,
  DoctorListItem,
  WorkingHoursPayload,
  WorkingHoursResponse,
} from "../../types/schedule";
import { api } from "../http";

export const scheduleApi = {
  doctors: () => api.get<DoctorListItem[]>("/doctors/"),
  workingHours: (doctorId: number) => api.get<WorkingHoursResponse>(`/doctors/${doctorId}/working-hours/`),
  replaceWorkingHours: (doctorId: number, payload: WorkingHoursPayload) =>
    api.put<WorkingHoursResponse, WorkingHoursPayload>(`/doctors/${doctorId}/working-hours/`, payload),
  availabilityExceptions: (query?: QueryParams) => api.get<Page<AvailabilityException>>("/availability-exceptions/", query),
  createAvailabilityException: (payload: AvailabilityExceptionPayload) =>
    api.post<AvailabilityException, AvailabilityExceptionPayload>("/availability-exceptions/", payload),
  updateAvailabilityException: (id: number, payload: Partial<AvailabilityExceptionPayload>) =>
    api.patch<AvailabilityException, Partial<AvailabilityExceptionPayload>>(`/availability-exceptions/${id}/`, payload),
  cancelAvailabilityException: (id: number) =>
    api.post<AvailabilityCancelResponse>(`/availability-exceptions/${id}/cancel/`),
};
