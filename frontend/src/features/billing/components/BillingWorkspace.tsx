import type { ReactNode } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Pagination } from "../../../components/v2";
import type { UserRole } from "../../../types/auth";
import { billingCopy } from "../i18n";
import { useHandoffSummary, useHandoffs, useInvoiceSummary, useInvoices } from "../hooks/useBilling";
import { formatMoney } from "../utils/billing";
import { activeDatePreset, dateRangeForPreset, invoiceQueryFromSearch, type InvoiceDatePreset } from "../utils/billingQuery";
import { HandoffList, InvoiceList } from "./BillingLists";

function setSearchValue(searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1], key: string, value: string, resetPage = true) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value); else next.delete(key);
  if (resetPage) next.delete("page");
  setSearchParams(next);
}

export function BillingWorkspaceHeader({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const c = billingCopy(useAuthStore((state) => state.user?.language_preference ?? "EN"));
  const base = `/${role.toLowerCase()}/billing`;
  return <header className="billing-workspace-header"><div><p>{role === "ADMIN" ? c.adminWorkspace : c.staffWorkspace}</p><h1>{c.billing}</h1><span>{c.billingDescription}</span></div><nav className="billing-workspace-tabs" aria-label={c.billing}><NavLink to={`${base}/overview`}>{c.overview}</NavLink><NavLink to={`${base}/handoffs`}>{c.handoffs}</NavLink><NavLink to={`${base}/invoices`}>{c.invoices}</NavLink></nav></header>;
}

function CurrencyLines({ values }: { values: Record<"SYP" | "USD", string> }) {
  return <span className="billing-currency-lines">{(["SYP", "USD"] as const).map((currency) => <span className="bidi-ltr" key={currency}>{formatMoney(values[currency] ?? "0.00", currency)}</span>)}</span>;
}

function SectionHeading({ title, action }: { title: string; action: ReactNode }) {
  return <header className="billing-section-heading"><h2>{title}</h2>{action}</header>;
}

export function BillingOverviewPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const c = billingCopy(useAuthStore((state) => state.user?.language_preference ?? "EN"));
  const base = `/${role.toLowerCase()}/billing`;
  const bills = useHandoffSummary();
  const clinicDate = bills.data?.clinic_date;
  const today = clinicDate ? { date_from: clinicDate, date_to: clinicDate } : undefined;
  const todayInvoices = useInvoiceSummary(today, Boolean(clinicDate));
  const recentBills = useHandoffs({ page: 1 });
  const recentInvoices = useInvoices({ page: 1 });
  const queries = [bills, todayInvoices, recentBills, recentInvoices];
  const error = queries.find((query) => query.isError);

  return <main className="billing-page billing-overview-page"><BillingWorkspaceHeader role={role} />
    <div className="billing-page-intro"><div><p className="billing-eyebrow">{clinicDate ?? c.overview}</p><h2>{c.overviewTitle}</h2><p>{c.overviewDescription}</p></div></div>
    {queries.some((query) => query.isLoading) && !bills.data ? <LoadingState title={c.loading} /> : null}
    {error ? <ErrorState error={error.error} title={c.unavailable} onRetry={() => queries.forEach((query) => void query.refetch())} /> : null}
    {bills.data && todayInvoices.data ? <section className="billing-kpi-grid" aria-label={c.overviewTitle}>
      <Link className="billing-kpi-card" to={`${base}/handoffs?status=OPEN`}><span>{c.openBills}</span><strong>{bills.data.open_count}</strong></Link>
      <Link className="billing-kpi-card" to={`${base}/handoffs?status=PARTIALLY_PAID`}><span>{c.partiallyPaidBills}</span><strong>{bills.data.partially_paid_count}</strong></Link>
      <Link className="billing-kpi-card" to={`${base}/invoices?date_from=${clinicDate}&date_to=${clinicDate}`}><span>{c.invoicesToday}</span><strong>{todayInvoices.data.invoice_count}</strong></Link>
      <Card className="billing-kpi-card billing-kpi-static"><span>{c.collectedToday}</span><strong><CurrencyLines values={todayInvoices.data.collected_by_currency} /></strong></Card>
    </section> : null}
    {bills.data ? <Card className="billing-outstanding-card"><SectionHeading title={c.outstandingByCurrency} action={<Link to={`${base}/handoffs`}>{c.viewAll}</Link>} /><div className="billing-currency-summary">{(["SYP", "USD"] as const).map((currency) => <div key={currency}><strong dir="ltr">{currency}</strong><span>{c.billTotal}<b dir="ltr">{formatMoney(bills.data.currency_totals[currency].bill_total, currency)}</b></span><span>{c.paid}<b dir="ltr">{formatMoney(bills.data.currency_totals[currency].paid, currency)}</b></span><span>{c.remaining}<b dir="ltr">{formatMoney(bills.data.currency_totals[currency].outstanding, currency)}</b></span></div>)}</div></Card> : null}
    <div className="billing-overview-split">
      {recentBills.data ? <section className="billing-overview-section"><SectionHeading title={c.recentBills} action={<Link to={`${base}/handoffs`}>{c.viewAll}</Link>} /><HandoffList role={role} handoffs={recentBills.data.results.slice(0, 5)} compact /></section> : null}
      {recentInvoices.data ? <section className="billing-overview-section"><SectionHeading title={c.recentInvoices} action={<Link to={`${base}/invoices`}>{c.viewAll}</Link>} /><InvoiceList role={role} invoices={recentInvoices.data.results.slice(0, 5)} compact /></section> : null}
    </div>
  </main>;
}

function applyPreset(preset: Exclude<InvoiceDatePreset, "CUSTOM">, clinicDate: string, searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1]) {
  const next = new URLSearchParams(searchParams);
  const range = dateRangeForPreset(preset, clinicDate);
  if (range.date_from) next.set("date_from", range.date_from); else next.delete("date_from");
  if (range.date_to) next.set("date_to", range.date_to); else next.delete("date_to");
  next.delete("page");
  setSearchParams(next);
}

export function BillingDateFilters({ clinicDate, searchParams, setSearchParams }: { clinicDate: string; searchParams: URLSearchParams; setSearchParams: ReturnType<typeof useSearchParams>[1] }) {
  const c = billingCopy(useAuthStore((state) => state.user?.language_preference ?? "EN"));
  const active = clinicDate ? activeDatePreset(searchParams.get("date_from") ?? "", searchParams.get("date_to") ?? "", clinicDate) : "ALL_TIME";
  return <Card className="billing-date-filter-card"><div className="billing-date-presets" role="group" aria-label={c.period}>{(["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "ALL_TIME"] as const).map((preset) => <button type="button" key={preset} aria-pressed={active === preset} disabled={!clinicDate} onClick={() => applyPreset(preset, clinicDate, searchParams, setSearchParams)}>{preset === "TODAY" ? c.today : preset === "LAST_7_DAYS" ? c.last7 : preset === "LAST_30_DAYS" ? c.last30 : c.allTime}</button>)}<span className={active === "CUSTOM" ? "active" : ""}>{c.custom}</span></div><div className="billing-custom-dates"><label>{c.from}<input type="date" value={searchParams.get("date_from") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "date_from", event.target.value)} /></label><label>{c.to}<input type="date" value={searchParams.get("date_to") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "date_to", event.target.value)} /></label></div></Card>;
}

export function InvoiceHistoryPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  const c = billingCopy(useAuthStore((state) => state.user?.language_preference ?? "EN"));
  const [searchParams, setSearchParams] = useSearchParams();
  const query = invoiceQueryFromSearch(searchParams);
  const invoices = useInvoices(query);
  const summary = useInvoiceSummary(query);
  const page = Number(searchParams.get("page") || "1");
  const clinicDate = summary.data?.clinic_date ?? "";
  return <main className="billing-page billing-history-page"><BillingWorkspaceHeader role={role} /><div className="billing-page-intro"><div><h2>{c.historyTitle}</h2><p>{c.historyDescription}</p></div></div>
    <BillingDateFilters clinicDate={clinicDate} searchParams={searchParams} setSearchParams={setSearchParams} />
    {summary.data ? <section className="billing-summary-grid billing-history-summary"><Card className="billing-summary-card"><span>{c.invoices}</span><strong>{summary.data.invoice_count}</strong></Card><Card className="billing-summary-card"><span>{c.collectedToday}</span><strong><CurrencyLines values={summary.data.collected_by_currency} /></strong></Card></section> : null}
    <Card className="billing-filter-card"><div className="billing-history-filters"><label>{c.search}<input type="search" value={searchParams.get("search") ?? ""} placeholder={c.searchInvoices} onChange={(event) => setSearchValue(searchParams, setSearchParams, "search", event.target.value)} /></label><label>{c.currency}<select value={searchParams.get("currency") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "currency", event.target.value)}><option value="">{c.allCurrencies}</option><option value="SYP">SYP</option><option value="USD">USD</option></select></label><div className="billing-filter-actions"><span>{invoices.data ? `${invoices.data.count} ${c.records}` : ""}</span>{searchParams.size ? <button className="button secondary" type="button" onClick={() => setSearchParams({})}>{c.clearFilters}</button> : null}</div></div></Card>
    {invoices.isLoading ? <LoadingState title={c.loading} /> : null}{invoices.isError ? <ErrorState error={invoices.error} title={c.unavailable} onRetry={() => void invoices.refetch()} /> : null}{invoices.data ? <><InvoiceList role={role} invoices={invoices.data.results} /><Pagination page={page} hasPrevious={Boolean(invoices.data.previous)} hasNext={Boolean(invoices.data.next)} onPrevious={() => setSearchValue(searchParams, setSearchParams, "page", String(Math.max(1, page - 1)), false)} onNext={() => setSearchValue(searchParams, setSearchParams, "page", String(page + 1), false)} labels={{ page: `${invoices.data.count} ${c.records} · ${c.page}`, previous: c.previous, next: c.next }} /></> : null}
  </main>;
}
