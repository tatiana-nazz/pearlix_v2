import { NavLink } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { roleLabel } from "../utils/roles";

type NavItem = {
  label: string;
  path: string;
  compactLabel: string;
};

const navItems: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", path: "/admin/dashboard", compactLabel: "D" },
    { label: "Users", path: "/admin/users", compactLabel: "U" },
    { label: "Doctors & Staff", path: "/admin/doctors", compactLabel: "DS" },
    { label: "Schedules", path: "/admin/doctors", compactLabel: "S" },
    { label: "Leave", path: "/admin/leave", compactLabel: "L" },
    { label: "Appointments", path: "/admin/appointments", compactLabel: "A" },
    { label: "Patients", path: "/admin/patients", compactLabel: "P" },
    { label: "Billing", path: "/admin/billing", compactLabel: "B" },
    { label: "Clinic Settings", path: "/admin/clinic-settings", compactLabel: "CS" },
    { label: "Audit Logs", path: "/admin/audit-logs", compactLabel: "AL" },
    { label: "Profile", path: "/admin/profile", compactLabel: "PR" },
  ],
  STAFF: [
    { label: "Dashboard", path: "/staff/dashboard", compactLabel: "D" },
    { label: "Appointments", path: "/staff/appointments", compactLabel: "A" },
    { label: "Needs Reschedule", path: "/staff/appointments/needs-reschedule", compactLabel: "NR" },
    { label: "Patients", path: "/staff/patients", compactLabel: "P" },
    { label: "Billing Handoffs", path: "/staff/billing/handoffs", compactLabel: "BH" },
    { label: "Invoices", path: "/staff/billing/invoices", compactLabel: "I" },
    { label: "Payments", path: "/staff/billing/payments", compactLabel: "PY" },
    { label: "Schedules View", path: "/staff/profile/schedule", compactLabel: "SV" },
    { label: "My Leave", path: "/staff/profile/leave", compactLabel: "ML" },
    { label: "Profile", path: "/staff/profile", compactLabel: "PR" },
  ],
  DOCTOR: [
    { label: "Dashboard", path: "/doctor/dashboard", compactLabel: "D" },
    { label: "My Appointments", path: "/doctor/appointments", compactLabel: "MA" },
    { label: "Active Visit", path: "/doctor/visits/active", compactLabel: "AV" },
    { label: "Patients", path: "/doctor/patients", compactLabel: "P" },
    { label: "X-rays & AI", path: "/doctor/xrays", compactLabel: "XA" },
    { label: "External X-ray Workspace", path: "/doctor/external-xrays", compactLabel: "EX" },
    { label: "My Billing Handoffs", path: "/doctor/billing/handoffs", compactLabel: "BH" },
    { label: "My Schedule", path: "/doctor/profile/schedule", compactLabel: "MS" },
    { label: "My Leave", path: "/doctor/profile/leave", compactLabel: "ML" },
    { label: "Profile", path: "/doctor/profile", compactLabel: "PR" },
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
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            aria-label={item.label}
            data-compact-label={item.compactLabel}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
