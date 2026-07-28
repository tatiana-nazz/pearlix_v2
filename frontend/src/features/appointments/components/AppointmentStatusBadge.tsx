import { StatusBadge } from "../../../components/v2";
import type { AppointmentStatus } from "../../../types/appointments";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const tone: Record<AppointmentStatus, "info" | "teal" | "success" | "warning" | "danger"> = {
    UPCOMING: "info",
    CHECKED_IN: "teal",
    ACTIVE: "success",
    COMPLETED: "success",
    NEEDS_RESCHEDULE: "warning",
    CANCELLED: "danger",
    NO_SHOW: "danger",
  };
  return <StatusBadge status={status} className={`appointment-status-badge status-${tone[status]}`} />;
}
