import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAdminDashboard } from "../../api/endpoints/dashboard";
import { PageHeaderV2, PreviewList, SectionHeading, StatePanel, SurfaceCard, StatusBadge } from "../../components/v2";
import { DashboardError, DashboardLoading, Icons, Kpis, today } from "../dashboard/DashboardV2";
import { useFeatureT } from "../../layouts/i18n";

export function AdminDashboardPage() {
  const t = useFeatureT();
  const dashboard = useQuery({ queryKey: ["dashboard", "admin"], queryFn: getAdminDashboard });
  if (dashboard.isLoading) return <DashboardLoading />; if (dashboard.isError || !dashboard.data) return <DashboardError retry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  return <div className="dashboard-page"><PageHeaderV2 title={t("clinicOperations")} description={`Local clinic date · ${today}`} action={<><Link className="v2-button secondary" to="/admin/clinic-settings">Clinic settings</Link><Link className="v2-button secondary" to="/admin/users">{t("usersAccess")}</Link></>} />
    <Kpis items={[
      { label: "Active patients", value: data.total_active_patients, support: "Active records", to: "/admin/patients?archive=active", icon: Icons.patients },
      { label: t("todayAppointments"), value: data.today_appointments_count, support: "Local clinic date", to: `/admin/appointments/list?date=${today}`, icon: Icons.appointments },
      { label: t("needsReschedule"), value: data.needs_reschedule_appointments_count, support: "Requires scheduling review", to: "/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE", icon: Icons.reschedule },
      { label: "Pending handoffs", value: data.pending_billing_handoffs_count, support: "Awaiting Staff conversion", to: "/admin/billing/handoffs?status=PENDING", icon: Icons.handoff },
      { label: "Unpaid invoices", value: data.unpaid_invoices_count, support: "Outstanding balance", to: "/admin/billing/invoices?status=UNPAID", icon: Icons.money },
    ]} />
    <div className="dashboard-columns"><SurfaceCard major><SectionHeading title="Needs attention" /><PreviewList initialCount={4} items={data.recent_appointments.filter((item) => item.status === "NEEDS_RESCHEDULE")} viewAll={<Link className="v2-button secondary compact" to="/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE">{t("viewAll")}</Link>} renderItem={(item) => <Link className="summary-row" key={item.id} to="/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE"><span><strong>{item.patient.full_name}</strong><small>{item.reason || "Scheduling review"}</small></span><StatusBadge status={item.status} /></Link>} />{!data.recent_appointments.some((item) => item.status === "NEEDS_RESCHEDULE") ? <StatePanel state="empty" title="No appointments need attention" /> : null}</SurfaceCard>
      <SurfaceCard><SectionHeading title={t("appointments")} /><PreviewList initialCount={4} items={data.recent_appointments} viewAll={<Link className="v2-button secondary compact" to={`/admin/appointments/list?date=${today}`}>{t("viewAll")}</Link>} renderItem={(item) => <Link className="summary-row" key={item.id} to={`/admin/appointments/list?date=${today}`}><span><strong>{item.patient.full_name}</strong><small>{item.doctor.full_name}</small></span><StatusBadge status={item.status} /></Link>} /></SurfaceCard></div>
    <SurfaceCard><SectionHeading title="Clinic summary" /><p>Checked in: {data.checked_in_appointments_count} · Active visits: {data.active_visits_count} · Unpaid invoices: {data.unpaid_invoices_count}</p></SurfaceCard>
  </div>;
}
