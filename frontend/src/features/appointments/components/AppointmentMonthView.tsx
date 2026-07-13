import type { AppointmentListItem } from "../../../types/appointments";
import { formatTime } from "../../../utils/dates";
import { getMonthGrid, isDateInMonth } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { useFeatureT } from "../../../layouts/i18n";

interface AppointmentMonthViewProps {
  date: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentMonthView({ date, appointments, onDetails }: AppointmentMonthViewProps) {
  const t = useFeatureT();
  const days = getMonthGrid(date);
  return (
    <div className="appointment-month-grid">
      {days.map((day) => {
        const dayAppointments = appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime) === day);
        return (
          <section key={day} className={isDateInMonth(day, date) ? "appointment-month-cell" : "appointment-month-cell muted"}>
            <h3>{Number(day.slice(8, 10))}</h3>
            {dayAppointments.slice(0, 3).map((appointment) => (
              <button key={appointment.id} type="button" onClick={() => onDetails(appointment)}>
                <span className="bidi-isolate">{formatTime(appointment.start_datetime)} {appointment.patient.full_name}</span>
              </button>
            ))}
            {dayAppointments.length > 3 ? <span className="panel-note bidi-isolate">+{dayAppointments.length - 3} {t("more")}</span> : null}
          </section>
        );
      })}
    </div>
  );
}
