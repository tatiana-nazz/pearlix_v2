import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { AppointmentTable } from "./AppointmentTable";
import { useFeatureT } from "../../../layouts/i18n";

interface NeedsRescheduleViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit: (appointment: AppointmentListItem) => void;
  onReschedule: (appointment: AppointmentListItem) => void;
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ role, appointments, onEdit, onReschedule, onDetails }: NeedsRescheduleViewProps) {
  const t = useFeatureT();
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">{t("affectedAppointments")}</p>
      <AppointmentTable role={role} appointments={appointments} onEdit={onEdit} onReschedule={onReschedule} onDetails={onDetails} />
    </div>
  );
}
