import { ChevronLeft, ChevronRight } from "lucide-react";

import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { AppointmentViewMode } from "../../../types/appointments";
import { useFeatureT } from "../../../layouts/i18n";
import { calendarPeriodLabel } from "../utils/appointmentDates";
import { AppointmentViewTabs } from "./AppointmentViewTabs";

interface AppointmentCalendarToolbarProps {
  role: UserRole;
  view: AppointmentViewMode;
  views: AppointmentViewMode[];
  date: string;
  canCreate: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: () => void;
}

export function AppointmentCalendarToolbar({ role, view, views, date, canCreate, onPrevious, onNext, onToday, onCreate }: AppointmentCalendarToolbarProps) {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const calendarView = view === "day" || view === "week" || view === "month" ? view : null;
  const previousLabel = calendarView === "day" ? t("previousDay") : calendarView === "week" ? t("previousWeek") : t("previousMonth");
  const nextLabel = calendarView === "day" ? t("nextDay") : calendarView === "week" ? t("nextWeek") : t("nextMonth");

  return <section className="appointment-calendar-toolbar">
    <AppointmentViewTabs role={role} views={views} />
    {calendarView ? <div className="appointment-period-controls" aria-label={t("calendarNavigation")}>
      <button className="button secondary calendar-nav calendar-nav-prev" type="button" aria-label={previousLabel} title={previousLabel} onClick={onPrevious}><ChevronLeft aria-hidden="true" size={18} /></button>
      <strong className="appointment-period-label" aria-live="polite">{calendarPeriodLabel(date, calendarView, language === "AR" ? "ar" : "en")}</strong>
      <button className="button secondary calendar-nav calendar-nav-next" type="button" aria-label={nextLabel} title={nextLabel} onClick={onNext}><ChevronRight aria-hidden="true" size={18} /></button>
      <button className="button secondary" type="button" onClick={onToday}>{t("today")}</button>
    </div> : null}
    {canCreate ? <button className="button primary" type="button" onClick={onCreate}>{t("addAppointment")}</button> : null}
  </section>;
}
