import { CalendarCheck2, CalendarDays, CircleAlert, ReceiptText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { dashboardCopy } from "./i18n";
import { DashboardEmpty, DashboardError, DashboardHeader, DashboardLinks, DashboardList, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection } from "./DashboardShared";

export function StaffDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const query = useQuery({ queryKey: ["dashboard", "staff"], queryFn: dashboardApi.staff, staleTime: 30_000 });
  if (query.isLoading) return <DashboardLoading language={language} />;
  if (query.isError) return <DashboardError language={language} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DashboardEmpty language={language} />;
  const data = query.data;
  return <main className="dashboard-v2" data-role="STAFF"><DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.staffTitle} description={c.staffDescription} actions={<><Link className="v2-button" to="/staff/appointments/day">{c.newAppointment}</Link><Link className="v2-button secondary" to="/staff/patients/new">{c.newPatient}</Link></>} />
    <DashboardMetrics><DashboardMetric tone="blue" icon={<CalendarDays size={22} />} label={c.appointments} value={data.today_appointments_count} to="/staff/appointments/day" /><DashboardMetric tone="teal" icon={<CalendarCheck2 size={22} />} label={c.checkedIn} value={data.checked_in_appointments.length} to="/staff/appointments/day" /><DashboardMetric tone="orange" icon={<CircleAlert size={22} />} label={c.needsReschedule} value={data.needs_reschedule_appointments.length} to="/staff/appointments/needs-reschedule" /><DashboardMetric tone="amber" icon={<ReceiptText size={22} />} label={c.unpaidInvoices} value={data.unpaid_or_partially_paid_invoices.length} to="/staff/billing/invoices" /></DashboardMetrics>
    <div className="dashboard-v2-layout"><DashboardSection title={c.attention}><div className="dashboard-v2-attention">{data.needs_reschedule_appointments.length ? <Link to="/staff/appointments/needs-reschedule">{c.needsReschedule}: {data.needs_reschedule_appointments.length}</Link> : null}{data.checked_in_appointments.length ? <Link to="/staff/appointments/day">{c.patientsReady}: {data.checked_in_appointments.length}</Link> : null}{!data.needs_reschedule_appointments.length && !data.checked_in_appointments.length ? <p>{c.noAttention}</p> : null}</div></DashboardSection><DashboardSection title={c.queue} action={<Link to="/staff/appointments/list">{c.viewAll}</Link>} className="dashboard-v2-primary"><DashboardList language={language} clinicTimezone={data.clinic_timezone} items={data.upcoming_today_appointments} empty={c.noQueue} role="STAFF" showDoctor /></DashboardSection></div>
    <DashboardSection title={c.quickActions}><DashboardLinks items={[{ label: c.newAppointment, to: "/staff/appointments/day" }, { label: c.newPatient, to: "/staff/patients/new" }, { label: c.needsReschedule, to: "/staff/appointments/needs-reschedule" }, { label: c.billing, to: "/staff/billing/handoffs" }]} /></DashboardSection>
  </main>;
}
