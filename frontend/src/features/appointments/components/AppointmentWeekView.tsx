import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { addDays, formatAppointmentDate, formatAppointmentTime, getWeekRange } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { appointmentStatusClass } from "../utils/appointmentStatusPresentation";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

interface AppointmentWeekViewProps {
  role: UserRole;
  date: string;
  timezone?: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
  onDaySelect: (date: string) => void;
}

export function AppointmentWeekView({ date, timezone, appointments, onDetails, onDaySelect }: AppointmentWeekViewProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const range = getWeekRange(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  return (
    <div className="appointment-week-grid">
      {days.map((day) => (
        <section key={day} className="appointment-calendar-column" data-date={day} onDoubleClick={(event) => { if (event.target === event.currentTarget) onDaySelect(day); }}>
          <h3><button type="button" onClick={() => onDaySelect(day)} onDoubleClick={(event) => event.stopPropagation()} aria-label={`${c.openDay} ${day}`}>{formatAppointmentDate(day, language, timezone)}</button></h3>
          {appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime, timezone) === day).map((appointment) => (
            <button key={appointment.id} type="button" className={appointmentStatusClass("appointment-calendar-item", appointment.status)} data-status={appointment.status} aria-label={`${c.openAppointment} ${appointment.id}: ${appointment.patient.full_name}`} onClick={() => onDetails(appointment)} onDoubleClick={(event) => event.stopPropagation()}>
              <strong>{formatAppointmentTime(appointment.start_datetime, language, timezone)}</strong>
              <span>{appointment.patient.full_name}</span>
              <AppointmentStatusBadge status={appointment.status} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
