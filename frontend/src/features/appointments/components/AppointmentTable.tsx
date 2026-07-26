import { EmptyState } from "../../../components/EmptyState";
import type { AppointmentListItem } from "../../../types/appointments";
import { displayText } from "../../../utils/formatters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { formatAppointmentDateTime } from "../utils/appointmentDates";

interface AppointmentTableProps {
  appointments: AppointmentListItem[];
  timezone?: string;
  onDetails?: (appointment: AppointmentListItem) => void;
}

export function AppointmentTable({ appointments, timezone, onDetails }: AppointmentTableProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  if (!appointments.length) return <EmptyState title={c.noAppointments} />;

  return (
    <div className="table-scroll">
      <table className="appointment-table">
        <thead>
          <tr>
            <th>{c.time}</th><th>{c.patient}</th><th>{c.doctor}</th><th>{c.reason}</th><th>{c.status}</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
              <tr key={appointment.id} className="v2-clickable-row" tabIndex={onDetails ? 0 : undefined} onClick={() => onDetails?.(appointment)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); onDetails?.(appointment); } }}>
                <td>
                  <strong>{formatAppointmentDateTime(appointment.start_datetime, language, timezone)}</strong>
                  <span className="table-secondary-text">{appointment.duration_minutes} {c.minutes}</span>
                </td>
                <td>{appointment.patient.full_name}</td>
                <td>{appointment.doctor.full_name}</td>
                <td>{displayText(appointment.reason)}</td>
                <td>
                  <AppointmentStatusBadge status={appointment.status} />
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
