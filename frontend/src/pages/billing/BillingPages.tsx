import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { Modal, Pagination } from "../../components/v2";
import { PatientPicker } from "../../features/appointments/components/PatientPicker";
import { PaymentDialog } from "../../features/billing/components/BillingDialogs";
import { HandoffList } from "../../features/billing/components/BillingLists";
import {
  BillingOverviewPage as BillingOverview,
  BillingWorkspaceHeader,
  InvoiceHistoryPage,
} from "../../features/billing/components/BillingWorkspace";
import {
  useBillingMutations,
  useHandoff,
  useHandoffs,
  useInvoice,
  useInvoicePayments,
  useInvoicePrintData,
} from "../../features/billing/hooks/useBilling";
import {
  canManageHandoff,
  displayBillingDate,
  displayBillingDateTime,
  displayBillingText,
  formatMoney,
} from "../../features/billing/utils/billing";
import { usePatient } from "../../features/patients/hooks/usePatient";
import type { UserRole } from "../../types/auth";
import type { PatientListItem } from "../../types/patients";

export function BillingOverviewPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  return <BillingOverview role={role} />;
}

function legacyQuery(searchParams: URLSearchParams) {
  return {
    status: searchParams.get("status") || undefined,
    patient_id: searchParams.get("patient_id") || undefined,
    page: searchParams.get("page") || undefined,
  };
}

export function BillingHandoffListPage({ role }: { role: UserRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const handoffs = useHandoffs(legacyQuery(searchParams));
  const page = Number(searchParams.get("page") || "1");

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  return <main className="billing-page">
    {role === "DOCTOR"
      ? <PageHeader eyebrow="Historical record" title="Legacy billing provenance" description="Historical clinical-to-billing records retained for traceability." />
      : <BillingWorkspaceHeader role={role} />}
    <Card className="billing-filter-card"><p className="form-note">This route contains historical provenance only. Current completed visits create invoices immediately.</p></Card>
    {handoffs.isLoading ? <LoadingState title="Loading legacy billing records…" /> : null}
    {handoffs.isError ? <ErrorState error={handoffs.error} title="Legacy billing records unavailable" onRetry={() => void handoffs.refetch()} /> : null}
    {handoffs.data ? <>
      <HandoffList role={role} handoffs={handoffs.data.results} />
      <Pagination page={page} hasPrevious={Boolean(handoffs.data.previous)} hasNext={Boolean(handoffs.data.next)} onPrevious={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} labels={{ page: `${handoffs.data.count} historical records · Page`, previous: "Previous", next: "Next" }} />
    </> : null}
  </main>;
}

export function BillingHandoffDetailPage({ role }: { role: UserRole }) {
  const handoffId = Number(useParams().handoffId);
  const handoff = useHandoff(handoffId);
  const mutations = useBillingMutations();
  const [dismissOpen, setDismissOpen] = useState(false);

  if (handoff.isLoading) return <LoadingState title="Loading legacy billing record…" />;
  if (handoff.isError) return <ErrorState error={handoff.error} title="Legacy billing record unavailable" onRetry={() => void handoff.refetch()} />;
  if (!handoff.data) return <EmptyState title="Legacy billing record unavailable." />;

  const item = handoff.data;
  const canManage = canManageHandoff(role, item);
  return <main className="billing-page">
    <PageHeader eyebrow="Historical record" title="Legacy billing provenance" description="Retained for audit traceability outside the current invoice workflow." />
    <Card className="billing-detail-card">
      <div className="visit-summary-header"><div><h3>{item.patient.full_name}</h3><p>{displayBillingText(item.description, "Historical clinical billing record")}</p></div><StatusPill status={item.status} /></div>
      <dl className="detail-grid">
        <div><dt>Doctor</dt><dd>{item.doctor.full_name}</dd></div>
        <div><dt>Completed visit</dt><dd>{displayBillingDateTime(item.visit.completed_at)}</dd></div>
        <div><dt>Historical amount</dt><dd dir="ltr">{item.suggested_amount && item.currency ? formatMoney(item.suggested_amount, item.currency) : "—"}</dd></div>
        <div><dt>Created</dt><dd>{displayBillingDate(item.created_at)}</dd></div>
        <div className="detail-wide"><dt>Notes</dt><dd>{displayBillingText(item.note)}</dd></div>
      </dl>
      {item.converted_invoice ? <Link className="button primary" to={`/${role.toLowerCase()}/billing/invoices/${item.converted_invoice.id}`}>Open linked invoice {item.converted_invoice.invoice_number}</Link> : null}
      {canManage ? <div className="action-danger-area"><button className="button danger" type="button" onClick={() => setDismissOpen(true)}>Dismiss legacy record</button></div> : null}
    </Card>
    {dismissOpen ? <Modal open title="Dismiss legacy billing record" onClose={() => setDismissOpen(false)} pending={mutations.dismiss.isPending}>
      <p>The historical record remains available for audit after dismissal.</p>
      {mutations.dismiss.error ? <ErrorState error={mutations.dismiss.error} title="Unable to dismiss record" /> : null}
      <div className="form-actions"><button className="button secondary" type="button" onClick={() => setDismissOpen(false)}>Keep record</button><button className="button danger" type="button" disabled={mutations.dismiss.isPending} onClick={() => void mutations.dismiss.mutateAsync({ handoffId: item.id }).then(() => setDismissOpen(false))}>Dismiss record</button></div>
    </Modal> : null}
  </main>;
}

export function InvoiceListPage({ role }: { role: UserRole }) {
  return <InvoiceHistoryPage role={role as Exclude<UserRole, "DOCTOR">} />;
}

export function InvoiceDetailPage({ role }: { role: UserRole }) {
  const invoiceId = Number(useParams().invoiceId);
  const invoice = useInvoice(invoiceId);
  const payments = useInvoicePayments(invoiceId);
  const mutations = useBillingMutations();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "SYP">("USD");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  if (invoice.isLoading) return <LoadingState title="Loading invoice…" />;
  if (invoice.isError) return <ErrorState error={invoice.error} title="Invoice unavailable" onRetry={() => void invoice.refetch()} />;
  if (!invoice.data) return <EmptyState title="Invoice unavailable." />;

  const item = invoice.data;
  const rolePath = role.toLowerCase();
  const patientPath = `/${rolePath}/patients/${item.patient.id}?tab=billing`;
  const hasPayments = item.payment_count > 0;
  const canEdit = role === "STAFF" && item.status !== "CANCELLED";
  const canPay = role === "STAFF" && item.status !== "PAID" && item.status !== "CANCELLED";
  const canCancel = role === "STAFF" && item.status !== "PAID" && item.status !== "CANCELLED";

  function openEdit() {
    setDescription(item.description);
    setAmount(item.total_amount);
    setCurrency(item.currency);
    setNotes(item.notes);
    mutations.updateInvoice.reset();
    setEditOpen(true);
  }

  return <main className="billing-page invoice-detail-page">
    <header className="invoice-detail-header">
      <div><Link className="inline-back-link" to={`/${rolePath}/billing/overview`}>Back to Billing</Link><div className="invoice-title-line"><h1 dir="ltr">{item.invoice_number}</h1><StatusPill status={item.status} /></div><p>{displayBillingText(item.description)}</p></div>
      <div className="invoice-header-actions"><Link className="button secondary" to={patientPath}>Open Patient</Link><Link className="button secondary" to={`/${rolePath}/billing/invoices/${item.id}/print`}>Print</Link></div>
    </header>

    <div className="invoice-record-grid">
      <Card className="invoice-party-card" onDoubleClick={() => navigate(patientPath)}>
        <p className="eyebrow">Patient and source</p>
        <h2><Link to={patientPath}>{item.patient.full_name}</Link></h2>
        <p dir="ltr">{item.patient.phone_number || "No phone recorded"}</p>
        <dl className="detail-grid invoice-source-links">
          <div><dt>Issued</dt><dd>{displayBillingDate(item.created_at)}</dd></div>
          <div><dt>Origin</dt><dd>{item.origin === "VISIT_COMPLETION" ? "Completed visit" : item.origin === "LEGACY_HANDOFF" ? "Historical billing record" : "Manual invoice"}</dd></div>
          <div><dt>Created by</dt><dd>{item.created_by?.full_name ?? "System"}</dd></div>
          <div><dt>Updated</dt><dd>{displayBillingDateTime(item.updated_at)}</dd></div>
          {item.visit ? <div><dt>Linked Visit</dt><dd><Link to={`/${rolePath}/visits/${item.visit.id}`}>Visit #{item.visit.id}</Link></dd></div> : null}
          {item.appointment ? <div><dt>Appointment</dt><dd><Link to={`/${rolePath}/appointments/${item.appointment.id}`}>Appointment #{item.appointment.id}</Link></dd></div> : null}
        </dl>
      </Card>

      <Card className="invoice-financial-card">
        <p className="eyebrow">Financial summary</p>
        <section className="invoice-financial-summary" aria-label="Invoice financial summary">
          <div><span>Total</span><strong dir="ltr">{formatMoney(item.total_amount, item.currency)}</strong></div>
          <div><span>Paid</span><strong dir="ltr">{formatMoney(item.paid_amount, item.currency)}</strong></div>
          <div><span>Balance</span><strong dir="ltr">{formatMoney(item.remaining_amount, item.currency)}</strong></div>
        </section>
        <dl className="invoice-description-list"><div><dt>Description</dt><dd>{item.description}</dd></div><div><dt>Notes</dt><dd>{displayBillingText(item.notes)}</dd></div>{item.status === "CANCELLED" ? <div><dt>Cancellation reason</dt><dd>{displayBillingText(item.cancelled_reason)}</dd></div> : null}</dl>
        {success ? <p className="billing-success" role="status">{success}</p> : null}
        {role === "STAFF" ? <>
          <div className="billing-detail-actions">
            {canPay ? <button className="button primary" type="button" onClick={() => { mutations.recordPayment.reset(); setPaymentOpen(true); }}>Record payment</button> : null}
            {canEdit ? <button className="button secondary" type="button" onClick={openEdit}>Edit invoice</button> : null}
            <Link className="button secondary" to={`/${rolePath}/billing/invoices/${item.id}/print`}>Print</Link>
          </div>
          {canCancel ? <div className="action-danger-area"><p>Cancelling closes this invoice without deleting its history.</p><button className="button danger" type="button" onClick={() => { mutations.cancelInvoice.reset(); setCancelOpen(true); }}>Cancel invoice</button></div> : null}
        </> : <p className="form-note">Admin access is read-only.</p>}
      </Card>
    </div>

    <Card className="billing-payment-history">
      <div><h2>Payment history</h2><p>{item.payment_count} recorded payment{item.payment_count === 1 ? "" : "s"}</p></div>
      {payments.isLoading ? <LoadingState title="Loading payments…" /> : null}
      {payments.isError ? <ErrorState error={payments.error} title="Unable to load payment history" onRetry={() => void payments.refetch()} /> : null}
      {payments.data?.length ? <div className="table-scroll"><table className="billing-table payment-history-table"><thead><tr><th>Date</th><th className="amount-cell">Amount</th><th>Notes</th><th>Recorded by</th></tr></thead><tbody>{payments.data.map((payment) => <tr key={payment.id}><td>{displayBillingDateTime(payment.payment_date)}</td><td className="amount-cell" dir="ltr">{formatMoney(payment.amount, payment.currency)}</td><td>{displayBillingText(payment.notes)}</td><td>{payment.created_by?.full_name ?? "Staff"}</td></tr>)}</tbody></table></div> : !payments.isLoading && !payments.isError ? <EmptyState title="No payments recorded." /> : null}
    </Card>

    {editOpen ? <Modal open title="Edit invoice" description={hasPayments ? "Financial fields are locked because a payment exists. Description and notes remain editable." : "Financial fields can be changed until the first payment is recorded."} onClose={() => setEditOpen(false)} pending={mutations.updateInvoice.isPending} dirty={description !== item.description || amount !== item.total_amount || currency !== item.currency || notes !== item.notes}>
      <form className="invoice-edit-form" onSubmit={(event) => { event.preventDefault(); const payload = hasPayments ? { description, notes } : { description, total_amount: amount, currency, notes }; void mutations.updateInvoice.mutateAsync({ invoiceId: item.id, payload }).then(() => { setEditOpen(false); setSuccess("Invoice updated."); }); }}>
        <label>Description<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="invoice-form-grid"><label>Total amount<input required disabled={hasPayments} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<select disabled={hasPayments} value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "SYP")}><option value="USD">USD</option><option value="SYP">SYP</option></select></label></div>
        <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {mutations.updateInvoice.error ? <ErrorState error={mutations.updateInvoice.error} title="Unable to update invoice" /> : null}
        <div className="form-actions"><button className="button secondary" type="button" disabled={mutations.updateInvoice.isPending} onClick={() => setEditOpen(false)}>Cancel</button><button className="button primary" disabled={mutations.updateInvoice.isPending}>Save invoice</button></div>
      </form>
    </Modal> : null}

    {paymentOpen ? <PaymentDialog invoiceNumber={item.invoice_number} currency={item.currency} remainingAmount={item.remaining_amount} pending={mutations.recordPayment.isPending} error={mutations.recordPayment.error} onCancel={() => setPaymentOpen(false)} onSubmit={(payload) => void mutations.recordPayment.mutateAsync({ invoiceId: item.id, payload }).then(() => { setPaymentOpen(false); setSuccess("Payment recorded and the invoice balance was refreshed."); })} /> : null}
    {cancelOpen ? <Modal open title="Cancel invoice" onClose={() => setCancelOpen(false)} pending={mutations.cancelInvoice.isPending}><p>Cancelled invoices remain visible as financial history and cannot receive payments.</p>{mutations.cancelInvoice.error ? <ErrorState error={mutations.cancelInvoice.error} title="Unable to cancel invoice" /> : null}<div className="form-actions"><button className="button secondary" type="button" onClick={() => setCancelOpen(false)}>Keep invoice</button><button className="button danger" type="button" disabled={mutations.cancelInvoice.isPending} onClick={() => void mutations.cancelInvoice.mutateAsync({ invoiceId: item.id }).then(() => { setCancelOpen(false); setSuccess("Invoice cancelled."); })}>Cancel invoice</button></div></Modal> : null}
  </main>;
}

export function NewInvoicePage() {
  const [searchParams] = useSearchParams();
  const initialPatientId = Number(searchParams.get("patient_id") || "0");
  const initialPatient = usePatient(initialPatientId);
  const mutations = useBillingMutations();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "SYP">("USD");
  const [notes, setNotes] = useState("");
  const [patientError, setPatientError] = useState("");

  useEffect(() => {
    if (initialPatient.data) setPatient(initialPatient.data);
  }, [initialPatient.data]);

  return <main className="billing-page new-invoice-page">
    <PageHeader eyebrow="Staff workspace" title="New Invoice" description="Create a patient invoice for a treatment or service." actions={<Link className="button secondary" to="/staff/billing/invoices">Back to invoices</Link>} />
    {initialPatientId > 0 && initialPatient.isLoading ? <LoadingState title="Loading selected patient…" /> : null}
    {initialPatientId > 0 && initialPatient.isError ? <ErrorState error={initialPatient.error} title="Selected patient unavailable" /> : null}
    <Card className="new-invoice-card">
      {patient && initialPatientId > 0 ? <p className="patient-context-banner">Creating invoice for <strong>{patient.full_name}</strong>. You can change or remove this patient below.</p> : null}
      <form className="new-invoice-form" onSubmit={(event) => { event.preventDefault(); if (!patient) { setPatientError("Select a patient before creating an invoice."); return; } void mutations.createInvoice.mutateAsync({ patient_id: patient.id, description: description.trim(), total_amount: amount, currency, notes }).then((created) => navigate(`/staff/billing/invoices/${created.id}`)); }}>
        <div className="invoice-form-wide"><PatientPicker selectedPatient={patient} error={patientError} onSelect={(selected) => { setPatient(selected); setPatientError(""); }} onClear={() => setPatient(null)} /></div>
        <label className="invoice-form-wide">Description<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Treatment or service provided" /></label>
        <label>Total amount<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "SYP")}><option value="USD">USD</option><option value="SYP">SYP</option></select></label>
        <label className="invoice-form-wide">Notes <span>(optional)</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {mutations.createInvoice.error ? <div className="invoice-form-wide"><ErrorState error={mutations.createInvoice.error} title="Unable to create invoice" /></div> : null}
        <div className="form-actions invoice-form-wide"><Link className="button secondary" to="/staff/billing/invoices">Cancel</Link><button className="button primary" disabled={mutations.createInvoice.isPending}>{mutations.createInvoice.isPending ? "Creating…" : "Create invoice"}</button></div>
      </form>
    </Card>
  </main>;
}

type PrintData = {
  clinic?: { clinic_name?: string; address?: string; phone?: string; email?: string };
  invoice?: { invoice_number?: string; created_at?: string; origin?: string };
  patient?: { full_name?: string; phone_number?: string; email?: string };
  visit?: { id?: number } | null;
  appointment?: { id?: number } | null;
  currency?: string;
  total_amount?: string;
  paid_amount?: string;
  remaining_amount?: string;
  status?: string;
  description?: string;
  notes?: string;
  payments?: { id: number; amount: string; currency: string; payment_date: string; notes: string }[];
};

export function InvoicePrintPage({ role }: { role: UserRole }) {
  const invoiceId = Number(useParams().invoiceId);
  const data = useInvoicePrintData(invoiceId);
  const printData = data.data as PrintData | undefined;
  const rolePath = role.toLowerCase();

  return <main className="print-invoice">
    <div className="print-toolbar"><Link className="button secondary" to={`/${rolePath}/billing/invoices/${invoiceId}`}>Back to invoice</Link><button className="button primary" type="button" onClick={() => window.print()}>Print invoice</button></div>
    {data.isLoading ? <LoadingState title="Loading print preview…" /> : null}
    {data.isError ? <ErrorState error={data.error} title="Print data unavailable" onRetry={() => void data.refetch()} /> : null}
    {printData ? <article className="invoice-document">
      <header className="invoice-document-header"><div><p className="invoice-clinic-name">{displayBillingText(printData.clinic?.clinic_name, "Clinic")}</p><p>{displayBillingText(printData.clinic?.address)}</p><p dir="ltr">{[printData.clinic?.phone, printData.clinic?.email].filter(Boolean).join(" · ")}</p></div><div><p>INVOICE</p><h1 dir="ltr">{displayBillingText(printData.invoice?.invoice_number)}</h1><StatusPill status={printData.status || ""} /></div></header>
      <section className="invoice-document-party"><div><span>Bill to</span><strong>{displayBillingText(printData.patient?.full_name)}</strong><p dir="ltr">{displayBillingText(printData.patient?.phone_number)}</p><p dir="ltr">{displayBillingText(printData.patient?.email)}</p></div><dl><div><dt>Issued</dt><dd>{displayBillingDate(printData.invoice?.created_at)}</dd></div>{printData.visit?.id ? <div><dt>Visit</dt><dd>#{printData.visit.id}</dd></div> : null}{printData.appointment?.id ? <div><dt>Appointment</dt><dd>#{printData.appointment.id}</dd></div> : null}</dl></section>
      <section className="invoice-document-description"><span>Description</span><p>{displayBillingText(printData.description)}</p></section>
      <section className="invoice-document-totals"><dl><div><dt>Total</dt><dd dir="ltr">{printData.currency && printData.total_amount ? formatMoney(printData.total_amount, printData.currency) : "—"}</dd></div><div><dt>Paid</dt><dd dir="ltr">{printData.currency && printData.paid_amount ? formatMoney(printData.paid_amount, printData.currency) : "—"}</dd></div><div className="invoice-balance-row"><dt>Balance due</dt><dd dir="ltr">{printData.currency && printData.remaining_amount ? formatMoney(printData.remaining_amount, printData.currency) : "—"}</dd></div></dl></section>
      {printData.notes ? <section className="invoice-document-notes"><span>Notes</span><p>{printData.notes}</p></section> : null}
      <section className="invoice-document-payments"><h2>Payment history</h2>{printData.payments?.length ? <table><thead><tr><th>Date</th><th>Notes</th><th>Amount</th></tr></thead><tbody>{printData.payments.map((payment) => <tr key={payment.id}><td>{displayBillingDateTime(payment.payment_date)}</td><td>{displayBillingText(payment.notes, "Payment")}</td><td dir="ltr">{formatMoney(payment.amount, payment.currency)}</td></tr>)}</tbody></table> : <p>No payments recorded.</p>}</section>
      <footer><p>Thank you for choosing {displayBillingText(printData.clinic?.clinic_name, "our clinic")}.</p><p>Generated from the clinic billing record.</p></footer>
    </article> : null}
  </main>;
}
