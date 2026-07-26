import { NavLink, useLocation } from "react-router-dom";

import type { AppointmentViewMode } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { appointmentViewPath } from "../utils/appointmentPermissions";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";

interface AppointmentViewTabsProps {
  role: UserRole;
  views: AppointmentViewMode[];
}

export function AppointmentViewTabs({ role, views }: AppointmentViewTabsProps) {
  const location = useLocation();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const labels: Record<AppointmentViewMode, string> = { day: c.day, week: c.week, month: c.month, list: c.list, "needs-reschedule": c.needsReschedule };
  return (
    <nav className="appointment-tabs" aria-label="Appointment views">
      {views.map((view) => (
        <NavLink key={view} to={`${appointmentViewPath(role, view)}${withoutCalendarView(location.search)}`} className={({ isActive }) => (isActive ? "active" : "")}>
          {labels[view]}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppointmentWorkspaceTabs({ role, queue, view }: { role: UserRole; queue: boolean; view: AppointmentViewMode }) {
  const location = useLocation();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  return (
    <nav className="appointment-workspace-tabs" aria-label={c.workspaceViews}>
      <NavLink className={!queue ? "active" : ""} to={`${appointmentViewPath(role, rememberedCalendarView(location.search))}${withoutCalendarView(location.search)}`}>{c.calendar}</NavLink>
      <NavLink className={queue ? "active" : ""} to={`${appointmentViewPath(role, "needs-reschedule")}${withCalendarView(location.search, view)}`}>{c.rescheduleQueue}</NavLink>
    </nav>
  );
}

function parsed(search: string) { return new URLSearchParams(search); }
function asSearch(params: URLSearchParams) { const value = params.toString(); return value ? `?${value}` : ""; }
function withoutCalendarView(search: string) { const params = parsed(search); params.delete("calendar_view"); return asSearch(params); }
function withCalendarView(search: string, view: AppointmentViewMode) { const params = parsed(search); if (view !== "needs-reschedule") params.set("calendar_view", view); return asSearch(params); }
function rememberedCalendarView(search: string): Exclude<AppointmentViewMode, "needs-reschedule"> {
  const value = parsed(search).get("calendar_view");
  return value === "day" || value === "month" || value === "list" || value === "week" ? value : "week";
}
