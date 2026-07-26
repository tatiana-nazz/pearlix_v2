import type { LucideIcon } from "lucide-react";
import { CalendarClock, CalendarDays, CircleUserRound, ImagePlus, LayoutDashboard, ReceiptText, ScanLine, ScrollText, Settings, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import type { UserRole } from "../types/auth";

export type NavigationGroup = "workspace" | "clinical" | "administration" | "personal";
export type NavigationItem = { label: string; path: string; group: NavigationGroup; icon: LucideIcon };

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { label:"Dashboard", path:"/admin/dashboard", group:"workspace", icon:LayoutDashboard }, { label:"Team", path:"/admin/team", group:"administration", icon:UsersRound }, { label:"Users & Access", path:"/admin/users", group:"administration", icon:ShieldCheck }, { label:"Schedules", path:"/admin/doctors", group:"administration", icon:CalendarClock }, { label:"Leave", path:"/admin/leave", group:"administration", icon:CalendarClock }, { label:"Appointments", path:"/admin/appointments", group:"clinical", icon:CalendarDays }, { label:"Patients", path:"/admin/patients", group:"clinical", icon:UsersRound }, { label:"X-rays & AI", path:"/admin/xrays", group:"clinical", icon:ScanLine }, { label:"External X-rays", path:"/admin/external-xrays", group:"clinical", icon:ImagePlus }, { label:"Billing", path:"/admin/billing", group:"clinical", icon:ReceiptText }, { label:"Clinic settings", path:"/admin/clinic-settings", group:"administration", icon:Settings }, { label:"Audit logs", path:"/admin/audit-logs", group:"administration", icon:ScrollText }, { label:"Profile", path:"/admin/profile", group:"personal", icon:CircleUserRound },
  ],
  STAFF: [
    { label:"Dashboard", path:"/staff/dashboard", group:"workspace", icon:LayoutDashboard }, { label:"Appointments", path:"/staff/appointments", group:"clinical", icon:CalendarDays }, { label:"Patients", path:"/staff/patients", group:"clinical", icon:UsersRound }, { label:"X-rays & AI", path:"/staff/xrays", group:"clinical", icon:ScanLine }, { label:"Billing handoffs", path:"/staff/billing/handoffs", group:"clinical", icon:ReceiptText }, { label:"Invoices", path:"/staff/billing/invoices", group:"clinical", icon:ReceiptText }, { label:"My Profile", path:"/staff/profile", group:"personal", icon:CircleUserRound },
  ],
  DOCTOR: [
    { label:"Dashboard", path:"/doctor/dashboard", group:"workspace", icon:LayoutDashboard }, { label:"My appointments", path:"/doctor/appointments", group:"clinical", icon:CalendarDays }, { label:"Active visit", path:"/doctor/visits/active", group:"clinical", icon:Stethoscope }, { label:"Patients", path:"/doctor/patients", group:"clinical", icon:UsersRound }, { label:"X-rays & AI", path:"/doctor/xrays", group:"clinical", icon:ScanLine }, { label:"External X-ray Workspace", path:"/doctor/external-xrays", group:"clinical", icon:ImagePlus }, { label:"My Profile", path:"/doctor/profile", group:"personal", icon:CircleUserRound },
  ],
};
