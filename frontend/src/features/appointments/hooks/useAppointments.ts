import { useQuery } from "@tanstack/react-query";

import { getAllAppointments, getAppointment, getAppointmentAvailability, getAppointments } from "../../../api/endpoints/appointments";
import type { AppointmentAvailabilityFilters, AppointmentListFilters } from "../../../types/appointments";

export function appointmentListKey(filters: AppointmentListFilters) {
  return ["appointments", filters] as const;
}

export function appointmentKey(appointmentId: number) {
  return ["appointments", appointmentId] as const;
}

export function useAppointments(filters: AppointmentListFilters, fetchAllPages = false) {
  // Day/week/month views always carry a bounded date period. Those surfaces
  // must render the complete period; only the unbounded list/queue stays paged.
  const boundedPeriod = Boolean(filters.date || (filters.start_from && filters.start_to));
  const shouldFetchAllPages = fetchAllPages || boundedPeriod;

  return useQuery({
    queryKey: [...appointmentListKey(filters), shouldFetchAllPages ? "all-pages" : "page"],
    queryFn: () => shouldFetchAllPages ? getAllAppointments(filters) : getAppointments(filters),
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
