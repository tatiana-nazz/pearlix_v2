import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarSync, ChevronRight, CircleDollarSign, ClipboardCheck, ReceiptText, Stethoscope, UsersRound } from "lucide-react";
import { clinicApi } from "../../api/endpoints/clinic";
import { KpiCard, type KpiTone, PreviewList, SectionHeading, Skeleton, StatePanel, SurfaceCard, StatusBadge } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import { formatDateRange } from "../../utils/dates";
import type { DashboardAppointmentSummary, DashboardBillingHandoffSummary, DashboardInvoiceSummary, DashboardVisitSummary } from "../../types/dashboard";

export function clinicDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function useClinicDashboardDate() {
  const settings = useQuery({ queryKey: ["clinic-settings"], queryFn: clinicApi.getSettings, staleTime: 60_000 });
  return { date: settings.data?.timezone ? clinicDate(settings.data.timezone) : undefined, isLoading: settings.isLoading, isError: settings.isError };
}

export function DashboardLoading() { return <><Skeleton height={48} /><div className="dashboard-grid">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={188} />)}</div></>; }
export function DashboardError({ retry }: { retry: () => void }) { const t = useFeatureT(); return <StatePanel state="error" title={t("dashboardUnavailable")} action={<button className="v2-button secondary" onClick={retry}>{t("retryDashboard")}</button>} />; }

type KpiItem = { label: string; value: number; helper?: string; action?: string; to: string; icon: ReactNode; tone?: KpiTone };
export function Kpis({ items, testId }: { items: KpiItem[]; testId?: string }) { return <div className="dashboard-grid dashboard-kpi-grid" data-testid={testId}>{items.map((item) => <Link key={item.label} to={item.to} className="kpi-link"><KpiCard {...item} /></Link>)}</div>; }
export function DashboardAction({ to, children }: { to: string; children: ReactNode }) { return <Link className="v2-text-action" to={to}>{children}<ChevronRight size={16} aria-hidden="true" /></Link>; }

export function AppointmentPreview({ title, items, to, empty }: { title: string; items: DashboardAppointmentSummary[]; to: string; empty: string }) { const t = useFeatureT(); return <SurfaceCard><SectionHeading title={title} /><PreviewList initialCount={4} items={items} viewAll={<DashboardAction to={to}>{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={to}><span><strong>{item.patient.full_name}</strong><small>{formatDateRange(item.start_datetime, item.end_datetime)} · {item.doctor.full_name}</small></span><StatusBadge status={item.status} /></Link>} />{items.length === 0 ? <StatePanel state="empty" title={empty} /> : null}</SurfaceCard>; }
export function HandoffPreview({ title, items, to }: { title: string; items: DashboardBillingHandoffSummary[]; to: string }) { const t = useFeatureT(); return <SurfaceCard><SectionHeading title={title} /><PreviewList initialCount={4} items={items} viewAll={<DashboardAction to={to}>{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={to}><span><strong>{item.patient.full_name}</strong><small>{t("visits")} <bdi>{item.visit_id}</bdi></small></span><StatusBadge status={item.status} /></Link>} />{items.length === 0 ? <StatePanel state="empty" title={t("noPatients")} /> : null}</SurfaceCard>; }
export function InvoicePreview({ title, items, to }: { title: string; items: DashboardInvoiceSummary[]; to: string }) { const t = useFeatureT(); return <SurfaceCard><SectionHeading title={title} /><PreviewList initialCount={4} items={items} viewAll={<DashboardAction to={to}>{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={to}><span><strong>{item.patient.full_name}</strong><small className="bidi-isolate">{item.invoice_number}</small></span><StatusBadge status={item.status} /></Link>} />{items.length === 0 ? <StatePanel state="empty" title={t("unpaidOrPartialInvoices")} /> : null}</SurfaceCard>; }
export function VisitPreview({ items, to }: { items: DashboardVisitSummary[]; to: string }) { const t = useFeatureT(); return <SurfaceCard><SectionHeading title={t("recentVisits")} /><PreviewList initialCount={4} items={items} viewAll={<DashboardAction to={to}>{t("viewAll")}</DashboardAction>} renderItem={(item) => <Link className="summary-row" key={item.id} to={`/doctor/visits/${item.id}`}><span><strong>{item.patient.full_name}</strong><small>{t("visits")} <bdi>{item.appointment_id}</bdi></small></span><StatusBadge status={item.status} /></Link>} />{items.length === 0 ? <StatePanel state="empty" title={t("noRecentPatients")} /> : null}</SurfaceCard>; }
export const Icons = { patients: <UsersRound />, appointments: <CalendarDays />, reschedule: <CalendarSync />, handoff: <ReceiptText />, money: <CircleDollarSign />, active: <Stethoscope />, complete: <ClipboardCheck /> };
