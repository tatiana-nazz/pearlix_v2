import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getStaffDashboard } from "../../api/endpoints/dashboard";
import { PageHeaderV2, PreviewList, SectionHeading, StatePanel, SurfaceCard } from "../../components/v2";
import { AppointmentPreview, DashboardAction, DashboardError, DashboardLoading, HandoffPreview, Icons, InvoicePreview, Kpis, useClinicDashboardDate } from "../dashboard/DashboardV2";
import { useFeatureT } from "../../layouts/i18n";

export function StaffDashboardPage() {
  const t = useFeatureT(); const dashboard = useQuery({ queryKey: ["dashboard", "staff"], queryFn: getStaffDashboard }); const clinic = useClinicDashboardDate();
  if (dashboard.isLoading) return <DashboardLoading />;
  if (dashboard.isError || !dashboard.data) return <DashboardError retry={() => { void dashboard.refetch(); }} />;
  const data = dashboard.data; const date = clinic.date ?? ""; const dated = (path: string) => date ? `${path}${path.includes("?") ? "&" : "?"}date=${date}` : path;
  return <div className="dashboard-page staff-dashboard"><PageHeaderV2 title={t("staffDashboard")} description={date ? `${t("clinicLocalDate")} · ${date}` : t("dateUnavailable")} action={<><Link className="v2-button" to="/staff/appointments/day">{t("addAppointment")}</Link><Link className="v2-button secondary" to="/staff/patients/new">{t("newPatient")}</Link></>} />
    <Kpis testId="staff-main-kpis" items={[
      { label: t("todayAppointments"), value: data.today_appointments_count, helper: t("localClinicSchedule"), action: t("openSchedule"), to: dated("/staff/appointments/list"), icon: Icons.appointments, tone: "info" },
      { label: t("checkedIn"), value: data.checked_in_appointments.length, helper: t("readyForDoctor"), action: t("openQueue"), to: dated("/staff/appointments/list?status=CHECKED_IN"), icon: Icons.complete, tone: "success" },
      { label: t("needsReschedule"), value: data.needs_reschedule_appointments.length, helper: t("requiresFollowUp"), action: t("reviewQueue"), to: "/staff/appointments/needs-reschedule?status=NEEDS_RESCHEDULE", icon: Icons.reschedule, tone: "warning" },
      { label: t("unpaidOrPartialInvoices"), value: data.unpaid_or_partially_paid_invoices.length, helper: t("billingFollowUp"), action: t("reviewInvoices"), to: "/staff/billing/invoices?status=UNPAID,PARTIALLY_PAID", icon: Icons.money, tone: "danger" },
    ]} />
    <div className="dashboard-columns"><AppointmentPreview title={t("todayAppointments")} items={data.upcoming_today_appointments} to={dated("/staff/appointments/list")} empty={t("noUpcomingAppointments")} /><AppointmentPreview title={t("checkedInQueue")} items={data.checked_in_appointments} to={dated("/staff/appointments/list?status=CHECKED_IN")} empty={t("noCheckedInPatients")} /><AppointmentPreview title={t("needsReschedule")} items={data.needs_reschedule_appointments} to="/staff/appointments/needs-reschedule?status=NEEDS_RESCHEDULE" empty={t("noAppointmentsNeedRescheduling")} /><HandoffPreview title={t("pendingBillingHandoffs")} items={data.pending_billing_handoffs} to="/staff/billing/handoffs?status=PENDING" /></div>
    <InvoicePreview title={t("unpaidOrPartialInvoices")} items={data.unpaid_or_partially_paid_invoices} to="/staff/billing/invoices?status=UNPAID,PARTIALLY_PAID" /><SurfaceCard><SectionHeading title={t("patients")} /><PreviewList initialCount={4} items={data.recent_patients} viewAll={<DashboardAction to="/staff/patients">{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={`/staff/patients/${item.id}`}><span><strong>{item.full_name}</strong><small className="bidi-isolate">{item.phone_number || t("noContactRecorded")}</small></span></Link>} />{!data.recent_patients.length ? <StatePanel state="empty" title={t("noRecentPatients")} /> : null}</SurfaceCard>
  </div>;
}
