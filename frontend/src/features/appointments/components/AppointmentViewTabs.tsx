import { NavLink } from "react-router-dom";

import type { AppointmentViewMode } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { appointmentViewPath } from "../utils/appointmentPermissions";

interface AppointmentViewTabsProps {
  role: UserRole;
  views: AppointmentViewMode[];
}

const labels: Record<AppointmentViewMode, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  list: "List",
  "needs-reschedule": "Needs Reschedule",
};

export function AppointmentViewTabs({ role, views }: AppointmentViewTabsProps) {
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
