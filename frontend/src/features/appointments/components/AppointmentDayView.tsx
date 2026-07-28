import { formatTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useFeatureT } from "../../../layouts/i18n";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { appointmentRecordClass } from "../utils/appointmentStatusAppearance";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";

interface AppointmentViewProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentDayView(props: AppointmentViewProps) {
  const t = useFeatureT();
  if (!props.appointments.length) return <p className="appointment-calendar-empty">{t("noAppointments")}</p>;
  return <div className="appointment-day-schedule">{props.appointments.map((appointment) => <button key={appointment.id} type="button" className={`appointment-day-block ${appointmentRecordClass(appointment.status)}`} onClick={() => props.onDetails(appointment)}><time className="bidi-isolate">{formatTime(appointment.start_datetime)}</time><span><strong className="bidi-isolate">{appointment.patient.full_name}</strong>{props.role !== "DOCTOR" ? <small className="bidi-isolate">{appointment.doctor.full_name}</small> : null}<small className="bidi-isolate">{displayText(appointment.reason)} · {appointment.duration_minutes} {t("minutes")}</small></span><AppointmentStatusBadge status={appointment.status} /></button>)}</div>;
}
