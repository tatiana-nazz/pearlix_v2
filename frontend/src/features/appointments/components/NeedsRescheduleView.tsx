import type { AppointmentListItem } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { formatAppointmentDateTime } from "../utils/appointmentDates";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { EmptyState } from "../../../components/EmptyState";
import { appointmentStatusClass } from "../utils/appointmentStatusPresentation";

interface NeedsRescheduleViewProps {
  appointments: AppointmentListItem[];
  timezone?: string;
  onDetails: (appointment: AppointmentListItem) => void;
}

export function NeedsRescheduleView({ appointments, timezone, onDetails }: NeedsRescheduleViewProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  return (
    <div className="needs-reschedule-view">
      <p className="panel-note">{c.queueDescription}</p>
      {!appointments.length ? <EmptyState title={c.noAppointments} /> : <div className="table-scroll"><table className="appointment-table"><thead><tr><th>{c.patient}</th><th>{c.doctor}</th><th>{c.time}</th><th>{c.reason}</th><th>{c.status}</th></tr></thead><tbody>{appointments.map((appointment) => <tr key={appointment.id} className={appointmentStatusClass("v2-clickable-row", appointment.status)} data-status={appointment.status} aria-label={`${c.openAppointment} ${appointment.id}`} tabIndex={0} onClick={() => onDetails(appointment)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onDetails(appointment); } }}><td>{appointment.patient.full_name}</td><td>{appointment.doctor.full_name}</td><td>{formatAppointmentDateTime(appointment.start_datetime, language, timezone)}</td><td>{appointment.reschedule_source_label || appointment.reason}</td><td><AppointmentStatusBadge status={appointment.status} /></td></tr>)}</tbody></table></div>}
    </div>
  );
}
