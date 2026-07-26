import { SurfaceCard } from "../../../components/v2";
import type { AppointmentListItem, AppointmentStatus } from "../../../types/appointments";
import { appointmentStatusLabel } from "../i18n";

export function AppointmentPeriodSummary({ rows, total, language, periodLabel, totalLabel, loadedLabel }: {
  rows: AppointmentListItem[];
  total: number;
  language: "EN" | "AR";
  periodLabel: string;
  totalLabel: string;
  loadedLabel: string;
}) {
  const statuses = Object.entries(rows.reduce<Partial<Record<AppointmentStatus, number>>>((summary, appointment) => {
    summary[appointment.status] = (summary[appointment.status] ?? 0) + 1;
    return summary;
  }, {}));
  return <aside className="appointments-summary-rail" aria-label={periodLabel}><SurfaceCard><h2>{periodLabel}</h2><dl><div><dt>{totalLabel}</dt><dd>{total}</dd></div></dl><p className="appointments-summary-scope">{loadedLabel}</p><dl>{statuses.map(([status, count]) => <div key={status}><dt>{appointmentStatusLabel(language, status as AppointmentStatus)}</dt><dd>{count}</dd></div>)}</dl></SurfaceCard></aside>;
}
