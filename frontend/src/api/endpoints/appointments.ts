import type { QueryParams } from "../../types/api";
import type {
  AppointmentAvailability,
  AppointmentDetail,
  AppointmentAvailabilityFilters,
  AppointmentListFilters,
  AppointmentList,
  AppointmentPage,
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
    search: filters.search,
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
  return api.get<AppointmentPage>("/appointments/", appointmentListQuery(filters));
}

// Calendar surfaces represent an entire bounded day/week/month, not a single
// DRF page. Follow pagination here so a busy period cannot silently render only
// its first 20 appointments while the period total reports a much larger count.
export async function getAllAppointments(filters?: AppointmentListFilters): Promise<AppointmentPage> {
  const baseFilters = { ...(filters ?? {}) };
  delete baseFilters.page;

  const results: AppointmentList[] = [];
  let pageNumber = 1;
  let firstPage: AppointmentPage | null = null;

  while (true) {
    const page = await getAppointments({ ...baseFilters, page: pageNumber });
    firstPage ??= page;
    results.push(...page.results);

    if (!page.next || results.length >= page.count) {
      return {
        count: page.count,
        next: null,
        previous: null,
        results,
        clinic_date: firstPage.clinic_date,
        clinic_timezone: firstPage.clinic_timezone,
      };
    }

    pageNumber += 1;
    if (pageNumber > 100) {
      throw new Error("Appointment calendar pagination exceeded the safety limit.");
    }
  }
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
  all: getAllAppointments,
  create: createAppointment,
  detail: getAppointment,
  update: updateAppointment,
  checkIn: checkInAppointment,
  cancel: cancelAppointment,
  noShow: markAppointmentNoShow,
  startVisit: startAppointmentVisit,
  availability: getAppointmentAvailability,
};
