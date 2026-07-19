import { useQuery } from "@tanstack/react-query";

import { getAppointment, getAppointmentAvailability, getAppointments } from "../../../api/endpoints/appointments";
import type { AppointmentAvailabilityFilters, AppointmentListFilters, AppointmentListItem } from "../../../types/appointments";

export function appointmentListKey(filters: AppointmentListFilters) {
  return ["appointments", filters] as const;
}

export function appointmentKey(appointmentId: number) {
  return ["appointments", appointmentId] as const;
}

export function useAppointments(filters: AppointmentListFilters, enabled = true) {
  return useQuery({
    queryKey: appointmentListKey(filters),
    queryFn: () => getAppointments(filters),
    enabled,
  });
}

export const CALENDAR_RANGE_PAGE_LIMIT = 100;

export async function fetchAppointmentRange(filters: AppointmentListFilters, pageLimit = CALENDAR_RANGE_PAGE_LIMIT): Promise<AppointmentListItem[]> {
  const appointments = new Map<number, AppointmentListItem>();
  let page = 1;
  let next: string | null = "initial";
  while (next) {
    if (page > pageLimit) throw new Error("Appointment calendar range exceeded the safe page limit.");
    const response = await getAppointments({ ...filters, page });
    response.results.forEach((appointment) => appointments.set(appointment.id, appointment));
    next = response.next;
    page += 1;
  }
  return [...appointments.values()].sort((left, right) => left.start_datetime.localeCompare(right.start_datetime));
}

export function appointmentRangeKey(filters: AppointmentListFilters) {
  const { page: _page, ...range } = filters;
  return ["appointment-calendar-range", range] as const;
}

export function useAppointmentRange(filters: AppointmentListFilters, enabled = true) {
  return useQuery({
    queryKey: appointmentRangeKey(filters),
    queryFn: () => fetchAppointmentRange(filters),
    enabled,
  });
}

export function useAppointment(appointmentId: number) {
  return useQuery({
    queryKey: appointmentKey(appointmentId),
    queryFn: () => getAppointment(appointmentId),
    enabled: Number.isFinite(appointmentId) && appointmentId > 0,
  });
}

export function useAppointmentAvailability(filters: AppointmentAvailabilityFilters | null) {
  return useQuery({
    queryKey: ["appointment-availability", filters],
    queryFn: () => getAppointmentAvailability(filters as AppointmentAvailabilityFilters),
    enabled: Boolean(filters?.doctor_id && filters?.date),
  });
}
