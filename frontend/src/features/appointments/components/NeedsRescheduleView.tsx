import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { AppointmentTable } from "./AppointmentTable";

interface NeedsRescheduleViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit: (appointment: AppointmentListItem) => void;
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ role, appointments, onEdit, onDetails }: NeedsRescheduleViewProps) {
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">Appointments affected by leave, unavailable periods, or shift changes appear here as a full-width worklist.</p>
      <AppointmentTable role={role} appointments={appointments} onEdit={onEdit} onDetails={onDetails} />
    </div>
  );
}
