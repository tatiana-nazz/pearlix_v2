import type { AppointmentListItem } from "../../../types/appointments";
import { formatDate, formatTime } from "../../../utils/dates";
import { getMonthGrid, isDateInMonth } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { useFeatureT } from "../../../layouts/i18n";
import { useAuthStore } from "../../../auth/authStore";

interface AppointmentMonthViewProps {
  date: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
  onSelectDay: (date: string) => void;
  onOpenDay: (date: string) => void;
}

export function AppointmentMonthView({ date, appointments, onDetails, onSelectDay, onOpenDay }: AppointmentMonthViewProps) {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const days = getMonthGrid(date);
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "short" }).format(new Date(2024, 0, index + 1)));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="appointment-calendar-scroll" data-calendar-scroll="month"><div className="appointment-month-grid"><div className="appointment-month-weekdays">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
      {days.map((day) => {
        const dayAppointments = appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime) === day).sort((left, right) => left.start_datetime.localeCompare(right.start_datetime));
        return (
          <section key={day} tabIndex={0} role="button" aria-label={`${day === date ? `${t("selectedDay")}: ` : ""}${t("viewDay")}: ${formatDate(`${day}T00:00:00`) || day}`} className={`${isDateInMonth(day, date) ? "appointment-month-cell" : "appointment-month-cell muted"} ${day === date ? "selected" : ""} ${day === today ? "today" : ""}`} onClick={() => onSelectDay(day)} onDoubleClick={() => onOpenDay(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenDay(day); } }}>
            <div className="appointment-month-cell-heading"><h3>{Number(day.slice(8, 10))}</h3><span aria-label={`${dayAppointments.length} ${t("calendarAppointmentCount")}`}>{dayAppointments.length}</span></div>
            {dayAppointments.slice(0, 3).map((appointment) => (
              <button key={appointment.id} type="button" onClick={(event) => { event.stopPropagation(); onDetails(appointment); }}>
                <span className="bidi-isolate">{formatTime(appointment.start_datetime)} {appointment.patient.full_name}</span>
              </button>
            ))}
            {dayAppointments.length > 3 ? <span className="panel-note bidi-isolate">+{dayAppointments.length - 3} {t("more")}</span> : null}
          </section>
        );
      })}
    </div></div>
  );
}
