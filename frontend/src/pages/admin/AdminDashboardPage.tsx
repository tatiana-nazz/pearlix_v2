import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAdminDashboard } from "../../api/endpoints/dashboard";
import { PageHeaderV2, PreviewList, SectionHeading, StatePanel, SurfaceCard, StatusBadge } from "../../components/v2";
import { DashboardError, DashboardLoading, Icons, Kpis, useClinicDashboardDate } from "../dashboard/DashboardV2";
import { useFeatureT } from "../../layouts/i18n";

export function AdminDashboardPage() {
  const t = useFeatureT();
  const dashboard = useQuery({ queryKey: ["dashboard", "admin"], queryFn: getAdminDashboard });
  const clinic = useClinicDashboardDate();
  if (dashboard.isLoading) return <DashboardLoading />;
  if (dashboard.isError || !dashboard.data) return <DashboardError retry={() => { void dashboard.refetch(); }} />;
  const data = dashboard.data; const date = clinic.date ?? ""; const dated = (path: string) => date ? `${path}${path.includes("?") ? "&" : "?"}date=${date}` : path;
  return <div className="dashboard-page"><PageHeaderV2 title={t("clinicOperations")} description={date ? `${t("clinicLocalDate")} · ${date}` : t("dateUnavailable")} action={<><Link className="v2-button secondary" to="/admin/clinic-settings">{t("clinicSettings")}</Link><Link className="v2-button secondary" to="/admin/users">{t("usersAccess")}</Link></>} />
    <Kpis items={[
      { label: t("activePatients"), value: data.total_active_patients, helper: t("activeRecords"), to: "/admin/patients?archive=active", icon: Icons.patients },
      { label: t("todayAppointments"), value: data.today_appointments_count, helper: date ? t("clinicLocalDate") : t("dateUnavailable"), to: dated("/admin/appointments/list"), icon: Icons.appointments },
      { label: t("needsReschedule"), value: data.needs_reschedule_appointments_count, helper: t("schedulingReview"), to: "/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE", icon: Icons.reschedule },
      { label: t("pendingHandoffs"), value: data.pending_billing_handoffs_count, helper: t("awaitingConversion"), to: "/admin/billing/handoffs?status=PENDING", icon: Icons.handoff },
      { label: t("unpaidInvoices"), value: data.unpaid_invoices_count, helper: t("outstandingBalance"), to: "/admin/billing/invoices?status=UNPAID", icon: Icons.money },
    ]} />
    <div className="dashboard-columns"><SurfaceCard major><SectionHeading title={t("needsAttention")} /><PreviewList initialCount={4} items={data.recent_appointments.filter((item) => item.status === "NEEDS_RESCHEDULE")} viewAll={<Link className="v2-button secondary compact" to="/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE">{t("viewAll")}</Link>} renderItem={(item) => <Link className="summary-row" key={item.id} to="/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE"><span><strong>{item.patient.full_name}</strong><small>{item.reason || t("schedulingReviewFallback")}</small></span><StatusBadge status={item.status} /></Link>} />{!data.recent_appointments.some((item) => item.status === "NEEDS_RESCHEDULE") ? <StatePanel state="empty" title={t("noAppointmentsNeedAttention")} /> : null}</SurfaceCard>
      <SurfaceCard><SectionHeading title={t("appointments")} /><PreviewList initialCount={4} items={data.recent_appointments} viewAll={<Link className="v2-button secondary compact" to={dated("/admin/appointments/list")}>{t("viewAll")}</Link>} renderItem={(item) => <Link className="summary-row" key={item.id} to={dated("/admin/appointments/list")}><span><strong>{item.patient.full_name}</strong><small>{item.doctor.full_name}</small></span><StatusBadge status={item.status} /></Link>} /></SurfaceCard></div>
    <SurfaceCard><SectionHeading title={t("clinicSummary")} /><p>{t("checkedIn")}: <bdi>{data.checked_in_appointments_count}</bdi> · {t("activeVisits")}: <bdi>{data.active_visits_count}</bdi> · {t("unpaidInvoices")}: <bdi>{data.unpaid_invoices_count}</bdi></p></SurfaceCard>
  </div>;
}
