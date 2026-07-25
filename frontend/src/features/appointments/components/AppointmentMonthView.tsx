import type { AppointmentListItem } from "../../../types/appointments";
import { formatTime } from "../../../utils/dates";
import { getMonthGrid, isDateInMonth } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";

interface AppointmentMonthViewProps {
  date: string;
  timezone?: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
  onDaySelect: (date: string) => void;
}

export function AppointmentMonthView({ date, timezone, appointments, onDetails, onDaySelect }: AppointmentMonthViewProps) {
  const days = getMonthGrid(date);
  return (
    <div className="appointment-month-grid">
      {days.map((day) => {
        const dayAppointments = appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime, timezone) === day);
        return (
          <section key={day} className={isDateInMonth(day, date) ? "appointment-month-cell" : "appointment-month-cell muted"}>
            <h3><button type="button" onClick={() => onDaySelect(day)} aria-label={`Open day ${day}`}>{Number(day.slice(8, 10))}</button></h3>
            {dayAppointments.slice(0, 3).map((appointment) => (
              <button key={appointment.id} type="button" onClick={() => onDetails(appointment)}>
                {formatTime(appointment.start_datetime)} {appointment.patient.full_name}
              </button>
            ))}
            {dayAppointments.length > 3 ? <span className="panel-note">+{dayAppointments.length - 3} more</span> : null}
          </section>
        );
      })}
    </div>
  );
}
