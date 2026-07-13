import { AppointmentTable } from "./AppointmentTable";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";

interface AppointmentViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit: (appointment: AppointmentListItem) => void;
  onReschedule: (appointment: AppointmentListItem) => void;
  onDetails: (appointment: AppointmentListItem) => void;
  onStatusAction: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show" | "start-visit") => void;
}

export function AppointmentDayView(props: AppointmentViewProps) {
  return <AppointmentTable {...props} />;
}
