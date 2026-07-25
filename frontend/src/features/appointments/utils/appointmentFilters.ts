import type { AppointmentListFilters, AppointmentStatus, AppointmentViewMode } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { addDays, getMonthRange, getWeekRange } from "./appointmentDates";

interface FilterOptions {
  role: UserRole;
  view: AppointmentViewMode;
  date: string;
  page?: number;
  doctorId?: number;
  patientId?: number;
  status?: AppointmentStatus | "ALL";
  search?: string;
}

function dayBounds(date: string) {
  return {
    start_from: `${date}T00:00:00`,
    start_to: `${addDays(date, 1)}T00:00:00`,
  };
}

export function buildAppointmentFilters(options: FilterOptions): AppointmentListFilters {
  const filters: AppointmentListFilters = {};
  if (options.page) filters.page = options.page;
  if (options.doctorId) filters.doctor_id = options.doctorId;
  if (options.patientId) filters.patient_id = options.patientId;
  if (options.status && options.status !== "ALL") filters.status = options.status;
  if (options.search) filters.search = options.search;

  if (options.view === "needs-reschedule") {
    filters.status = "NEEDS_RESCHEDULE";
    return filters;
  }

  if (options.view === "day") {
    filters.date = options.date;
    return filters;
  }

  if (options.view === "week") {
    const range = getWeekRange(options.date);
    filters.start_from = `${range.start}T00:00:00`;
    filters.start_to = `${addDays(range.end, 1)}T00:00:00`;
    return filters;
  }

  if (options.view === "month") {
    const range = getMonthRange(options.date);
    filters.start_from = `${range.start}T00:00:00`;
    filters.start_to = `${addDays(range.end, 1)}T00:00:00`;
    return filters;
  }

  const bounds = dayBounds(options.date);
  filters.start_from = bounds.start_from;
  filters.start_to = bounds.start_to;
  return filters;
}

export function dateFromAppointment(value: string): string {
  return value.slice(0, 10);
}
