import { useFeatureT } from "../../../layouts/i18n";
import type { AppointmentListItem, AppointmentStatus } from "../../../types/appointments";

const summaryStatuses: Array<[AppointmentStatus, "upcoming" | "checkedIn" | "activeInVisit" | "completed" | "needsReschedule" | "cancelled" | "noShow"]> = [
  ["UPCOMING", "upcoming"], ["CHECKED_IN", "checkedIn"], ["ACTIVE", "activeInVisit"], ["COMPLETED", "completed"], ["NEEDS_RESCHEDULE", "needsReschedule"], ["CANCELLED", "cancelled"], ["NO_SHOW", "noShow"],
];

export function AppointmentCalendarSummary({ view, appointments }: { view: "day" | "week" | "month"; appointments: AppointmentListItem[] }) {
  const t = useFeatureT();
  const title = view === "day" ? t("daySummary") : view === "week" ? t("weekSummary") : t("monthSummary");
  return <aside className="appointment-calendar-summary" aria-label={title}>
    <h2>{title}</h2>
    <dl>
      <div><dt>{t("total")}</dt><dd>{appointments.length}</dd></div>
      {summaryStatuses.map(([status, label]) => <div className={`appointment-summary-status ${status.toLowerCase()}`} key={status}><dt>{t(label)}</dt><dd>{appointments.filter((appointment) => appointment.status === status).length}</dd></div>)}
    </dl>
  </aside>;
}
