import type { AppointmentListItem } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { formatTime } from "../../../utils/dates";
import { appointmentCopy, appointmentStatusLabel } from "../i18n";
import { getMonthGrid, isDateInMonth } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { appointmentMonthStatusClass } from "../utils/appointmentStatusPresentation";

interface AppointmentMonthViewProps {
  date: string;
  timezone?: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
  onDaySelect: (date: string) => void;
}

export function AppointmentMonthView({ date, timezone, appointments, onDetails, onDaySelect }: AppointmentMonthViewProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const days = getMonthGrid(date);
  const today = dateFromAppointment(new Date().toISOString(), timezone);
  const weekdayHeadings = days.slice(0, 7).map((day) => new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: timezone }).format(new Date(`${day}T12:00:00Z`)));
  return (
    <div className="appointment-month-grid">
      {weekdayHeadings.map((weekday) => <div className="appointment-month-weekday" key={weekday}>{weekday}</div>)}
      {days.map((day) => {
        const dayAppointments = appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime, timezone) === day);
        return (
          <section key={day} className={["appointment-month-cell", isDateInMonth(day, date) ? "" : "muted", day === today ? "today" : "", day === date ? "selected-day" : ""].filter(Boolean).join(" ")}>
            <h3><button className="appointment-month-date" type="button" onClick={() => onDaySelect(day)} aria-label={`Open day ${day}`} aria-current={day === today ? "date" : undefined}>{Number(day.slice(8, 10))}</button></h3>
            {dayAppointments.slice(0, 3).map((appointment) => (
              <button
                key={appointment.id}
                className={appointmentMonthStatusClass(appointment.status)}
                data-status={appointment.status}
                type="button"
                aria-label={`${formatTime(appointment.start_datetime)}, ${appointment.patient.full_name}, ${appointmentStatusLabel(language, appointment.status)}`}
                onClick={() => onDetails(appointment)}
              >
                <span className="appointment-month-time">{formatTime(appointment.start_datetime)}</span>
                <span className="appointment-month-patient">{appointment.patient.full_name}</span>
                <span className="appointment-month-status">{appointmentStatusLabel(language, appointment.status)}</span>
              </button>
            ))}
            {dayAppointments.length > 3 ? <button className="appointment-month-more" type="button" onClick={() => onDaySelect(day)} aria-label={`+${dayAppointments.length - 3} ${c.more}`}>+{dayAppointments.length - 3} {c.more}</button> : null}
          </section>
        );
      })}
    </div>
  );
}
