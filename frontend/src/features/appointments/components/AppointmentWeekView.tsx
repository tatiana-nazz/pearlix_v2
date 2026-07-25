import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDate, formatTime } from "../../../utils/dates";
import { addDays, getWeekRange } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
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
  const range = getWeekRange(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  return (
    <div className="appointment-week-grid">
      {days.map((day) => (
        <section key={day} className="appointment-calendar-column">
          <h3><button type="button" onClick={() => onDaySelect(day)} aria-label={`Open day ${formatDate(`${day}T00:00:00`)}`}>{formatDate(`${day}T00:00:00`)}</button></h3>
          {appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime, timezone) === day).map((appointment) => (
            <button key={appointment.id} type="button" className="appointment-calendar-item" onClick={() => onDetails(appointment)}>
              <strong>{formatTime(appointment.start_datetime)}</strong>
              <span>{appointment.patient.full_name}</span>
              <AppointmentStatusBadge status={appointment.status} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
