import { CalendarDays, CircleAlert, ClipboardPlus, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { dashboardCopy } from "./i18n";
import { DashboardEmpty, DashboardError, DashboardHeader, DashboardLinks, DashboardList, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection } from "./DashboardShared";
import { appointmentDetailPath } from "../appointments/utils/appointmentPermissions";

export function DoctorDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const query = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: dashboardApi.doctor, staleTime: 30_000 });
  if (query.isLoading) return <DashboardLoading language={language} />;
  if (query.isError) return <DashboardError language={language} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DashboardEmpty language={language} />;
  const data = query.data;
  const next = data.own_checked_in_appointments[0] ?? data.today_own_appointments[0];
  return <main className="dashboard-v2" data-role="DOCTOR"><DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.doctorTitle} description={c.doctorDescription} actions={<Link className="v2-button" to={data.own_active_visit ? "/doctor/visits/active" : "/doctor/appointments/day"}>{data.own_active_visit ? c.activeVisitAction : c.appointmentsAction}</Link>} />
    <DashboardMetrics><DashboardMetric tone="blue" icon={<CalendarDays size={22} />} label={c.appointments} value={data.today_own_appointments.length} to="/doctor/appointments/day" /><DashboardMetric tone="teal" icon={<Stethoscope size={22} />} label={c.checkedIn} value={data.own_checked_in_appointments.length} to="/doctor/appointments/day" /><DashboardMetric tone="orange" icon={<CircleAlert size={22} />} label={c.needsReschedule} value={data.own_needs_reschedule_appointments.length} to="/doctor/appointments/needs-reschedule" /><DashboardMetric tone="green" icon={<ClipboardPlus size={22} />} label={c.completedToday} value={data.own_completed_visits_today_count} /></DashboardMetrics>
    <div className="dashboard-v2-layout"><DashboardSection title={c.activeVisit}>{data.own_active_visit ? <Link className="dashboard-v2-focus" to="/doctor/visits/active"><strong>{data.own_active_visit.patient.full_name}</strong><span>{c.activeVisitAction}</span></Link> : next ? <Link className="dashboard-v2-focus" to={appointmentDetailPath("DOCTOR", next.id)}><strong>{next.patient.full_name}</strong><span>{next.status === "CHECKED_IN" ? c.ready : c.next}</span></Link> : <p className="dashboard-v2-empty">{c.noActiveVisit}</p>}</DashboardSection><DashboardSection title={c.schedule} action={<Link to="/doctor/appointments/day">{c.viewAll}</Link>} className="dashboard-v2-primary"><DashboardList language={language} clinicTimezone={data.clinic_timezone} items={data.today_own_appointments} empty={c.noAppointments} role="DOCTOR" /></DashboardSection></div>
    <DashboardSection title={c.quickActions}><DashboardLinks items={[{ label: c.patients, to: "/doctor/patients" }, { label: c.activeVisitAction, to: "/doctor/visits/active" }, { label: c.appointmentsAction, to: "/doctor/appointments/day" }]} /></DashboardSection>
  </main>;
}
