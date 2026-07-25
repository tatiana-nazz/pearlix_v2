import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentTable } from "./AppointmentTable";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";

interface NeedsRescheduleViewProps {
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ appointments, onDetails }: NeedsRescheduleViewProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">{c.queueDescription}</p>
      <AppointmentTable appointments={appointments} onDetails={onDetails} />
    </div>
  );
}
