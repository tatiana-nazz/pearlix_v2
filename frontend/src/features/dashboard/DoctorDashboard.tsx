import { CalendarCheck2, CalendarDays, CircleAlert, ClipboardCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import { AppointmentStatusBadge } from "../appointments/components/AppointmentStatusBadge";
import { appointmentDetailPath } from "../appointments/utils/appointmentPermissions";
import { DashboardAppointmentList, DashboardEmpty, DashboardError, DashboardHeader, DashboardLoading, DashboardMetric, DashboardMetrics, DashboardSection } from "./DashboardShared";
import { dashboardTime } from "./format";
import { dashboardCopy } from "./i18n";

export function DoctorDashboard() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = dashboardCopy(language);
  const query = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: dashboardApi.doctor, staleTime: 30_000 });
  if (query.isLoading) return <DashboardLoading language={language} />;
  if (query.isError) return <DashboardError language={language} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DashboardEmpty language={language} />;
  const data = query.data;
  const ready = data.today_appointments.find((appointment) => appointment.status === "CHECKED_IN");
  const next = ready ?? data.today_appointments.find((appointment) => appointment.status === "UPCOMING");
  const dayPath = `/doctor/appointments/day?date=${data.clinic_date}`;
  return <main className="dashboard-v2 dashboard-v2-doctor" data-role="DOCTOR">
    <DashboardHeader language={language} clinicDate={data.clinic_date} clinicTimezone={data.clinic_timezone} title={c.doctorTitle} description={c.doctorDescription} actions={data.own_active_visit ? <Link className="v2-button" to="/doctor/visits/active">{c.continueVisit}</Link> : undefined} />
    <DashboardMetrics>
      <DashboardMetric tone="blue" icon={<CalendarDays size={21} />} label={c.todaysAppointments} value={data.today_appointments_count} to={dayPath} />
      <DashboardMetric tone="teal" icon={<CalendarCheck2 size={21} />} label={c.patientsReady} value={data.patients_ready_count} to={dayPath} />
      <DashboardMetric tone="green" icon={<ClipboardCheck size={21} />} label={c.completedToday} value={data.completed_today_count} />
      <DashboardMetric tone="orange" icon={<CircleAlert size={21} />} label={c.needsReschedule} value={data.needs_reschedule_count} to="/doctor/appointments/needs-reschedule" />
    </DashboardMetrics>
    <DashboardSection title={c.activeVisit} className={data.own_active_visit ? "dashboard-v2-active-visit" : "dashboard-v2-active-visit empty"}>{data.own_active_visit ? <div className="dashboard-v2-visit-focus"><div><strong>{data.own_active_visit.patient.full_name}</strong><span>{c.started}: <b dir="ltr">{dashboardTime(data.own_active_visit.started_at, language, data.clinic_timezone)}</b></span><small>{c.appointmentContext}: {data.own_active_visit.appointment_reason || c.noReason}</small></div><Link className="v2-button" to="/doctor/visits/active">{c.continueVisit}</Link></div> : <p className="dashboard-v2-empty">{c.noActiveVisit}</p>}</DashboardSection>
    <div className="dashboard-v2-clinical-grid">
      <DashboardSection title={c.todaysSchedule} action={<Link to={dayPath}>{c.viewDay}</Link>}><DashboardAppointmentList language={language} clinicTimezone={data.clinic_timezone} items={data.today_appointments} empty={c.noAppointmentsToday} role="DOCTOR" /></DashboardSection>
      <DashboardSection title={c.nextPatient} className="dashboard-v2-next-patient">{next ? <Link className="dashboard-v2-next-focus" aria-label={`${c.openAppointment} ${next.id}: ${next.patient.full_name}`} to={appointmentDetailPath("DOCTOR", next.id)}><span className={`dashboard-v2-priority ${next.status === "CHECKED_IN" ? "ready" : "next"}`}>{next.status === "CHECKED_IN" ? c.ready : c.next}</span><strong>{next.patient.full_name}</strong><span dir="ltr">{dashboardTime(next.start_datetime, language, data.clinic_timezone)}</span><small>{next.reason || c.noReason}</small><AppointmentStatusBadge status={next.status} /><b>{c.openAppointment}</b></Link> : <p className="dashboard-v2-empty">{c.noMorePatients}</p>}</DashboardSection>
    </div>
  </main>;
}
