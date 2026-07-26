import type { AppointmentStatus } from "../../../types/appointments";

export type AppointmentStatusTone = "info" | "teal" | "ai" | "success" | "warning" | "danger";

const tones: Record<AppointmentStatus, AppointmentStatusTone> = {
  UPCOMING: "info",
  CHECKED_IN: "teal",
  ACTIVE: "ai",
  COMPLETED: "success",
  NEEDS_RESCHEDULE: "warning",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export function appointmentStatusTone(status: AppointmentStatus): AppointmentStatusTone {
  return tones[status];
}

export function appointmentMonthStatusClass(status: AppointmentStatus): string {
  return `appointment-month-item status-${appointmentStatusTone(status)}`;
}
