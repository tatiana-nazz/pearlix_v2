import type { LucideIcon } from "lucide-react";
import { CalendarClock, CalendarDays, CalendarOff, ContactRound, LayoutDashboard, ReceiptText, ScanLine, ScrollText, Settings, ShieldCheck, Stethoscope, UserRound, UsersRound } from "lucide-react";
import type { UserRole } from "../types/auth";
import type { ShellMessageKey } from "./i18n";

export type NavigationGroup = "workspace" | "clinical" | "administration";
export type NavigationItem = { labelKey: ShellMessageKey; path: string; group: NavigationGroup; icon: LucideIcon };

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { labelKey:"dashboard", path:"/admin/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"team", path:"/admin/team", group:"administration", icon:ContactRound }, { labelKey:"usersAccess", path:"/admin/users", group:"administration", icon:ShieldCheck }, { labelKey:"schedules", path:"/admin/doctors", group:"administration", icon:CalendarClock }, { labelKey:"leaveManagement", path:"/admin/leave", group:"administration", icon:CalendarOff }, { labelKey:"appointments", path:"/admin/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"patients", path:"/admin/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/admin/xrays", group:"clinical", icon:ScanLine }, { labelKey:"billing", path:"/admin/billing", group:"clinical", icon:ReceiptText }, { labelKey:"clinicSettings", path:"/admin/clinic-settings", group:"administration", icon:Settings }, { labelKey:"auditLogs", path:"/admin/audit-logs", group:"administration", icon:ScrollText },
  ],
  STAFF: [
    { labelKey:"dashboard", path:"/staff/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"team", path:"/staff/team", group:"clinical", icon:ContactRound }, { labelKey:"appointments", path:"/staff/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"patients", path:"/staff/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/staff/xrays", group:"clinical", icon:ScanLine }, { labelKey:"billing", path:"/staff/billing?tab=handoffs", group:"clinical", icon:ReceiptText },
  ],
  DOCTOR: [
    { labelKey:"dashboard", path:"/doctor/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"myAppointments", path:"/doctor/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"activeVisit", path:"/doctor/visits/active", group:"clinical", icon:Stethoscope }, { labelKey:"patients", path:"/doctor/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/doctor/xrays", group:"clinical", icon:ScanLine }, { labelKey:"myBillingHandoffs", path:"/doctor/billing/handoffs", group:"clinical", icon:ReceiptText },
  ],
};
