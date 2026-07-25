import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { Modal } from "../../../components/v2";
import type { AppointmentListItem } from "../../../types/appointments";
import { displayText } from "../../../utils/formatters";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { formatAppointmentDateTime } from "../utils/appointmentDates";

interface AppointmentDetailsDialogProps {
  appointment: AppointmentListItem | null;
  timezone?: string;
  onClose: () => void;
}

export function AppointmentDetailsDialog({ appointment, timezone, onClose }: AppointmentDetailsDialogProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  if (!appointment) return null;
  return (
      <Modal open title={c.details} onClose={onClose}>
        <div>
          <p className="eyebrow">{c.details}</p>
          <h3>{appointment.patient.full_name}</h3>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>{c.time}</dt>
            <dd>{formatAppointmentDateTime(appointment.start_datetime, language)} – {formatAppointmentDateTime(appointment.end_datetime, language)}</dd>
          </div>
          <div>
            <dt>{c.status}</dt>
            <dd>
              <AppointmentStatusBadge status={appointment.status} />
            </dd>
          </div>
          <div>
            <dt>{c.doctor}</dt>
            <dd>{appointment.doctor.full_name}</dd>
          </div>
          <div>
            <dt>{c.reason}</dt>
            <dd>{displayText(appointment.reason)}</dd>
          </div>
          <div><dt>{c.created}</dt><dd>{formatAppointmentDateTime(appointment.created_at, language, timezone)}</dd></div>
          <div><dt>{c.updated}</dt><dd>{formatAppointmentDateTime(appointment.updated_at, language, timezone)}</dd></div>
        </dl>
      </Modal>
  );
}
