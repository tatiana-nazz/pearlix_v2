import { AppointmentTable } from "./AppointmentTable";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";

interface AppointmentViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentDayView(props: AppointmentViewProps) {
  return <AppointmentTable {...props} />;
}
