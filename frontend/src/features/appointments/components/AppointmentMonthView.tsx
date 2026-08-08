import type { AppointmentListItem } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy, appointmentStatusLabel } from "../i18n";
import { formatAppointmentTime, getMonthGrid, isDateInMonth } from "../utils/appointmentDates";
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
          <section key={day} data-date={day} className={["appointment-month-cell", isDateInMonth(day, date) ? "" : "muted", day === today ? "today" : "", day === date ? "selected-day" : ""].filter(Boolean).join(" ")} onDoubleClick={(event) => { if (event.target === event.currentTarget) onDaySelect(day); }}>
            <h3><button className="appointment-month-date" type="button" onClick={() => onDaySelect(day)} onDoubleClick={(event) => event.stopPropagation()} aria-label={`${c.openDay} ${day}`} aria-current={day === today ? "date" : undefined}>{Number(day.slice(8, 10))}</button></h3>
            {dayAppointments.slice(0, 3).map((appointment) => (
              <button
                key={appointment.id}
                className={appointmentMonthStatusClass(appointment.status)}
                data-status={appointment.status}
                type="button"
                aria-label={`${c.openAppointment} ${appointment.id}: ${formatAppointmentTime(appointment.start_datetime, language, timezone)}, ${appointment.patient.full_name}, ${appointmentStatusLabel(language, appointment.status)}`}
                onClick={() => onDetails(appointment)}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <span className="appointment-month-time">{formatAppointmentTime(appointment.start_datetime, language, timezone)}</span>
                <span className="appointment-month-patient">{appointment.patient.full_name}</span>
                <span className="appointment-month-status">{appointmentStatusLabel(language, appointment.status)}</span>
              </button>
            ))}
            {dayAppointments.length > 3 ? <button className="appointment-month-more" type="button" onClick={() => onDaySelect(day)} onDoubleClick={(event) => event.stopPropagation()} aria-label={`+${dayAppointments.length - 3} ${c.more}`}>+{dayAppointments.length - 3} {c.more}</button> : null}
          </section>
        );
      })}
    </div>
  );
}
