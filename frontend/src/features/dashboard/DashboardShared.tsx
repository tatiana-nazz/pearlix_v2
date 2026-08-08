import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button, KpiCard, Skeleton, StatePanel, StatusBadge, SurfaceCard, type KpiTone } from "../../components/v2";
import type { AppointmentStatus } from "../../types/appointments";
import type { LanguagePreference } from "../../types/auth";
import type { DashboardAppointmentStatusCounts, DashboardAppointmentSummary, DashboardBillingActivityDay, DashboardHandoffSummary } from "../../types/dashboard";
import { AppointmentStatusBadge } from "../appointments/components/AppointmentStatusBadge";
import { appointmentDetailPath } from "../appointments/utils/appointmentPermissions";
import { appointmentStatusTone } from "../appointments/utils/appointmentStatusPresentation";
import { formatMoney } from "../billing/utils/billing";
import { dashboardTime } from "./format";
import { dashboardCopy, dashboardStatus } from "./i18n";

const APPOINTMENT_STATUSES: AppointmentStatus[] = ["UPCOMING", "CHECKED_IN", "ACTIVE", "COMPLETED", "NEEDS_RESCHEDULE", "CANCELLED", "NO_SHOW"];
const CURRENCIES = ["SYP", "USD"] as const;

export function DashboardHeader({ language, clinicDate, clinicTimezone, title, description, actions }: { language: LanguagePreference; clinicDate: string; clinicTimezone: string; title: string; description: string; actions?: ReactNode }) {
  const c = dashboardCopy(language);
  const locale = language === "AR" ? "ar" : "en-US";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${clinicDate}T12:00:00Z`));
  return <header className="dashboard-v2-header"><div><p className="dashboard-v2-date" title={clinicTimezone}>{c.today} · {date}</p><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="dashboard-v2-header-actions">{actions}</div> : null}</header>;
}

export function DashboardLoading({ language }: { language: LanguagePreference }) {
  const c = dashboardCopy(language);
  return <section className="dashboard-v2-loading" aria-label={c.loading} aria-busy="true"><Skeleton height={32} /><div className="dashboard-v2-metrics"><Skeleton height={116} /><Skeleton height={116} /><Skeleton height={116} /><Skeleton height={116} /></div><Skeleton height={260} /></section>;
}

export function DashboardError({ language, onRetry }: { language: LanguagePreference; onRetry: () => void }) {
  const c = dashboardCopy(language);
  return <StatePanel state="error" title={c.unavailable} action={<Button type="button" variant="secondary" onClick={onRetry}>{c.retry}</Button>} />;
}

export function DashboardEmpty({ language }: { language: LanguagePreference }) { return <StatePanel state="empty" title={dashboardCopy(language).noData} />; }
export function DashboardMetrics({ children, count = 4 }: { children: ReactNode; count?: number }) { return <div className="dashboard-v2-metrics" data-count={count}>{children}</div>; }

export function DashboardMetric({ icon, label, value, support, to, tone }: { icon: ReactNode; label: string; value: number; support?: string; to?: string; tone?: KpiTone }) {
  const content = <KpiCard icon={icon} label={label} value={value} support={support} tone={tone} />;
  return to ? <Link className="dashboard-v2-metric-link" aria-label={`${label}: ${value}`} to={to}>{content}</Link> : content;
}

export function DashboardSection({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <SurfaceCard className={`dashboard-v2-section ${className}`}><div className="dashboard-v2-section-header"><div>{eyebrow ? <p>{eyebrow}</p> : null}<h2>{title}</h2></div>{action}</div>{children}</SurfaceCard>;
}

export function DashboardAppointmentList({ language, clinicTimezone, items, empty, role, showDoctor = false, limit }: { language: LanguagePreference; clinicTimezone: string; items: DashboardAppointmentSummary[]; empty: string; role: "ADMIN" | "STAFF" | "DOCTOR"; showDoctor?: boolean; limit?: number }) {
  const c = dashboardCopy(language);
  if (!items.length) return <p className="dashboard-v2-empty">{empty}</p>;
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;
  return <ul className="dashboard-v2-list dashboard-v2-appointment-list">{visibleItems.map((item) => <li key={item.id} data-status={item.status}><Link aria-label={`${c.openAppointment} ${item.id}: ${item.patient.full_name}`} to={appointmentDetailPath(role, item.id)}><span className="dashboard-v2-time" dir="ltr">{dashboardTime(item.start_datetime, language, clinicTimezone)}</span><span className="dashboard-v2-person"><strong>{item.patient.full_name}</strong><small>{showDoctor ? item.doctor.full_name : item.reason || c.noReason}</small></span><AppointmentStatusBadge status={item.status} /></Link></li>)}</ul>;
}

export function DashboardHandoffList({ language, items, role, empty, showTotal = false }: { language: LanguagePreference; items: DashboardHandoffSummary[]; role: "ADMIN" | "STAFF"; empty: string; showTotal?: boolean }) {
  const c = dashboardCopy(language);
  if (!items.length) return <p className="dashboard-v2-empty">{empty}</p>;
  const rolePath = role.toLowerCase();
  return <ul className={`dashboard-v2-list dashboard-v2-invoice-list${showTotal ? "" : " compact"}`}>{items.map((item) => <li key={item.id}><Link aria-label={`${c.bill} ${item.id}: ${item.patient.full_name}`} to={`/${rolePath}/billing/handoffs/${item.id}`}><span className="dashboard-v2-invoice-id bidi-ltr"><strong>Bill #{item.id}</strong><small>{item.patient.full_name}</small></span>{showTotal ? <span className="dashboard-v2-money"><small>{c.total}</small><strong className="bidi-ltr">{formatMoney(String(item.total_amount), item.currency)}</strong></span> : null}<span className="dashboard-v2-money"><small>{c.balance}</small><strong className="bidi-ltr">{formatMoney(String(item.remaining_amount), item.currency)}</strong></span><StatusBadge status={item.status} label={dashboardStatus(language, item.status)} /></Link></li>)}</ul>;
}

export function AttentionList({ items, empty }: { items: Array<{ label: string; count: number; to: string; tone: "warning" | "danger" | "info" }>; empty: string }) {
  const visible = items.filter((item) => item.count > 0);
  if (!visible.length) return <p className="dashboard-v2-attention-empty">{empty}</p>;
  return <nav className="dashboard-v2-attention" aria-label="Dashboard attention items">{visible.map((item) => <Link className={item.tone} key={`${item.to}-${item.label}`} to={item.to}><span>{item.label}</span><strong>{item.count}</strong></Link>)}</nav>;
}

export function SimpleStatusBarChart({ language, counts }: { language: LanguagePreference; counts: DashboardAppointmentStatusCounts }) {
  const max = Math.max(1, ...APPOINTMENT_STATUSES.map((status) => counts[status]));
  return <div className="dashboard-v2-status-chart" role="img" aria-label={APPOINTMENT_STATUSES.map((status) => `${dashboardStatus(language, status)}: ${counts[status]}`).join(", ")}>{APPOINTMENT_STATUSES.map((status) => <div className={`dashboard-v2-status-bar status-${appointmentStatusTone(status)}${counts[status] === 0 ? " is-zero" : ""}`} data-status={status} key={status}><span>{dashboardStatus(language, status)}</span><div aria-hidden="true"><i style={{ inlineSize: `${(counts[status] / max) * 100}%` }} /></div><strong>{counts[status]}</strong></div>)}</div>;
}

export function SimpleBillingActivityChart({ language, days }: { language: LanguagePreference; days: DashboardBillingActivityDay[] }) {
  const c = dashboardCopy(language);
  return <div className="dashboard-v2-billing-chart">{CURRENCIES.map((currency) => {
    const values = days.flatMap((day) => [Number(day[currency].billed), Number(day[currency].collected)]);
    const max = Math.max(1, ...values);
    const billed = days.reduce((total, day) => total + Number(day[currency].billed), 0);
    const collected = days.reduce((total, day) => total + Number(day[currency].collected), 0);
    return <section className="dashboard-v2-currency-chart" aria-label={`${currency}: ${c.billed} ${billed.toFixed(2)}, ${c.collected} ${collected.toFixed(2)}`} key={currency}><header><strong className="bidi-ltr">{currency}</strong><span><i className="invoiced" />{c.billed}: <b className="bidi-ltr">{formatMoney(billed.toFixed(2), currency)}</b></span><span><i className="collected" />{c.collected}: <b className="bidi-ltr">{formatMoney(collected.toFixed(2), currency)}</b></span></header><div className="dashboard-v2-daily-bars" aria-hidden="true">{days.map((day, index) => {
      const invoicedValue = Number(day[currency].billed);
      const collectedValue = Number(day[currency].collected);
      const invoicedSize = invoicedValue > 0 ? Math.max(2, (invoicedValue / max) * 100) : 0;
      const collectedSize = collectedValue > 0 ? Math.max(2, (collectedValue / max) * 100) : 0;
      return <span key={day.date} title={day.date}><i className="invoiced" style={{ blockSize: `${invoicedSize}%` }} /><i className="collected" style={{ blockSize: `${collectedSize}%` }} />{index % 7 === 0 || index === days.length - 1 ? <small>{day.date.slice(5)}</small> : null}</span>;
    })}</div></section>;
  })}</div>;
}
