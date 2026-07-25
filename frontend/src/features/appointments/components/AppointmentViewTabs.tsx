import { NavLink } from "react-router-dom";

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
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const labels: Record<AppointmentViewMode, string> = { day: c.day, week: c.week, month: c.month, list: c.list, "needs-reschedule": c.needsReschedule };
  return (
    <nav className="appointment-tabs" aria-label="Appointment views">
      {views.map((view) => (
        <NavLink key={view} to={appointmentViewPath(role, view)} className={({ isActive }) => (isActive ? "active" : "")}>
          {labels[view]}
        </NavLink>
      ))}
    </nav>
  );
}
