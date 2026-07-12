import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getStaffDashboard } from "../../api/endpoints/dashboard";
import { PageHeaderV2, PreviewList, SectionHeading, StatePanel, SurfaceCard } from "../../components/v2";
import { AppointmentPreview, DashboardAction, DashboardError, DashboardLoading, HandoffPreview, Icons, InvoicePreview, Kpis, today } from "../dashboard/DashboardV2";
import { useFeatureT } from "../../layouts/i18n";

export function StaffDashboardPage() {
  const t = useFeatureT();
  const dashboard = useQuery({ queryKey: ["dashboard", "staff"], queryFn: getStaffDashboard });

  if (dashboard.isLoading) return <DashboardLoading />;
  if (dashboard.isError || !dashboard.data) return <DashboardError retry={() => void dashboard.refetch()} />;

  const data = dashboard.data;
  return <div className="dashboard-page staff-dashboard">
    <PageHeaderV2 title="Staff Dashboard" description={`Local clinic date · ${today}`} action={<><Link className="v2-button" to="/staff/appointments/day">{t("addAppointment")}</Link><Link className="v2-button secondary" to="/staff/patients/new">New Patient</Link></>} />
    <Kpis testId="staff-main-kpis" items={[
      { label: t("todayAppointments"), value: data.today_appointments_count, helper: "Local clinic schedule", action: "Open schedule", to: `/staff/appointments/list?date=${today}`, icon: Icons.appointments, tone: "info" },
      { label: "Checked in", value: data.checked_in_appointments.length, helper: "Ready for the doctor", action: "Open queue", to: `/staff/appointments/list?date=${today}&status=CHECKED_IN`, icon: Icons.complete, tone: "success" },
      { label: t("needsReschedule"), value: data.needs_reschedule_appointments.length, helper: "Requires follow-up", action: "Review queue", to: "/staff/appointments/needs-reschedule?status=NEEDS_RESCHEDULE", icon: Icons.reschedule, tone: "warning" },
      { label: "Unpaid or partial invoices", value: data.unpaid_or_partially_paid_invoices.length, helper: "Billing follow-up", action: "Review invoices", to: "/staff/billing/invoices?status=UNPAID,PARTIALLY_PAID", icon: Icons.money, tone: "danger" },
    ]} />
    <div className="dashboard-columns">
      <AppointmentPreview title={t("todayAppointments")} items={data.upcoming_today_appointments} to={`/staff/appointments/list?date=${today}`} empty="No upcoming appointments" />
      <AppointmentPreview title="Checked-in queue" items={data.checked_in_appointments} to={`/staff/appointments/list?date=${today}&status=CHECKED_IN`} empty="No patients are checked in" />
      <AppointmentPreview title={t("needsReschedule")} items={data.needs_reschedule_appointments} to="/staff/appointments/needs-reschedule?status=NEEDS_RESCHEDULE" empty="No appointments need rescheduling" />
      <HandoffPreview title="Pending billing handoffs" items={data.pending_billing_handoffs} to="/staff/billing/handoffs?status=PENDING" />
    </div>
    <InvoicePreview title="Unpaid or partial invoices" items={data.unpaid_or_partially_paid_invoices} to="/staff/billing/invoices?status=UNPAID,PARTIALLY_PAID" />
    <SurfaceCard>
      <SectionHeading title={t("patients")} />
      <PreviewList initialCount={4} items={data.recent_patients} viewAll={<DashboardAction to="/staff/patients">{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={`/staff/patients/${item.id}`}><span><strong>{item.full_name}</strong><small className="bidi-isolate">{item.phone_number || "No contact recorded"}</small></span></Link>} />
      {!data.recent_patients.length ? <StatePanel state="empty" title="No recent patients" /> : null}
    </SurfaceCard>
  </div>;
}
