import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ClipboardCheck, Stethoscope } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { getAppointments } from "../../api/endpoints/appointments";
import { getDoctorDashboard } from "../../api/endpoints/dashboard";
import { KpiCard, PageHeaderV2, StatePanel, StatusBadge, SurfaceCard, Tabs } from "../../components/v2";
import { appointmentRecordClass } from "../../features/appointments/utils/appointmentStatusAppearance";
import { useFeatureT } from "../../layouts/i18n";
import { formatTime } from "../../utils/dates";
import { useClinicDashboardDate } from "../dashboard/DashboardV2";
import type { AppointmentStatus } from "../../types/appointments";

type QueueTab = "upcoming" | "checked-in" | "active" | "completed" | "cancelled";
const queueTabs: QueueTab[] = ["upcoming", "checked-in", "active", "completed", "cancelled"];
const queueStatus: Record<Exclude<QueueTab, "cancelled">, AppointmentStatus> = { upcoming: "UPCOMING", "checked-in": "CHECKED_IN", active: "ACTIVE", completed: "COMPLETED" };

function DoctorQueue({ date }: { date: string }) {
  const t = useFeatureT(); const [params, setParams] = useSearchParams(); const tab = queueTabs.includes(params.get("queue") as QueueTab) ? params.get("queue") as QueueTab : "upcoming"; const cancelledStatus = params.get("cancelled_status") === "NO_SHOW" ? "NO_SHOW" : "CANCELLED";
  const status = tab === "cancelled" ? cancelledStatus : queueStatus[tab];
  const query = useQuery({ queryKey: ["doctor-appointment-queue", tab, status, date], queryFn: () => getAppointments({ status, date, page: 1 }), enabled: Boolean(date) });
  const setTab = (next: QueueTab) => { const search = new URLSearchParams(params); search.set("queue", next); search.delete("appointment"); setParams(search); };
  const open = (id: number) => `/doctor/appointments/list?date=${encodeURIComponent(date)}&status=${status}&appointment=${id}`;
  return <SurfaceCard major className="doctor-appointment-queue"><div className="doctor-queue-heading"><div><h2>{t("myAppointmentQueue")}</h2><p>{t("clinicLocalDate")}: <bdi>{date}</bdi></p></div></div><Tabs selected={tab} onSelect={(value) => setTab(value as QueueTab)} tabs={[{ id: "upcoming", label: t("queueUpcoming") }, { id: "checked-in", label: t("queueCheckedIn") }, { id: "active", label: t("queueActive") }, { id: "completed", label: t("queueCompleted") }, { id: "cancelled", label: t("queueCancelledNoShow") }]} />
    {tab === "cancelled" ? <div className="doctor-queue-status-picker"><button type="button" className={cancelledStatus === "CANCELLED" ? "active" : ""} onClick={() => { const next = new URLSearchParams(params); next.set("cancelled_status", "CANCELLED"); setParams(next); }}>{t("cancelled")}</button><button type="button" className={cancelledStatus === "NO_SHOW" ? "active" : ""} onClick={() => { const next = new URLSearchParams(params); next.set("cancelled_status", "NO_SHOW"); setParams(next); }}>{t("noShow")}</button></div> : null}
    {query.isLoading ? <StatePanel state="loading" title={t("loadingAppointments")} /> : query.isError ? <StatePanel state="error" title={t("unableToLoadAppointments")} action={<button className="v2-button secondary" onClick={() => void query.refetch()}>{t("retry")}</button>} /> : !query.data?.results.length ? <StatePanel state="empty" title={t("noAppointments")} /> : <div className="doctor-queue-records">{query.data.results.map((item) => <Link key={item.id} className={`doctor-queue-record ${appointmentRecordClass(item.status)}`} to={open(item.id)}><time className="bidi-isolate">{formatTime(item.start_datetime)}</time><span><strong className="bidi-isolate">{item.patient.full_name}</strong><small className="bidi-isolate">{item.reason || t("notRecorded")}{item.duration_minutes ? ` · ${item.duration_minutes} ${t("minutes")}` : ""}</small></span><StatusBadge status={item.status} /></Link>)}</div>}
  </SurfaceCard>;
}

export function DoctorDashboardPage() {
  const t = useFeatureT(); const dashboard = useQuery({ queryKey: ["dashboard", "doctor"], queryFn: getDoctorDashboard }); const clinic = useClinicDashboardDate();
  if (dashboard.isLoading || clinic.isLoading) return <StatePanel state="loading" title={t("loadingDashboard")} />;
  if (dashboard.isError || !dashboard.data || !clinic.date) return <StatePanel state="error" title={t("dashboardUnavailable")} action={<button className="v2-button secondary" onClick={() => { void dashboard.refetch(); }}>{t("retryDashboard")}</button>} />;
  const data = dashboard.data; const date = clinic.date;
  const cards = [
    { label: t("todayAppointments"), value: data.today_own_appointments.length, to: `/doctor/dashboard?queue=upcoming`, icon: <CalendarDays />, tone: "info" as const },
    { label: t("activeVisits"), value: data.own_active_visit ? 1 : 0, to: `/doctor/dashboard?queue=active`, icon: <Stethoscope />, tone: "info" as const },
    { label: t("completedToday"), value: data.own_completed_visits_today_count, to: `/doctor/dashboard?queue=completed`, icon: <CheckCircle2 />, tone: "success" as const },
    { label: t("checkedIn"), value: data.own_checked_in_appointments.length, to: `/doctor/dashboard?queue=checked-in`, icon: <ClipboardCheck />, tone: "success" as const },
  ];
  return <div className="dashboard-page doctor-dashboard"><PageHeaderV2 title={t("clinicalWorkspace")} description={`${t("clinicLocalDate")}: ${date}`} /><div className="dashboard-grid dashboard-kpi-grid">{cards.map((card) => <Link key={card.label} to={card.to} className="kpi-link"><KpiCard {...card} /></Link>)}</div><DoctorQueue date={date} /></div>;
}
