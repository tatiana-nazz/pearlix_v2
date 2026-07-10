import { NavLink } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { roleLabel } from "../utils/roles";

type NavItem = {
  label: string;
  path: string;
};

const navItems: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Users", path: "/admin/users" },
    { label: "Clinic settings", path: "/admin/clinic-settings" },
    { label: "Doctors", path: "/admin/doctors" },
    { label: "Leave", path: "/admin/leave" },
    { label: "Patients", path: "/admin/patients" },
    { label: "Appointments", path: "/admin/appointments" },
    { label: "Needs reschedule", path: "/admin/appointments/needs-reschedule" },
    { label: "Audit logs", path: "/admin/audit-logs" },
  ],
  STAFF: [
    { label: "Dashboard", path: "/staff/dashboard" },
    { label: "Patients", path: "/staff/patients" },
    { label: "Appointments", path: "/staff/appointments" },
    { label: "Needs reschedule", path: "/staff/appointments/needs-reschedule" },
    { label: "Billing handoffs", path: "/staff/billing/handoffs" },
    { label: "Invoices", path: "/staff/billing/invoices" },
    { label: "My schedule", path: "/staff/profile/schedule" },
    { label: "My leave", path: "/staff/profile/leave" },
  ],
  DOCTOR: [
    { label: "Dashboard", path: "/doctor/dashboard" },
    { label: "Appointments", path: "/doctor/appointments" },
    { label: "Needs reschedule", path: "/doctor/appointments/needs-reschedule" },
    { label: "Active visit", path: "/doctor/visits/active" },
    { label: "Patients", path: "/doctor/patients" },
    { label: "External X-rays", path: "/doctor/external-xrays" },
    { label: "My schedule", path: "/doctor/profile/schedule" },
    { label: "My leave", path: "/doctor/profile/leave" },
    { label: "Billing handoffs", path: "/doctor/billing/handoffs" },
  ],
};

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label={`${roleLabel(role)} navigation`}>
      <div className="sidebar-brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>Pearlix</strong>
          <span>{roleLabel(role)} workspace</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems[role].map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
