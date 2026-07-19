import { NavLink, useLocation } from "react-router-dom";

import type { AppointmentViewMode } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { appointmentViewPath } from "../utils/appointmentPermissions";
import { useFeatureT } from "../../../layouts/i18n";

interface AppointmentViewTabsProps {
  role: UserRole;
  views: AppointmentViewMode[];
}

export function AppointmentViewTabs({ role, views }: AppointmentViewTabsProps) {
  const t = useFeatureT();
  const location = useLocation();
  const labels: Record<AppointmentViewMode, string> = { day: t("day"), week: t("week"), month: t("month"), list: t("list"), "needs-reschedule": t("needsReschedule") };
  return (
    <nav className="appointment-tabs" aria-label={t("appointmentViews")}>
      {views.map((view) => (
        <NavLink key={view} to={{ pathname: appointmentViewPath(role, view), search: location.search }} className={({ isActive }) => (isActive ? "active" : "")}>
          {labels[view]}
        </NavLink>
      ))}
    </nav>
  );
}
