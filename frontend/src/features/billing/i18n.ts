import type { LanguagePreference } from "../../types/auth";

const copy = {
  EN: {
    adminWorkspace: "Admin workspace", staffWorkspace: "Staff workspace", billing: "Billing",
    billingDescription: "Bills, collections, and issued payment invoices in one financial workspace.",
    overview: "Overview", handoffs: "Handoffs", invoices: "Invoices", newBill: "New bill",
    overviewTitle: "Billing overview", overviewDescription: "Current obligations and collected payments without mixing currencies.",
    openBills: "Open bills", partiallyPaidBills: "Partially paid bills", invoicesToday: "Invoices today", collectedToday: "Collected today",
    outstandingByCurrency: "Outstanding by currency", recentBills: "Recent bills", recentInvoices: "Recent invoices", viewAll: "View all",
    historyTitle: "Invoice history", historyDescription: "Completed payment receipts issued against bills.",
    handoffHistoryTitle: "Handoff history", handoffHistoryDescription: "Complete bill history, including paid and cancelled obligations.",
    search: "Search", searchBills: "Patient, doctor, treatment, or bill reference", searchInvoices: "Invoice number or patient",
    status: "Status", currency: "Currency", allStatuses: "All statuses", allCurrencies: "All currencies", clearFilters: "Clear filters",
    today: "Today", last7: "7 days", last30: "30 days", allTime: "All time", custom: "Custom", from: "From", to: "To", period: "Period",
    patient: "Patient", treatment: "Treatment", doctor: "Doctor", billTotal: "Bill total", paid: "Paid", remaining: "Remaining", created: "Created",
    invoiceNumber: "Invoice #", handoff: "Handoff", paymentDate: "Payment date", amount: "Amount", issuedBy: "Issued by",
    records: "records", page: "Page", previous: "Previous", next: "Next", noBills: "No bills found.", noInvoices: "No invoices found.",
    loading: "Loading billing data…", unavailable: "Billing data is unavailable.",
  },
  AR: {
    adminWorkspace: "مساحة عمل المدير", staffWorkspace: "مساحة عمل الموظف", billing: "الفوترة",
    billingDescription: "الفواتير المستحقة والتحصيل وإيصالات الدفع في مساحة مالية واحدة.",
    overview: "نظرة عامة", handoffs: "الفواتير المستحقة", invoices: "إيصالات الدفع", newBill: "فاتورة مستحقة جديدة",
    overviewTitle: "نظرة عامة على الفوترة", overviewDescription: "الالتزامات الحالية والمدفوعات المحصلة دون دمج العملات.",
    openBills: "الفواتير المفتوحة", partiallyPaidBills: "المدفوعة جزئياً", invoicesToday: "إيصالات اليوم", collectedToday: "المحصل اليوم",
    outstandingByCurrency: "المتبقي حسب العملة", recentBills: "أحدث الفواتير المستحقة", recentInvoices: "أحدث إيصالات الدفع", viewAll: "عرض الكل",
    historyTitle: "سجل إيصالات الدفع", historyDescription: "إيصالات المدفوعات المكتملة والصادرة مقابل الفواتير المستحقة.",
    handoffHistoryTitle: "سجل الفواتير المستحقة", handoffHistoryDescription: "السجل المالي الكامل بما فيه المدفوع والملغى.",
    search: "بحث", searchBills: "المريض أو الطبيب أو العلاج أو مرجع الفاتورة", searchInvoices: "رقم الإيصال أو المريض",
    status: "الحالة", currency: "العملة", allStatuses: "كل الحالات", allCurrencies: "كل العملات", clearFilters: "مسح عوامل التصفية",
    today: "اليوم", last7: "7 أيام", last30: "30 يوماً", allTime: "كل الوقت", custom: "مخصص", from: "من", to: "إلى", period: "الفترة",
    patient: "المريض", treatment: "العلاج", doctor: "الطبيب", billTotal: "إجمالي الفاتورة", paid: "المدفوع", remaining: "المتبقي", created: "تاريخ الإنشاء",
    invoiceNumber: "رقم الإيصال", handoff: "الفاتورة المستحقة", paymentDate: "تاريخ الدفع", amount: "المبلغ", issuedBy: "أصدره",
    records: "سجلات", page: "الصفحة", previous: "السابق", next: "التالي", noBills: "لا توجد فواتير مستحقة.", noInvoices: "لا توجد إيصالات دفع.",
    loading: "جارٍ تحميل بيانات الفوترة…", unavailable: "تعذر تحميل بيانات الفوترة.",
  },
} as const;

export type BillingCopy = { [Key in keyof typeof copy.EN]: string };
export function billingCopy(language: LanguagePreference = "EN"): BillingCopy { return copy[language]; }

export function billingStatusLabel(language: LanguagePreference, status: string): string {
  const labels = language === "AR"
    ? { OPEN: "مفتوح", PARTIALLY_PAID: "مدفوع جزئياً", PAID: "مدفوع", CANCELLED: "ملغى" }
    : { OPEN: "Open", PARTIALLY_PAID: "Partially paid", PAID: "Paid", CANCELLED: "Cancelled" };
  return labels[status as keyof typeof labels] ?? status.replace(/_/g, " ").toLowerCase();
}
