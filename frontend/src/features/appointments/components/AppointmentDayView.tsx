import { AppointmentTable } from "./AppointmentTable";
import type { AppointmentListItem } from "../../../types/appointments";

interface AppointmentViewProps {
  appointments: AppointmentListItem[];
  timezone?: string;
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentDayView(props: AppointmentViewProps) {
  return <AppointmentTable {...props} />;
}
