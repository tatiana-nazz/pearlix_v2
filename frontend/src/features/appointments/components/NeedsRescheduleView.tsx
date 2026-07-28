import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { AppointmentTable } from "./AppointmentTable";
import { useFeatureT } from "../../../layouts/i18n";

interface NeedsRescheduleViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ role, appointments, onDetails }: NeedsRescheduleViewProps) {
  const t = useFeatureT();
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">{t("affectedAppointments")}</p>
      <AppointmentTable role={role} appointments={appointments} onDetails={onDetails} />
    </div>
  );
}
