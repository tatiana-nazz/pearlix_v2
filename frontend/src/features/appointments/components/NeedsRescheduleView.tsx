import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { AppointmentTable } from "./AppointmentTable";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";

interface NeedsRescheduleViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit: (appointment: AppointmentListItem) => void;
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ role, appointments, onEdit, onDetails }: NeedsRescheduleViewProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">{c.queueDescription}</p>
      <AppointmentTable role={role} appointments={appointments} onEdit={onEdit} onDetails={onDetails} />
    </div>
  );
}
