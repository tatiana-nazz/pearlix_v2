import type { AppointmentStatus } from "../../../types/appointments";

export type AppointmentStatusTone = "info" | "teal" | "success" | "warning" | "danger";

const tones: Record<AppointmentStatus, AppointmentStatusTone> = {
  UPCOMING: "info",
  CHECKED_IN: "teal",
  ACTIVE: "success",
  COMPLETED: "success",
  NEEDS_RESCHEDULE: "warning",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export function appointmentStatusTone(status: AppointmentStatus): AppointmentStatusTone {
  return tones[status];
}

export function appointmentStatusClass(baseClass: string, status: AppointmentStatus): string {
  return `${baseClass} appointment-status-surface status-${appointmentStatusTone(status)}`;
}

export function appointmentMonthStatusClass(status: AppointmentStatus): string {
  return appointmentStatusClass("appointment-month-item", status);
}
