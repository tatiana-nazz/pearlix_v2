import { Link, useNavigate } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import { useInvoiceSummary, useInvoices } from "../../billing/hooks/useBilling";
import { displayBillingDate, displayBillingText, formatMoney } from "../../billing/utils/billing";

interface PatientBillingSummaryProps {
  role: UserRole;
  patientId?: number;
}

export function PatientBillingSummary({ role, patientId = 0 }: PatientBillingSummaryProps) {
  const navigate = useNavigate();
  const enabled = role !== "DOCTOR" && patientId > 0;
  const summary = useInvoiceSummary({ patient_id: patientId }, enabled);
  const invoices = useInvoices({ patient_id: patientId, page: 1 }, enabled);
  const rolePath = role.toLowerCase();

  if (role === "DOCTOR") {
    return <Card><SectionHeader title="Billing" description="Invoices and payment records are not available in the Doctor workspace." /></Card>;
  }
  if (summary.isLoading || invoices.isLoading) return <LoadingState title="Loading patient billing…" />;
  if (summary.isError || invoices.isError) return <ErrorState error={summary.error ?? invoices.error} title="Patient billing unavailable" onRetry={() => { void summary.refetch(); void invoices.refetch(); }} />;
  if (!summary.data || !invoices.data) return <EmptyState title="No patient billing data is available." />;

  return <section className="patient-billing-workspace">
    <SectionHeader title="Billing" description="Invoice balances and payment status for this patient." />
    {role === "STAFF" ? <div className="patient-billing-actions"><Link className="button primary" to={`/staff/billing/invoices/new?patient_id=${patientId}`}>New invoice for patient</Link></div> : null}
    <div className="patient-billing-summary-grid">
      <Card><span>Invoices</span><strong>{summary.data.invoice_count}</strong></Card>
      <Card><span>Open invoices</span><strong>{summary.data.open_invoice_count}</strong></Card>
      <Card><span>Outstanding SYP</span><strong dir="ltr">{formatMoney(summary.data.currency_totals.SYP.outstanding, "SYP")}</strong></Card>
      <Card><span>Outstanding USD</span><strong dir="ltr">{formatMoney(summary.data.currency_totals.USD.outstanding, "USD")}</strong></Card>
    </div>
    {invoices.data.results.length ? <Card className="billing-collection-card patient-invoice-list"><div className="table-scroll"><table className="billing-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Description</th><th className="amount-cell">Total</th><th className="amount-cell">Paid</th><th className="amount-cell">Balance</th><th>Status</th></tr></thead><tbody>{invoices.data.results.map((invoice) => {
      const invoicePath = `/${rolePath}/billing/invoices/${invoice.id}`;
      return <tr key={invoice.id} className="clickable-row" tabIndex={0} onClick={() => navigate(invoicePath)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(invoicePath); } }}><td dir="ltr">{invoice.invoice_number}</td><td>{displayBillingDate(invoice.created_at)}</td><td>{displayBillingText(invoice.description)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.total_amount, invoice.currency)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td><StatusPill status={invoice.status} /></td></tr>;
    })}</tbody></table></div></Card> : <EmptyState title="No invoices for this patient." />}
  </section>;
}
