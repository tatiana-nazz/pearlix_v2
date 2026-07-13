import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDate, formatTime } from "../../../utils/dates";
import { addDays, getWeekRange } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

interface AppointmentWeekViewProps {
  role: UserRole;
  date: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentWeekView({ date, appointments, onDetails }: AppointmentWeekViewProps) {
  const range = getWeekRange(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  return (
    <div className="appointment-week-grid">
      {days.map((day) => (
        <section key={day} className="appointment-calendar-column">
          <h3>{formatDate(`${day}T00:00:00`)}</h3>
          {appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime) === day).map((appointment) => (
            <button key={appointment.id} type="button" className="appointment-calendar-item" onClick={() => onDetails(appointment)}>
              <strong className="bidi-isolate">{formatTime(appointment.start_datetime)}</strong>
              <span className="bidi-isolate">{appointment.patient.full_name}</span>
              <AppointmentStatusBadge status={appointment.status} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
