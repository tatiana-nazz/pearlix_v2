import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import type { UserRole } from "../../../types/auth";
import { HandoffList, InvoiceList } from "../../billing/components/BillingLists";
import { useHandoffSummary, useHandoffs, useInvoices } from "../../billing/hooks/useBilling";
import { formatMoney } from "../../billing/utils/billing";

interface PatientBillingSummaryProps {
  role: UserRole;
  patientId?: number;
}

export function PatientBillingSummary({ role, patientId = 0 }: PatientBillingSummaryProps) {
  const enabled = role !== "DOCTOR" && patientId > 0;
  const summary = useHandoffSummary({ patient_id: patientId }, enabled);
  const handoffs = useHandoffs({ patient_id: patientId, page: 1 }, enabled);
  const invoices = useInvoices({ patient_id: patientId, page: 1 }, enabled);

  if (role === "DOCTOR") {
    return <Card><SectionHeader title="Billing" description="Financial records are not available in the Doctor workspace." /></Card>;
  }
  if (summary.isLoading || handoffs.isLoading || invoices.isLoading) return <LoadingState title="Loading patient billing…" />;
  if (summary.isError || handoffs.isError || invoices.isError) return <ErrorState error={summary.error ?? handoffs.error ?? invoices.error} title="Patient billing unavailable" onRetry={() => { void summary.refetch(); void handoffs.refetch(); void invoices.refetch(); }} />;
  if (!summary.data || !handoffs.data || !invoices.data) return <EmptyState title="No patient billing data is available." />;

  return <section className="patient-billing-workspace">
    <SectionHeader title="Billing" description="Bills first, followed by the immutable payment invoices issued against them." />
    <div className="patient-billing-summary-grid">
      <Card><span>Open bills</span><strong>{summary.data.open_count}</strong></Card>
      <Card><span>Partially paid</span><strong>{summary.data.partially_paid_count}</strong></Card>
      <Card><span>Outstanding SYP</span><strong dir="ltr">{formatMoney(summary.data.currency_totals.SYP.outstanding, "SYP")}</strong></Card>
      <Card><span>Outstanding USD</span><strong dir="ltr">{formatMoney(summary.data.currency_totals.USD.outstanding, "USD")}</strong></Card>
    </div>
    <section className="patient-billing-section"><div className="billing-section-heading"><h3>Handoffs</h3><Link to={`/${role.toLowerCase()}/billing/handoffs?patient_id=${patientId}`}>View all bills</Link></div><HandoffList role={role} handoffs={handoffs.data.results.slice(0, 5)} /></section>
    <section className="patient-billing-section"><div className="billing-section-heading"><h3>Invoices</h3><Link to={`/${role.toLowerCase()}/billing/invoices?patient_id=${patientId}`}>View all invoices</Link></div><InvoiceList role={role} invoices={invoices.data.results.slice(0, 5)} compact /></section>
  </section>;
}
