import type { LanguagePreference } from "../../types/auth";

const copy = {
  EN: {
    refresh: "Refresh", refreshing: "Refreshing…", retry: "Retry", viewAll: "View all", loading: "Loading dashboard", unavailable: "Dashboard unavailable", noData: "There is no dashboard data yet.",
    adminTitle: "Clinic overview", adminDescription: "Supervisory status for today’s clinic operations.", staffTitle: "Front desk overview", staffDescription: "Today’s patient, appointment, and billing queues.", doctorTitle: "Clinical workspace", doctorDescription: "Your assigned clinical work for today.",
    today: "Today", attention: "Attention required", activity: "Today’s clinic activity", queue: "Today’s appointment queue", schedule: "Today’s schedule", quickActions: "Quick actions", activeVisit: "Active visit", nextPatient: "Next patient", noActiveVisit: "No active visit is in progress.", noAppointments: "No appointments are scheduled.",
    activePatients: "Active patients", appointments: "Today’s appointments", checkedIn: "Checked in", needsReschedule: "Needs reschedule", activeVisits: "Active visits", pendingHandoffs: "Pending handoffs", unpaidInvoices: "Unpaid invoices", completedToday: "Completed today", upcoming: "Upcoming", patientsReady: "Patients ready", clinicSettings: "Clinic settings", team: "Team", users: "Users & Access", schedules: "Doctor schedules", leave: "Leave management", newAppointment: "New appointment", newPatient: "New patient", billing: "Billing", patients: "Patients", activeVisitAction: "Open active visit", appointmentsAction: "Appointments", checkSchedule: "View schedule", noAttention: "No items need attention right now.", noActivity: "No activity is available for today.", noQueue: "No appointments are waiting right now.",
    time: "Time", patient: "Patient", doctor: "Doctor", status: "Status", action: "Action", view: "View", ready: "Ready for visit", open: "Open", current: "Current", next: "Next", noReason: "No reason recorded", visitStarted: "Visit started", statusPrefix: "Status",
  },
  AR: {
    refresh: "تحديث", refreshing: "جارٍ التحديث…", retry: "إعادة المحاولة", viewAll: "عرض الكل", loading: "جارٍ تحميل لوحة التحكم", unavailable: "تعذر تحميل لوحة التحكم", noData: "لا تتوفر بيانات للوحة التحكم بعد.",
    adminTitle: "نظرة عامة على العيادة", adminDescription: "متابعة إشرافية لعمليات العيادة اليوم.", staffTitle: "نظرة عامة على الاستقبال", staffDescription: "قوائم المرضى والمواعيد والفوترة لليوم.", doctorTitle: "مساحة العمل السريرية", doctorDescription: "عملك السريري المكلّف به اليوم.",
    today: "اليوم", attention: "تحتاج إلى متابعة", activity: "نشاط العيادة اليوم", queue: "قائمة مواعيد اليوم", schedule: "جدول اليوم", quickActions: "إجراءات سريعة", activeVisit: "زيارة نشطة", nextPatient: "المريض التالي", noActiveVisit: "لا توجد زيارة نشطة الآن.", noAppointments: "لا توجد مواعيد مجدولة.",
    activePatients: "المرضى النشطون", appointments: "مواعيد اليوم", checkedIn: "تم تسجيل الحضور", needsReschedule: "تحتاج إلى إعادة جدولة", activeVisits: "الزيارات النشطة", pendingHandoffs: "إحالات معلقة", unpaidInvoices: "فواتير غير مدفوعة", completedToday: "المكتمل اليوم", upcoming: "قادم", patientsReady: "مرضى جاهزون", clinicSettings: "إعدادات العيادة", team: "الفريق", users: "المستخدمون والصلاحيات", schedules: "جداول الأطباء", leave: "إدارة الإجازات", newAppointment: "موعد جديد", newPatient: "مريض جديد", billing: "الفوترة", patients: "المرضى", activeVisitAction: "فتح الزيارة النشطة", appointmentsAction: "المواعيد", checkSchedule: "عرض الجدول", noAttention: "لا توجد عناصر تحتاج إلى متابعة الآن.", noActivity: "لا يتوفر نشاط لليوم.", noQueue: "لا توجد مواعيد بانتظار الإجراء الآن.",
    time: "الوقت", patient: "المريض", doctor: "الطبيب", status: "الحالة", action: "الإجراء", view: "عرض", ready: "جاهز للزيارة", open: "فتح", current: "الحالي", next: "التالي", noReason: "لا يوجد سبب مسجل", visitStarted: "بدأت الزيارة", statusPrefix: "الحالة",
  },
} as const;

export type DashboardCopy = { [Key in keyof typeof copy.EN]: string };

export function dashboardCopy(language: LanguagePreference): DashboardCopy {
  return copy[language];
}

const statusLabels: Record<LanguagePreference, Record<string, string>> = {
  EN: { UPCOMING: "Upcoming", CHECKED_IN: "Checked in", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No show", NEEDS_RESCHEDULE: "Needs reschedule", UNPAID: "Unpaid", PARTIALLY_PAID: "Partially paid", PAID: "Paid", PENDING: "Pending", CONVERTED_TO_INVOICE: "Converted to invoice", DISMISSED: "Dismissed", UNAVAILABLE: "Unavailable", AVAILABLE_OVERRIDE: "Available override" },
  AR: { UPCOMING: "قادم", CHECKED_IN: "تم تسجيل الحضور", ACTIVE: "نشط", COMPLETED: "مكتمل", CANCELLED: "ملغى", NO_SHOW: "لم يحضر", NEEDS_RESCHEDULE: "تحتاج إلى إعادة جدولة", UNPAID: "غير مدفوعة", PARTIALLY_PAID: "مدفوعة جزئياً", PAID: "مدفوعة", PENDING: "معلق", CONVERTED_TO_INVOICE: "تم التحويل إلى فاتورة", DISMISSED: "مرفوض", UNAVAILABLE: "غير متاح", AVAILABLE_OVERRIDE: "إتاحة استثنائية" },
};

export function dashboardStatus(language: LanguagePreference, status: string): string {
  return statusLabels[language][status] ?? status.replace(/_/g, " ");
}
