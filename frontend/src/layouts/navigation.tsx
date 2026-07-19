import type { LucideIcon } from "lucide-react";
import { CalendarClock, CalendarDays, CalendarOff, ContactRound, ImagePlus, LayoutDashboard, ReceiptText, ScanLine, ScrollText, Settings, ShieldCheck, Stethoscope, UserRound, UsersRound } from "lucide-react";
import type { UserRole } from "../types/auth";
import type { ShellMessageKey } from "./i18n";

export type NavigationGroup = "workspace" | "clinical" | "administration" | "personal";
export type NavigationItem = { labelKey: ShellMessageKey; path: string; group: NavigationGroup; icon: LucideIcon };

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { labelKey:"dashboard", path:"/admin/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"team", path:"/admin/team", group:"administration", icon:ContactRound }, { labelKey:"usersAccess", path:"/admin/users", group:"administration", icon:ShieldCheck }, { labelKey:"schedules", path:"/admin/doctors", group:"administration", icon:CalendarClock }, { labelKey:"leave", path:"/admin/leave", group:"administration", icon:CalendarOff }, { labelKey:"appointments", path:"/admin/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"patients", path:"/admin/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/admin/xrays", group:"clinical", icon:ScanLine }, { labelKey:"externalXrays", path:"/admin/external-xrays", group:"clinical", icon:ImagePlus }, { labelKey:"billing", path:"/admin/billing", group:"clinical", icon:ReceiptText }, { labelKey:"clinicSettings", path:"/admin/clinic-settings", group:"administration", icon:Settings }, { labelKey:"auditLogs", path:"/admin/audit-logs", group:"administration", icon:ScrollText }, { labelKey:"myProfile", path:"/admin/profile", group:"personal", icon:UserRound },
  ],
  STAFF: [
    { labelKey:"dashboard", path:"/staff/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"appointments", path:"/staff/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"needsReschedule", path:"/staff/appointments/needs-reschedule", group:"clinical", icon:CalendarClock }, { labelKey:"patients", path:"/staff/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/staff/xrays", group:"clinical", icon:ScanLine }, { labelKey:"billingHandoffs", path:"/staff/billing/handoffs", group:"clinical", icon:ReceiptText }, { labelKey:"invoices", path:"/staff/billing/invoices", group:"clinical", icon:ReceiptText }, { labelKey:"myProfile", path:"/staff/profile", group:"personal", icon:UserRound }, { labelKey:"schedule", path:"/staff/profile/schedule", group:"personal", icon:CalendarClock }, { labelKey:"leave", path:"/staff/profile/leave", group:"personal", icon:CalendarOff },
  ],
  DOCTOR: [
    { labelKey:"dashboard", path:"/doctor/dashboard", group:"workspace", icon:LayoutDashboard }, { labelKey:"myAppointments", path:"/doctor/appointments", group:"clinical", icon:CalendarDays }, { labelKey:"activeVisit", path:"/doctor/visits/active", group:"clinical", icon:Stethoscope }, { labelKey:"patients", path:"/doctor/patients", group:"clinical", icon:UsersRound }, { labelKey:"xraysAi", path:"/doctor/xrays", group:"clinical", icon:ScanLine }, { labelKey:"externalXrayWorkspace", path:"/doctor/external-xrays", group:"clinical", icon:ImagePlus }, { labelKey:"myBillingHandoffs", path:"/doctor/billing/handoffs", group:"clinical", icon:ReceiptText }, { labelKey:"myProfile", path:"/doctor/profile", group:"personal", icon:UserRound }, { labelKey:"schedule", path:"/doctor/profile/schedule", group:"personal", icon:CalendarClock }, { labelKey:"leave", path:"/doctor/profile/leave", group:"personal", icon:CalendarOff },
  ],
};
