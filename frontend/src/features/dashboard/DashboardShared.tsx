import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button, KpiCard, Skeleton, StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import type { DashboardAppointmentSummary } from "../../types/dashboard";
import type { LanguagePreference } from "../../types/auth";
import { dashboardTime } from "./format";
import { dashboardCopy, dashboardStatus } from "./i18n";

export function DashboardHeader({ language, clinicDate, clinicTimezone, title, description, refreshing, onRefresh }: { language: LanguagePreference; clinicDate: string; clinicTimezone: string; title: string; description: string; refreshing: boolean; onRefresh: () => void }) {
  const c = dashboardCopy(language);
  return <header className="dashboard-v2-header"><div><p className="dashboard-v2-date">{c.today} · {new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", { dateStyle: "full", timeZone: clinicTimezone }).format(new Date(`${clinicDate}T12:00:00Z`))}</p><h1>{title}</h1><p>{description}</p></div><Button type="button" variant="secondary" onClick={onRefresh} loading={refreshing}><RefreshCw size={18} aria-hidden="true" />{refreshing ? c.refreshing : c.refresh}</Button></header>;
}

export function DashboardLoading({ language }: { language: LanguagePreference }) {
  const c = dashboardCopy(language);
  return <section className="dashboard-v2-loading" aria-label={c.loading} aria-busy="true"><Skeleton height={32} /><div className="dashboard-v2-metrics"><Skeleton height={132} /><Skeleton height={132} /><Skeleton height={132} /></div><Skeleton height={260} /></section>;
}

export function DashboardError({ language, onRetry }: { language: LanguagePreference; onRetry: () => void }) {
  const c = dashboardCopy(language);
  return <StatePanel state="error" title={c.unavailable} action={<Button type="button" variant="secondary" onClick={onRetry}>{c.retry}</Button>} />;
}

export function DashboardEmpty({ language }: { language: LanguagePreference }) { return <StatePanel state="empty" title={dashboardCopy(language).noData} />; }

export function DashboardMetrics({ children }: { children: ReactNode }) { return <div className="dashboard-v2-metrics">{children}</div>; }

export function DashboardMetric({ icon, label, value, support, to }: { icon: ReactNode; label: string; value: number; support?: string; to?: string }) {
  const content = <KpiCard icon={icon} label={label} value={value} support={support} />;
  return to ? <Link className="dashboard-v2-metric-link" aria-label={`${label}: ${value}`} to={to}>{content}</Link> : content;
}

export function DashboardSection({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <SurfaceCard className={`dashboard-v2-section ${className}`}><div className="dashboard-v2-section-header"><h2>{title}</h2>{action}</div>{children}</SurfaceCard>;
}

export function DashboardList({ language, clinicTimezone, items, empty, role, showDoctor = false }: { language: LanguagePreference; clinicTimezone: string; items: DashboardAppointmentSummary[]; empty: string; role: "ADMIN" | "STAFF" | "DOCTOR"; showDoctor?: boolean }) {
  const c = dashboardCopy(language);
  if (!items.length) return <p className="dashboard-v2-empty">{empty}</p>;
  return <ul className="dashboard-v2-list">{items.slice(0, 5).map((item) => <li key={item.id}><Link to={`/${role.toLowerCase()}/patients/${item.patient.id}`}><span className="dashboard-v2-time">{dashboardTime(item.start_datetime, language, clinicTimezone)}</span><span className="dashboard-v2-person"><strong>{item.patient.full_name}</strong><small>{showDoctor ? item.doctor.full_name : item.reason || c.noReason}</small></span><StatusBadge status={item.status} label={dashboardStatus(language, item.status)} /></Link></li>)}</ul>;
}

export function DashboardLinks({ items }: { items: { label: string; to: string }[] }) { return <nav className="dashboard-v2-actions" aria-label="Dashboard shortcuts">{items.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav>; }
