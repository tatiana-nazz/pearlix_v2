import type { ReactNode } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Pagination } from "../../../components/v2";
import type { UserRole } from "../../../types/auth";
import type { InvoiceFinancialSummary, InvoiceStatus } from "../../../types/billing";
import { billingCopy, billingStatusLabel } from "../i18n";
import { useInvoiceSummary, useInvoices } from "../hooks/useBilling";
import { formatMoney } from "../utils/billing";
import { activeDatePreset, dateRangeForPreset, invoiceQueryFromSearch, type InvoiceDatePreset } from "../utils/billingQuery";
import { InvoiceList } from "./BillingLists";

const invoiceStatuses: InvoiceStatus[] = ["UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"];

function setSearchValue(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string,
  resetPage = true,
) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value); else next.delete(key);
  if (resetPage) next.delete("page");
  setSearchParams(next);
}

export function BillingWorkspaceHeader({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  const base = `/${role.toLowerCase()}/billing`;
  return <header className="billing-workspace-header"><div><p>{role === "ADMIN" ? c.adminWorkspace : c.staffWorkspace}</p><h1>{c.billing}</h1><span>{c.billingDescription}</span></div><nav className="billing-workspace-tabs" aria-label={c.billing}><NavLink to={`${base}/overview`}>{c.overview}</NavLink><NavLink to={`${base}/invoices`}>{c.invoices}</NavLink></nav></header>;
}

function CurrencyLines({ values }: { values: Record<"SYP" | "USD", string> }) {
  return <span className="billing-currency-lines">{(["SYP", "USD"] as const).map((currency) => <span className="bidi-ltr" key={currency}>{formatMoney(values[currency] ?? "0.00", currency)}</span>)}</span>;
}

function SummaryCurrencyLines({ summary, field }: { summary: InvoiceFinancialSummary; field: "invoiced" | "paid" | "outstanding" }) {
  return <CurrencyLines values={{ SYP: summary.currency_totals.SYP[field], USD: summary.currency_totals.USD[field] }} />;
}

function SectionHeading({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <header className="billing-section-heading"><div><h2>{title}</h2><p>{description}</p></div>{action}</header>;
}

export function BillingOverviewPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  const base = `/${role.toLowerCase()}/billing`;
  const allSummary = useInvoiceSummary();
  const clinicDate = allSummary.data?.clinic_date;
  const todayQuery = clinicDate ? { date_from: clinicDate, date_to: clinicDate } : undefined;
  const todaySummary = useInvoiceSummary(todayQuery, Boolean(clinicDate));
  const recentInvoices = useInvoices({ page: 1 });
  const queries = [allSummary, todaySummary, recentInvoices];
  const firstError = queries.find((query) => query.isError);

  return <main className="billing-page billing-overview-page"><BillingWorkspaceHeader role={role} /><div className="billing-page-intro"><div><p className="billing-eyebrow">{clinicDate ? `${c.clinicDate}: ${clinicDate}` : c.overview}</p><h2>{c.overviewTitle}</h2><p>{c.overviewDescription}</p></div>{role === "STAFF" ? <Link className="button primary" to="/staff/billing/invoices/new">{c.newInvoice}</Link> : null}</div>
    {queries.some((query) => query.isLoading) && !allSummary.data ? <LoadingState title={c.loadingOverview} /> : null}
    {firstError ? <ErrorState error={firstError.error} title={c.unavailableOverview} onRetry={() => { queries.forEach((query) => void query.refetch()); }} /> : null}
    {allSummary.data && todaySummary.data ? <section className="billing-kpi-grid" aria-label={c.overviewTitle}>
      <Link className="billing-kpi-card" to={`${base}/invoices?date_from=${clinicDate}&date_to=${clinicDate}`}><span>{c.invoicesToday}</span><strong>{todaySummary.data.invoice_count}</strong><small>{c.viewToday}</small></Link>
      <Link className="billing-kpi-card" to={`${base}/invoices`}><span>{c.openInvoices}</span><strong>{allSummary.data.open_invoice_count}</strong><small>{c.viewOpen}</small></Link>
      <Card className="billing-kpi-card billing-kpi-static"><span>{c.collectedToday}</span><strong><CurrencyLines values={todaySummary.data.payments_collected_in_period} /></strong><small>{clinicDate}</small></Card>
      <Card className="billing-kpi-card billing-kpi-static"><span>{c.outstandingByCurrency}</span><strong><SummaryCurrencyLines summary={allSummary.data} field="outstanding" /></strong><small>{c.openInvoices}</small></Card>
    </section> : null}
    {allSummary.data ? <Card className="billing-outstanding-card"><SectionHeading title={c.outstandingByCurrency} description={c.outstandingDescription} action={<span className="billing-open-statuses">{billingStatusLabel(language, "UNPAID")}: {allSummary.data.status_counts.UNPAID} · {billingStatusLabel(language, "PARTIALLY_PAID")}: {allSummary.data.status_counts.PARTIALLY_PAID}</span>} /><div className="billing-currency-summary">{(["SYP", "USD"] as const).map((currency) => <div key={currency}><strong className="bidi-ltr">{currency}</strong><span>{c.invoiced}<b className="bidi-ltr">{formatMoney(allSummary.data.currency_totals[currency].invoiced, currency)}</b></span><span>{c.paidAmount}<b className="bidi-ltr">{formatMoney(allSummary.data.currency_totals[currency].paid, currency)}</b></span><span>{c.outstanding}<b className="bidi-ltr">{formatMoney(allSummary.data.currency_totals[currency].outstanding, currency)}</b></span></div>)}</div></Card> : null}
    {recentInvoices.data ? <section className="billing-overview-section"><SectionHeading title={c.recentInvoices} description={c.recentDescription} action={<Link to={`${base}/invoices`}>{c.viewAllInvoices}</Link>} /><InvoiceList role={role} invoices={recentInvoices.data.results.slice(0, 6)} variant="overview" emptyTitle={c.noRecentInvoices} /></section> : null}
    {todaySummary.data && clinicDate ? <section className="billing-overview-section billing-today-summary"><SectionHeading title={c.todayInvoices} description={c.todayDescription} action={<Link to={`${base}/invoices?date_from=${clinicDate}&date_to=${clinicDate}`}>{c.viewAllToday}</Link>} /><Card className="billing-today-activity"><div><span>{c.invoicesToday}</span><strong>{todaySummary.data.invoice_count}</strong></div><div><span>{c.collectedToday}</span><strong><CurrencyLines values={todaySummary.data.payments_collected_in_period} /></strong></div></Card></section> : null}
  </main>;
}

function applyPreset(
  preset: Exclude<InvoiceDatePreset, "CUSTOM">,
  clinicDate: string,
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
) {
  const next = new URLSearchParams(searchParams);
  const range = dateRangeForPreset(preset, clinicDate);
  if (range.date_from) next.set("date_from", range.date_from); else next.delete("date_from");
  if (range.date_to) next.set("date_to", range.date_to); else next.delete("date_to");
  next.delete("page");
  setSearchParams(next);
}

export function InvoiceHistoryPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = invoiceQueryFromSearch(searchParams);
  const invoices = useInvoices(query);
  const summary = useInvoiceSummary(query);
  const clinicDate = summary.data?.clinic_date ?? "";
  const activePreset = clinicDate ? activeDatePreset(searchParams.get("date_from") ?? "", searchParams.get("date_to") ?? "", clinicDate) : "ALL_TIME";
  const currentPage = Number(searchParams.get("page") || "1");

  return <main className="billing-page billing-history-page"><BillingWorkspaceHeader role={role} /><div className="billing-page-intro"><div><p className="billing-eyebrow">{clinicDate ? `${c.clinicDate}: ${clinicDate}` : c.invoices}</p><h2>{c.historyTitle}</h2><p>{c.historyDescription}</p></div>{role === "STAFF" ? <Link className="button primary" to="/staff/billing/invoices/new">{c.newInvoice}</Link> : null}</div>
    <Card className="billing-date-filter-card"><div className="billing-date-presets" role="group" aria-label={c.period}>{(["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "ALL_TIME"] as const).map((preset) => <button type="button" key={preset} aria-pressed={activePreset === preset} disabled={!clinicDate} onClick={() => applyPreset(preset, clinicDate, searchParams, setSearchParams)}>{preset === "TODAY" ? c.today : preset === "LAST_7_DAYS" ? c.last7 : preset === "LAST_30_DAYS" ? c.last30 : c.allTime}</button>)}<span className={activePreset === "CUSTOM" ? "active" : ""}>{c.custom}</span></div><div className="billing-custom-dates"><label>{c.from}<input type="date" value={searchParams.get("date_from") ?? ""} max={searchParams.get("date_to") || undefined} onChange={(event) => setSearchValue(searchParams, setSearchParams, "date_from", event.target.value)} /></label><label>{c.to}<input type="date" value={searchParams.get("date_to") ?? ""} min={searchParams.get("date_from") || undefined} onChange={(event) => setSearchValue(searchParams, setSearchParams, "date_to", event.target.value)} /></label></div></Card>
    {summary.isLoading ? <LoadingState title={c.loadingInvoices} /> : null}{summary.isError ? <ErrorState error={summary.error} title={c.unavailableInvoices} onRetry={() => void summary.refetch()} /> : null}
    {summary.data ? <section className="billing-summary-grid billing-history-summary" aria-label={c.financialSummary}><Card className="billing-summary-card"><span>{c.invoiceCount}</span><strong>{summary.data.invoice_count}</strong><small>{c.period}</small></Card><Card className="billing-summary-card"><span>{c.open}</span><strong>{summary.data.open_invoice_count}</strong><small>{billingStatusLabel(language, "UNPAID")} + {billingStatusLabel(language, "PARTIALLY_PAID")}</small></Card><Card className="billing-summary-card"><span>{c.paid}</span><strong><SummaryCurrencyLines summary={summary.data} field="paid" /></strong><small>{c.period}</small></Card><Card className="billing-summary-card"><span>{c.outstanding}</span><strong><SummaryCurrencyLines summary={summary.data} field="outstanding" /></strong><small>{c.period}</small></Card></section> : null}
    <Card className="billing-filter-card"><div className="billing-history-filters"><label>{c.search}<input type="search" value={searchParams.get("search") ?? ""} placeholder={c.searchPlaceholder} onChange={(event) => setSearchValue(searchParams, setSearchParams, "search", event.target.value)} /></label><label>{c.status}<select aria-label={c.status} value={searchParams.get("status") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "status", event.target.value)}><option value="">{c.allStatuses}</option>{invoiceStatuses.map((status) => <option value={status} key={status}>{billingStatusLabel(language, status)}</option>)}</select></label><label>{c.currency}<select aria-label={c.currency} value={searchParams.get("currency") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "currency", event.target.value)}><option value="">{c.allCurrencies}</option><option value="SYP">SYP</option><option value="USD">USD</option></select></label><div className="billing-filter-actions"><span>{invoices.data ? `${invoices.data.count} ${c.records}` : ""}</span>{searchParams.size ? <button className="button secondary" type="button" onClick={() => setSearchParams({})}>{c.clearFilters}</button> : null}</div></div></Card>
    {invoices.isLoading ? <LoadingState title={c.loadingInvoices} /> : null}{invoices.isError ? <ErrorState error={invoices.error} title={c.unavailableInvoices} onRetry={() => void invoices.refetch()} /> : null}{invoices.data ? <><InvoiceList role={role} invoices={invoices.data.results} /><Pagination page={currentPage} hasPrevious={Boolean(invoices.data.previous)} hasNext={Boolean(invoices.data.next)} onPrevious={() => setSearchValue(searchParams, setSearchParams, "page", String(Math.max(1, currentPage - 1)), false)} onNext={() => setSearchValue(searchParams, setSearchParams, "page", String(currentPage + 1), false)} labels={{ page: `${invoices.data.count} ${c.records} · ${c.page}`, previous: c.previous, next: c.next }} /></> : null}
  </main>;
}
