import { CalendarCheck2, CalendarDays, CircleAlert, ReceiptText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { AttentionList, DashboardAppointmentList, DashboardEmpty, DashboardError, DashboardHeader, DashboardInvoiceList, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection } from "./DashboardShared";
import { dashboardCopy } from "./i18n";

export function StaffDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const query = useQuery({ queryKey: ["dashboard", "staff"], queryFn: dashboardApi.staff, staleTime: 30_000 });
  if (query.isLoading) return <DashboardLoading language={language} />;
  if (query.isError) return <DashboardError language={language} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DashboardEmpty language={language} />;
  const data = query.data;
  const dayPath = `/staff/appointments/day?date=${data.clinic_date}`;
  return <main className="dashboard-v2 dashboard-v2-staff" data-role="STAFF">
    <DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.staffTitle} description={c.staffDescription} actions={<><Link className="v2-button" to="/staff/appointments/day">{c.newAppointment}</Link><Link className="v2-button secondary" to="/staff/patients/new">{c.newPatient}</Link></>} />
    <DashboardMetrics>
      <DashboardMetric tone="blue" icon={<CalendarDays size={21} />} label={c.todaysAppointments} value={data.today_appointments_count} to={dayPath} />
      <DashboardMetric tone="teal" icon={<CalendarCheck2 size={21} />} label={c.patientsReady} value={data.patients_ready_count} to={`${dayPath}&status=CHECKED_IN`} />
      <DashboardMetric tone="orange" icon={<CircleAlert size={21} />} label={c.needsReschedule} value={data.needs_reschedule_count} to="/staff/appointments/needs-reschedule" />
      <DashboardMetric tone="amber" icon={<ReceiptText size={21} />} label={c.pendingBilling} value={data.pending_billing_count} to="/staff/billing/handoffs?status=PENDING" />
    </DashboardMetrics>
    <div className="dashboard-v2-operational-grid">
      <DashboardSection title={c.todaysQueue} action={<Link to={dayPath}>{c.viewDay}</Link>} className="dashboard-v2-queue"><DashboardAppointmentList language={language} clinicTimezone={data.clinic_timezone} items={data.today_appointments} empty={c.noAppointmentsToday} role="STAFF" showDoctor /></DashboardSection>
      <DashboardSection title={c.attentionRequired}><AttentionList empty={c.noUrgentIssues} items={[
        { label: c.patientsReady, count: data.patients_ready_count, to: `${dayPath}&status=CHECKED_IN`, tone: "info" },
        { label: c.needsReschedule, count: data.needs_reschedule_count, to: "/staff/appointments/needs-reschedule", tone: "warning" },
        { label: c.pendingBilling, count: data.pending_billing_count, to: "/staff/billing/handoffs?status=PENDING", tone: "warning" },
      ]} /></DashboardSection>
    </div>
    <DashboardSection title={c.openInvoicesFollowUp} action={<Link to="/staff/billing/overview">{c.viewBilling}</Link>}><DashboardInvoiceList language={language} items={data.open_invoices} role="STAFF" empty={c.noOpenInvoices} /></DashboardSection>
  </main>;
}
