import { AppointmentTable } from "./AppointmentTable";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";

interface AppointmentViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  timezone?: string;
  onEdit: (appointment: AppointmentListItem) => void;
  onDetails: (appointment: AppointmentListItem) => void;
  onStatusAction: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show") => void;
}

export function AppointmentDayView(props: AppointmentViewProps) {
  return <AppointmentTable {...props} />;
}
