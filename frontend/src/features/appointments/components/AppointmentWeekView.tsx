import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDate, formatTime } from "../../../utils/dates";
import { addDays, getWeekRange } from "../utils/appointmentDates";
import { dateFromAppointment } from "../utils/appointmentFilters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { useFeatureT } from "../../../layouts/i18n";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentRecordClass } from "../utils/appointmentStatusAppearance";

interface AppointmentWeekViewProps {
  role: UserRole;
  date: string;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
  onSelectDay: (date: string) => void;
  onOpenDay: (date: string) => void;
}

export function AppointmentWeekView({ role, date, appointments, onDetails, onSelectDay, onOpenDay }: AppointmentWeekViewProps) {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const range = getWeekRange(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="appointment-calendar-scroll" data-calendar-scroll="week"><div className="appointment-week-grid">
      {days.map((day) => (
        <section key={day} className={`appointment-calendar-column ${day === date ? "selected" : ""} ${day === today ? "today" : ""}`}>
          <button className="appointment-calendar-day-header" type="button" aria-label={`${t("openAppointmentsForDate")} ${formatDate(`${day}T00:00:00`)}`} onClick={() => onSelectDay(day)} onDoubleClick={() => onOpenDay(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenDay(day); } }}>
            <span>{new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "short" }).format(new Date(`${day}T00:00:00`))}</span><strong>{Number(day.slice(8, 10))}</strong>
          </button>
          {appointments.filter((appointment) => dateFromAppointment(appointment.start_datetime) === day).map((appointment) => (
            <button key={appointment.id} type="button" className={`appointment-calendar-item ${appointmentRecordClass(appointment.status)}`} onClick={(event) => { event.stopPropagation(); onDetails(appointment); }}>
              <strong className="bidi-isolate">{formatTime(appointment.start_datetime)}</strong>
              <span className="bidi-isolate">{appointment.patient.full_name}</span>
              {role !== "DOCTOR" ? <small className="bidi-isolate">{appointment.doctor.full_name}</small> : null}
              <AppointmentStatusBadge status={appointment.status} />
            </button>
          ))}
          {!appointments.some((appointment) => dateFromAppointment(appointment.start_datetime) === day) ? <p className="appointment-calendar-empty">{t("noAppointments")}</p> : null}
        </section>
      ))}
    </div></div>
  );
}
