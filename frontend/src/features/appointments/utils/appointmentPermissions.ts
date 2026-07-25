import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";

export function appointmentBasePath(role: UserRole): string {
  return `/${role.toLowerCase()}/appointments`;
}

export function appointmentViewPath(role: UserRole, view: string): string {
  return `${appointmentBasePath(role)}/${view}`;
}

export function appointmentReschedulePath(appointmentId: number): string {
  return `/staff/appointments/${appointmentId}/reschedule`;
}

export function getAppointmentPermissions(role: UserRole, appointment?: AppointmentListItem) {
  const status = appointment?.status;
  return {
    canCreate: role === "STAFF",
    canEdit: role === "STAFF" && Boolean(appointment) && !["COMPLETED", "CANCELLED", "NO_SHOW", "ACTIVE"].includes(status ?? ""),
    canReschedule: role === "STAFF" && Boolean(appointment) && !["COMPLETED", "CANCELLED", "NO_SHOW", "ACTIVE"].includes(status ?? ""),
    canCheckIn: role === "STAFF" && status === "UPCOMING",
    canCancel: role === "STAFF" && (status === "UPCOMING" || status === "CHECKED_IN"),
    canNoShow: role === "STAFF" && status === "UPCOMING",
    isReadOnly: role === "ADMIN" || role === "DOCTOR",
  };
}
