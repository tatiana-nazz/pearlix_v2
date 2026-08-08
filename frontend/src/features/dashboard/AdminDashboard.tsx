import { Activity, CalendarDays, CircleAlert, FileClock, ReceiptText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { AttentionList, DashboardAppointmentList, DashboardEmpty, DashboardError, DashboardHandoffList, DashboardHeader, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection, SimpleBillingActivityChart, SimpleStatusBarChart } from "./DashboardShared";
import { dashboardCopy } from "./i18n";

export function AdminDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const dashboard = useQuery({ queryKey: ["dashboard", "admin"], queryFn: dashboardApi.admin, staleTime: 15_000, refetchOnWindowFocus: "always", refetchInterval: 30_000 });
  if (dashboard.isLoading) return <DashboardLoading language={language} />;
  if (dashboard.isError) return <DashboardError language={language} onRetry={() => { void dashboard.refetch(); }} />;
  if (!dashboard.data) return <DashboardEmpty language={language} />;
  const data = dashboard.data;
  const dayPath = `/admin/appointments/day?date=${data.clinic_date}`;
  return <main className="dashboard-v2 dashboard-v2-admin" data-role="ADMIN">
    <DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.adminTitle} description={c.adminDescription} />
    <DashboardMetrics count={5}>
      <DashboardMetric tone="blue" icon={<CalendarDays size={21} />} label={c.todaysAppointments} value={data.today_appointments_count} to={dayPath} />
      <DashboardMetric tone="teal" icon={<Activity size={21} />} label={c.activeVisits} value={data.active_visits_count} />
      <DashboardMetric tone="orange" icon={<CircleAlert size={21} />} label={c.needsReschedule} value={data.needs_reschedule_appointments_count} to="/admin/appointments/needs-reschedule" />
      <DashboardMetric tone="violet" icon={<ReceiptText size={21} />} label={c.openBills} value={data.open_bills_count} to="/admin/billing/handoffs?status=OPEN" />
      <DashboardMetric tone="amber" icon={<FileClock size={21} />} label={c.todaysInvoices} value={data.today_invoices_count} to={`/admin/billing/invoices?date_from=${data.clinic_date}&date_to=${data.clinic_date}`} />
    </DashboardMetrics>
    <DashboardSection title={c.attentionRequired} className="dashboard-v2-attention-section"><AttentionList empty={c.noUrgentIssues} items={[
      { label: c.needsReschedule, count: data.needs_reschedule_appointments_count, to: "/admin/appointments/needs-reschedule", tone: "warning" },
      { label: c.openBills, count: data.open_bills_count, to: "/admin/billing/handoffs?status=OPEN", tone: "info" },
      { label: c.partiallyPaidBills, count: data.partially_paid_bills_count, to: "/admin/billing/handoffs?status=PARTIALLY_PAID", tone: "info" },
      { label: c.patientsReady, count: data.checked_in_appointments_count, to: dayPath, tone: "info" },
    ]} /></DashboardSection>
    <div className="dashboard-v2-chart-grid">
      <DashboardSection title={c.appointmentsByStatus} eyebrow={c.last7Days} className="dashboard-v2-chart-card"><SimpleStatusBarChart language={language} counts={data.appointment_status_last_7_days} /></DashboardSection>
      <DashboardSection title={c.billingActivity} eyebrow={c.last30Days} className="dashboard-v2-chart-card"><SimpleBillingActivityChart language={language} days={data.billing_activity_last_30_days} /></DashboardSection>
    </div>
    <div className="dashboard-v2-lower-grid">
      <DashboardSection title={c.todaysAppointments} action={<Link to={dayPath}>{c.viewDay}</Link>}><DashboardAppointmentList language={language} clinicTimezone={data.clinic_timezone} items={data.today_appointments} empty={c.noAppointmentsToday} role="ADMIN" showDoctor limit={7} /></DashboardSection>
      <DashboardSection title={c.recentBills} action={<Link to="/admin/billing/handoffs">{c.viewHandoffHistory}</Link>}><DashboardHandoffList language={language} items={data.recent_handoffs} role="ADMIN" empty={c.noOpenBills} showTotal /></DashboardSection>
    </div>
  </main>;
}
