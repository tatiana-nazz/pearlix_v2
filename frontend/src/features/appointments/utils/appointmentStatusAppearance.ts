import type { AppointmentStatus } from "../../../types/appointments";

/**
 * The record tone is intentionally separate from the compact status badge.  This
 * keeps calendar, list, and queue records consistent without using pale accent
 * colours for their readable text.
 */
export type AppointmentRecordTone = "upcoming" | "checked-in" | "active" | "completed" | "needs-reschedule" | "cancelled" | "no-show" | "neutral";

export const appointmentStatusAppearance: Record<AppointmentStatus, AppointmentRecordTone> = {
  UPCOMING: "upcoming",
  CHECKED_IN: "checked-in",
  ACTIVE: "active",
  COMPLETED: "completed",
  NEEDS_RESCHEDULE: "needs-reschedule",
  CANCELLED: "cancelled",
  NO_SHOW: "no-show",
};

export function appointmentRecordClass(status: string): string {
  return `appointment-record appointment-record--${appointmentStatusAppearance[status as AppointmentStatus] ?? "neutral"}`;
}
