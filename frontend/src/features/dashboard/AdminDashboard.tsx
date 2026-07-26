import { Activity, CalendarDays, CircleAlert, Stethoscope, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { dashboardCopy } from "./i18n";
import { DashboardEmpty, DashboardError, DashboardHeader, DashboardLinks, DashboardList, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection } from "./DashboardShared";

export function AdminDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const query = useQuery({ queryKey: ["dashboard", "admin"], queryFn: dashboardApi.admin, staleTime: 30_000 });
  if (query.isLoading) return <DashboardLoading language={language} />;
  if (query.isError) return <DashboardError language={language} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DashboardEmpty language={language} />;
  const data = query.data;
  return <main className="dashboard-v2" data-role="ADMIN"><DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.adminTitle} description={c.adminDescription} actions={<><Link className="v2-button" to="/admin/team/new">{c.addTeamMember}</Link><Link className="v2-button secondary" to="/admin/users/new">{c.createUser}</Link></>} />
    <DashboardMetrics>
      <DashboardMetric tone="violet" icon={<UsersRound size={22} />} label={c.activePatients} value={data.total_active_patients} to="/admin/patients" />
      <DashboardMetric tone="blue" icon={<CalendarDays size={22} />} label={c.appointments} value={data.today_appointments_count} to="/admin/appointments/day" />
      <DashboardMetric tone="orange" icon={<CircleAlert size={22} />} label={c.needsReschedule} value={data.needs_reschedule_appointments_count} support={data.needs_reschedule_appointments_count ? c.attention : undefined} to="/admin/appointments/needs-reschedule" />
      <DashboardMetric tone="teal" icon={<Activity size={22} />} label={c.activeVisits} value={data.active_visits_count} />
    </DashboardMetrics>
    <div className="dashboard-v2-layout"><DashboardSection title={c.attention}><div className="dashboard-v2-attention">{data.needs_reschedule_appointments_count ? <Link to="/admin/appointments/needs-reschedule">{c.needsReschedule}: {data.needs_reschedule_appointments_count}</Link> : <p>{c.noAttention}</p>}{data.pending_billing_handoffs_count ? <Link to="/admin/billing/handoffs">{c.pendingHandoffs}: {data.pending_billing_handoffs_count}</Link> : null}</div></DashboardSection>
      <DashboardSection title={c.activity} action={<Link to="/admin/appointments/list">{c.viewAll}</Link>} className="dashboard-v2-primary"><DashboardList language={language} clinicTimezone={data.clinic_timezone} items={data.recent_appointments} empty={c.noActivity} role="ADMIN" showDoctor /></DashboardSection></div>
    <DashboardSection title={c.quickActions}><DashboardLinks items={[{ label: c.team, to: "/admin/team" }, { label: c.users, to: "/admin/users" }, { label: c.schedules, to: "/admin/doctors" }, { label: c.leave, to: "/admin/leave" }, { label: c.clinicSettings, to: "/admin/clinic-settings" }]} /></DashboardSection>
  </main>;
}
