import type { LanguagePreference } from "../../types/auth";

const copy = {
  EN: {
    retry: "Retry", loading: "Loading dashboard", unavailable: "Dashboard unavailable", noData: "There is no dashboard data yet.",
    adminTitle: "Dashboard", adminDescription: "Clinic operational overview.", staffTitle: "Staff dashboard", staffDescription: "Operational clinic queue.", doctorTitle: "Doctor dashboard", doctorDescription: "Clinical schedule and active work.",
    today: "Today", todaysAppointments: "Today's appointments", activeVisits: "Active visits", needsReschedule: "Needs reschedule", pendingHandoffs: "Invoices today", openInvoices: "Open bills", openBills: "Open bills", partiallyPaidBills: "Partially paid bills", patientsReady: "Patients ready", pendingBilling: "Open bills", completedToday: "Completed today", todaysInvoices: "Today's invoices",
    attentionRequired: "Attention required", noUrgentIssues: "No urgent operational issues.", appointmentsByStatus: "Appointments by status", last7Days: "Last 7 days", billingActivity: "Billing activity", last30Days: "Last 30 days", invoiced: "Billed", billed: "Billed", collected: "Collected", noBillingActivity: "No billing activity in this period.",
    recentInvoices: "Recent bills", recentBills: "Recent bills", viewInvoiceHistory: "View Handoff history", viewHandoffHistory: "View Handoff history", viewDay: "View day", viewBilling: "View billing", todaysQueue: "Today's appointment queue", todaysSchedule: "Today's schedule", noAppointmentsToday: "No appointments scheduled today.", openInvoicesFollowUp: "Bills requiring payment follow-up", billsFollowUp: "Bills requiring payment follow-up", noOpenInvoices: "No bills need payment follow-up.", noOpenBills: "No bills need payment follow-up.",
    activeVisit: "Active visit", continueVisit: "Continue visit", noActiveVisit: "No active visit.", nextPatient: "Next patient", noMorePatients: "No more scheduled patients today.", ready: "Ready", next: "Next", openAppointment: "Open appointment", started: "Started", appointmentContext: "Appointment",
    newAppointment: "New appointment", newPatient: "New patient", noReason: "No reason recorded", total: "Total", balance: "Remaining", status: "Status", patient: "Patient", doctor: "Doctor", invoice: "Invoice", bill: "Bill",
  },
  AR: {
    retry: "إعادة المحاولة", loading: "جارٍ تحميل لوحة التحكم", unavailable: "تعذر تحميل لوحة التحكم", noData: "لا تتوفر بيانات للوحة التحكم بعد.",
    adminTitle: "لوحة التحكم", adminDescription: "نظرة تشغيلية عامة على العيادة.", staffTitle: "لوحة موظفي الاستقبال", staffDescription: "قائمة العمليات اليومية للعيادة.", doctorTitle: "لوحة الطبيب", doctorDescription: "الجدول السريري والعمل النشط.",
    today: "اليوم", todaysAppointments: "مواعيد اليوم", activeVisits: "الزيارات النشطة", needsReschedule: "تحتاج إلى إعادة جدولة", pendingHandoffs: "فواتير اليوم", openInvoices: "الفواتير المفتوحة", openBills: "الفواتير المفتوحة", partiallyPaidBills: "الفواتير المدفوعة جزئياً", patientsReady: "المرضى الجاهزون", pendingBilling: "الفواتير المفتوحة", completedToday: "المكتمل اليوم", todaysInvoices: "فواتير اليوم",
    attentionRequired: "تحتاج إلى متابعة", noUrgentIssues: "لا توجد مسائل تشغيلية عاجلة.", appointmentsByStatus: "المواعيد حسب الحالة", last7Days: "آخر 7 أيام", billingActivity: "نشاط الفوترة", last30Days: "آخر 30 يوماً", invoiced: "المفوتر", billed: "المفوتر", collected: "المحصل", noBillingActivity: "لا يوجد نشاط فوترة في هذه الفترة.",
    recentInvoices: "أحدث الفواتير", recentBills: "أحدث الفواتير", viewInvoiceHistory: "عرض سجل الفواتير", viewHandoffHistory: "عرض سجل الفواتير", viewDay: "عرض اليوم", viewBilling: "عرض الفوترة", todaysQueue: "قائمة مواعيد اليوم", todaysSchedule: "جدول اليوم", noAppointmentsToday: "لا توجد مواعيد مجدولة اليوم.", openInvoicesFollowUp: "الفواتير التي تحتاج متابعة دفع", billsFollowUp: "الفواتير التي تحتاج متابعة دفع", noOpenInvoices: "لا توجد فواتير تحتاج متابعة دفع.", noOpenBills: "لا توجد فواتير تحتاج متابعة دفع.",
    activeVisit: "الزيارة النشطة", continueVisit: "متابعة الزيارة", noActiveVisit: "لا توجد زيارة نشطة.", nextPatient: "المريض التالي", noMorePatients: "لا يوجد مرضى مجدولون آخرون اليوم.", ready: "جاهز", next: "التالي", openAppointment: "فتح الموعد", started: "بدأت", appointmentContext: "الموعد",
    newAppointment: "موعد جديد", newPatient: "مريض جديد", noReason: "لا يوجد سبب مسجل", total: "الإجمالي", balance: "المتبقي", status: "الحالة", patient: "المريض", doctor: "الطبيب", invoice: "الفاتورة", bill: "الفاتورة",
  },
} as const;

export type DashboardCopy = { [Key in keyof typeof copy.EN]: string };
export function dashboardCopy(language: LanguagePreference): DashboardCopy { return copy[language]; }

const statusLabels: Record<LanguagePreference, Record<string, string>> = {
  EN: { UPCOMING: "Upcoming", CHECKED_IN: "Checked in", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No show", NEEDS_RESCHEDULE: "Needs reschedule", OPEN: "Open", PARTIALLY_PAID: "Partially paid", PAID: "Paid" },
  AR: { UPCOMING: "قادم", CHECKED_IN: "تم تسجيل الحضور", ACTIVE: "نشط", COMPLETED: "مكتمل", CANCELLED: "ملغى", NO_SHOW: "لم يحضر", NEEDS_RESCHEDULE: "تحتاج إلى إعادة جدولة", OPEN: "مفتوح", PARTIALLY_PAID: "مدفوع جزئياً", PAID: "مدفوع" },
};
export function dashboardStatus(language: LanguagePreference, status: string): string { return statusLabels[language][status] ?? status.replace(/_/g, " "); }
