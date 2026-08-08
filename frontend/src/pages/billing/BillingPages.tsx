import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { Modal, Pagination } from "../../components/v2";
import { PatientPicker } from "../../features/appointments/components/PatientPicker";
import { RecordPaymentDialog } from "../../features/billing/components/BillingDialogs";
import { HandoffList, InvoiceList } from "../../features/billing/components/BillingLists";
import {
  BillingDateFilters,
  BillingOverviewPage as BillingOverview,
  BillingWorkspaceHeader,
  InvoiceHistoryPage,
} from "../../features/billing/components/BillingWorkspace";
import {
  useBillingMutations,
  useHandoff,
  useHandoffSummary,
  useHandoffs,
  useInvoice,
  useInvoicePrintData,
} from "../../features/billing/hooks/useBilling";
import { billingCopy, billingStatusLabel } from "../../features/billing/i18n";
import {
  canManageHandoff,
  displayBillingDate,
  displayBillingDateTime,
  displayBillingText,
  formatMoney,
} from "../../features/billing/utils/billing";
import { handoffQueryFromSearch } from "../../features/billing/utils/billingQuery";
import { usePatient } from "../../features/patients/hooks/usePatient";
import { useAuthStore } from "../../auth/authStore";
import type { UserRole } from "../../types/auth";
import type { PatientListItem } from "../../types/patients";

function setSearchValue(searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1], key: string, value: string, resetPage = true) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value); else next.delete(key);
  if (resetPage) next.delete("page");
  setSearchParams(next);
}

export function BillingOverviewPage({ role }: { role: Exclude<UserRole, "DOCTOR"> }) {
  return <BillingOverview role={role} />;
}

export function BillingHandoffListPage({ role }: { role: UserRole }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = handoffQueryFromSearch(searchParams);
  const handoffs = useHandoffs(query);
  const summary = useHandoffSummary(query);
  const page = Number(searchParams.get("page") || "1");
  const clinicDate = summary.data?.clinic_date ?? "";

  return <main className="billing-page billing-history-page">
    {role === "DOCTOR"
      ? <PageHeader eyebrow="Clinical billing" title="Visit bills" description="Read-only bills generated from your completed visits." />
      : <BillingWorkspaceHeader role={role} />}
    <div className="billing-page-intro"><div><h2>{c.handoffHistoryTitle}</h2><p>{c.handoffHistoryDescription}</p></div>{role === "STAFF" ? <Link className="button primary" to="/staff/billing/handoffs/new">{c.newBill}</Link> : null}</div>
    <BillingDateFilters clinicDate={clinicDate} searchParams={searchParams} setSearchParams={setSearchParams} />
    <Card className="billing-filter-card"><div className="billing-history-filters">
      <label>{c.search}<input type="search" value={searchParams.get("search") ?? ""} placeholder={c.searchBills} onChange={(event) => setSearchValue(searchParams, setSearchParams, "search", event.target.value)} /></label>
      <label>{c.status}<select value={searchParams.get("status") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "status", event.target.value)}><option value="">{c.allStatuses}</option>{["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"].map((status) => <option value={status} key={status}>{billingStatusLabel(language, status)}</option>)}</select></label>
      <label>{c.currency}<select value={searchParams.get("currency") ?? ""} onChange={(event) => setSearchValue(searchParams, setSearchParams, "currency", event.target.value)}><option value="">{c.allCurrencies}</option><option value="SYP">SYP</option><option value="USD">USD</option></select></label>
      <div className="billing-filter-actions"><span>{handoffs.data ? `${handoffs.data.count} ${c.records}` : ""}</span>{searchParams.size ? <button className="button secondary" type="button" onClick={() => setSearchParams({})}>{c.clearFilters}</button> : null}</div>
    </div></Card>
    {handoffs.isLoading ? <LoadingState title={c.loading} /> : null}
    {handoffs.isError ? <ErrorState error={handoffs.error} title={c.unavailable} onRetry={() => void handoffs.refetch()} /> : null}
    {handoffs.data ? <><HandoffList role={role} handoffs={handoffs.data.results} /><Pagination page={page} hasPrevious={Boolean(handoffs.data.previous)} hasNext={Boolean(handoffs.data.next)} onPrevious={() => setSearchValue(searchParams, setSearchParams, "page", String(Math.max(1, page - 1)), false)} onNext={() => setSearchValue(searchParams, setSearchParams, "page", String(page + 1), false)} labels={{ page: `${handoffs.data.count} ${c.records} · ${c.page}`, previous: c.previous, next: c.next }} /></> : null}
  </main>;
}

export function BillingHandoffDetailPage({ role }: { role: UserRole }) {
  const handoffId = Number(useParams().handoffId);
  const handoff = useHandoff(handoffId);
  const mutations = useBillingMutations();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"SYP" | "USD">("SYP");
  const [note, setNote] = useState("");
  const [cancelledReason, setCancelledReason] = useState("");
  const [success, setSuccess] = useState("");

  if (handoff.isLoading) return <LoadingState title="Loading bill…" />;
  if (handoff.isError) return <ErrorState error={handoff.error} title="Bill unavailable" onRetry={() => void handoff.refetch()} />;
  if (!handoff.data) return <EmptyState title="Bill unavailable." />;

  const item = handoff.data;
  const rolePath = role.toLowerCase();
  const canManage = canManageHandoff(role, item);
  const canPay = canManage && item.status !== "PAID";
  const financialFieldsLocked = item.invoice_count > 0;
  const patientPath = `/${rolePath}/patients/${item.patient.id}?tab=billing`;
  function openEdit() {
    setDescription(item.description);
    setAmount(item.total_amount);
    setCurrency(item.currency);
    setNote(item.note);
    mutations.updateHandoff.reset();
    setEditOpen(true);
  }

  return <main className="billing-page invoice-detail-page">
    <header className="invoice-detail-header"><div><Link className="inline-back-link" to={`/${rolePath}/billing/handoffs`}>Back to Handoffs</Link><div className="invoice-title-line"><h1>Bill #{item.id}</h1><StatusPill status={item.status} /></div><p>{item.description}</p></div><div className="invoice-header-actions"><Link className="button secondary" to={patientPath}>Open Patient</Link>{item.visit ? <Link className="button secondary" to={`/${rolePath}/visits/${item.visit.id}`}>Open Visit</Link> : null}</div></header>
    <div className="invoice-record-grid">
      <Card className="invoice-party-card"><p className="eyebrow">Patient and source</p><h2><Link to={patientPath}>{item.patient.full_name}</Link></h2><p dir="ltr">{item.patient.phone_number || "No phone recorded"}</p><dl className="detail-grid invoice-source-links"><div><dt>Origin</dt><dd>{item.origin === "VISIT_COMPLETION" ? "Completed visit" : item.origin === "MANUAL" ? "Manual bill" : "Migrated financial record"}</dd></div><div><dt>Doctor</dt><dd>{item.doctor?.full_name ?? "—"}</dd></div><div><dt>Created</dt><dd>{displayBillingDateTime(item.created_at)}</dd></div><div><dt>Updated</dt><dd>{displayBillingDateTime(item.updated_at)}</dd></div><div><dt>Created by</dt><dd>{item.created_by?.full_name ?? "System"}</dd></div>{item.visit ? <><div><dt>Visit</dt><dd><Link to={`/${rolePath}/visits/${item.visit.id}`}>Visit #{item.visit.id}</Link></dd></div><div><dt>Appointment</dt><dd><Link to={`/${rolePath}/appointments/${item.visit.appointment.id}`}>Appointment #{item.visit.appointment.id}</Link></dd></div></> : null}</dl></Card>
      <Card className="invoice-financial-card"><p className="eyebrow">Bill summary</p><section className="invoice-financial-summary" aria-label="Bill financial summary"><div><span>Bill total</span><strong dir="ltr">{formatMoney(item.total_amount, item.currency)}</strong></div><div><span>Paid</span><strong dir="ltr">{formatMoney(item.paid_amount, item.currency)}</strong></div><div><span>Remaining</span><strong dir="ltr">{formatMoney(item.remaining_amount, item.currency)}</strong></div></section><dl className="invoice-description-list"><div><dt>Treatment</dt><dd>{item.description}</dd></div><div><dt>Notes</dt><dd>{displayBillingText(item.note)}</dd></div>{item.cancelled_reason ? <div><dt>Cancellation reason</dt><dd>{item.cancelled_reason}</dd></div> : null}</dl>{item.status === "PAID" ? <p className="billing-success" role="status">Fully paid</p> : null}{success ? <p className="billing-success" role="status">{success}</p> : null}{role === "STAFF" ? <><div className="billing-detail-actions">{canPay ? <button className="button primary" type="button" onClick={() => { mutations.issueInvoice.reset(); setPaymentOpen(true); }}>Record payment & issue invoice</button> : null}{canManage ? <button className="button secondary" type="button" onClick={openEdit}>Edit bill</button> : null}</div>{canManage && item.invoice_count === 0 ? <div className="action-danger-area"><p>Cancellation preserves this bill in financial history.</p><button className="button danger" type="button" onClick={() => setCancelOpen(true)}>Cancel bill</button></div> : null}</> : <p className="form-note">This bill is read-only in your workspace.</p>}</Card>
    </div>
    <section className="billing-payment-history"><div><h2>Issued invoices</h2><p>{item.invoice_count} payment receipt{item.invoice_count === 1 ? "" : "s"}</p></div><InvoiceList role={role} invoices={item.invoices} handoffContext /></section>
    {paymentOpen ? <RecordPaymentDialog handoff={item} pending={mutations.issueInvoice.isPending} error={mutations.issueInvoice.error} onCancel={() => setPaymentOpen(false)} onSubmit={(payload) => void mutations.issueInvoice.mutateAsync({ handoffId: item.id, payload }).then((result) => { setPaymentOpen(false); setSuccess(`Invoice ${result.invoice.invoice_number} issued.`); })} /> : null}
    {editOpen ? <Modal open title="Edit bill" description={financialFieldsLocked ? "Total and currency are locked because invoice history exists." : "Financial fields can be changed until the first invoice is issued."} onClose={() => setEditOpen(false)} pending={mutations.updateHandoff.isPending} dirty={description !== item.description || amount !== item.total_amount || currency !== item.currency || note !== item.note}><form className="invoice-edit-form" onSubmit={(event) => { event.preventDefault(); const payload = financialFieldsLocked ? { description, note } : { description, total_amount: amount, currency, note }; void mutations.updateHandoff.mutateAsync({ handoffId: item.id, payload }).then(() => { setEditOpen(false); setSuccess("Bill updated."); }); }}><label>Description<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="invoice-form-grid"><label>Total amount<input required disabled={financialFieldsLocked} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<select disabled={financialFieldsLocked} value={currency} onChange={(event) => setCurrency(event.target.value as "SYP" | "USD")}><option value="SYP">SYP</option><option value="USD">USD</option></select></label></div><label>Notes<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>{mutations.updateHandoff.error ? <ErrorState error={mutations.updateHandoff.error} title="Unable to update bill" /> : null}<div className="form-actions"><button className="button secondary" type="button" onClick={() => setEditOpen(false)}>Cancel</button><button className="button primary" disabled={mutations.updateHandoff.isPending}>Save bill</button></div></form></Modal> : null}
    {cancelOpen ? <Modal open title="Cancel bill" description="Only bills without invoice history can be cancelled." onClose={() => setCancelOpen(false)} pending={mutations.cancelHandoff.isPending}><label>Reason <span>(optional)</span><textarea rows={3} value={cancelledReason} onChange={(event) => setCancelledReason(event.target.value)} /></label>{mutations.cancelHandoff.error ? <ErrorState error={mutations.cancelHandoff.error} title="Unable to cancel bill" /> : null}<div className="form-actions"><button className="button secondary" type="button" onClick={() => setCancelOpen(false)}>Keep bill</button><button className="button danger" type="button" disabled={mutations.cancelHandoff.isPending} onClick={() => void mutations.cancelHandoff.mutateAsync({ handoffId: item.id, reason: cancelledReason }).then(() => { setCancelOpen(false); setSuccess("Bill cancelled."); })}>Cancel bill</button></div></Modal> : null}
  </main>;
}

export function InvoiceListPage({ role }: { role: UserRole }) {
  if (role === "DOCTOR") return <Navigate to="/doctor/dashboard" replace />;
  return <InvoiceHistoryPage role={role} />;
}

export function InvoiceDetailPage({ role }: { role: UserRole }) {
  const invoiceId = Number(useParams().invoiceId);
  const invoice = useInvoice(invoiceId);
  const handoff = useHandoff(invoice.data?.billing_handoff_id ?? 0);
  if (invoice.isLoading) return <LoadingState title="Loading invoice…" />;
  if (invoice.isError) return <ErrorState error={invoice.error} title="Invoice unavailable" onRetry={() => void invoice.refetch()} />;
  if (!invoice.data) return <EmptyState title="Invoice unavailable." />;
  const item = invoice.data;
  const rolePath = role.toLowerCase();
  return <main className="billing-page invoice-detail-page"><header className="invoice-detail-header"><div><Link className="inline-back-link" to={`/${rolePath}/billing/invoices`}>Back to Invoices</Link><div className="invoice-title-line"><h1 dir="ltr">{item.invoice_number}</h1><StatusPill status="PAID" label="Payment receipt" /></div><p>{item.description}</p></div><div className="invoice-header-actions"><Link className="button secondary" to={`/${rolePath}/billing/handoffs/${item.billing_handoff_id}`}>Open Handoff</Link><Link className="button secondary" to={`/${rolePath}/patients/${item.patient.id}?tab=billing`}>Open Patient</Link><Link className="button primary" to={`/${rolePath}/billing/invoices/${item.id}/print`}>Print invoice</Link></div></header><div className="invoice-record-grid"><Card className="invoice-party-card"><p className="eyebrow">Patient and bill</p><h2>{item.patient.full_name}</h2><p dir="ltr">{item.patient.phone_number || "No phone recorded"}</p><dl className="detail-grid"><div><dt>Handoff</dt><dd><Link to={`/${rolePath}/billing/handoffs/${item.billing_handoff_id}`}>#{item.billing_handoff_id}</Link></dd></div><div><dt>Payment date</dt><dd>{displayBillingDateTime(item.issued_at)}</dd></div><div><dt>Issued by</dt><dd>{item.created_by?.full_name ?? "Staff"}</dd></div><div><dt>Currency</dt><dd dir="ltr">{item.currency}</dd></div></dl></Card><Card className="invoice-financial-card"><p className="eyebrow">Payment received</p><div className="receipt-payment-total"><strong dir="ltr">{formatMoney(item.amount, item.currency)}</strong></div><dl className="invoice-description-list"><div><dt>Treatment</dt><dd>{item.description}</dd></div><div><dt>Notes</dt><dd>{displayBillingText(item.notes)}</dd></div></dl><p className="form-note">Invoices are immutable payment receipts. Bill totals and remaining balance are managed on the linked Handoff.</p></Card></div>{handoff.isLoading ? <LoadingState title="Loading Handoff context…" /> : null}{handoff.data ? <Card className="billing-handoff-context"><div className="billing-section-heading"><div><p className="eyebrow">Current Handoff context</p><h2>Bill #{handoff.data.id}</h2></div><StatusPill status={handoff.data.status} /></div><section className="invoice-financial-summary" aria-label="Current Handoff financial summary"><div><span>Bill total</span><strong dir="ltr">{formatMoney(handoff.data.total_amount, handoff.data.currency)}</strong></div><div><span>Total paid</span><strong dir="ltr">{formatMoney(handoff.data.paid_amount, handoff.data.currency)}</strong></div><div><span>Current remaining</span><strong dir="ltr">{formatMoney(handoff.data.remaining_amount, handoff.data.currency)}</strong></div></section><div className="billing-detail-actions"><Link className="button secondary" to={`/${rolePath}/billing/handoffs/${handoff.data.id}`}>Open Handoff</Link>{handoff.data.visit ? <><Link className="button secondary" to={`/${rolePath}/visits/${handoff.data.visit.id}`}>Open Visit</Link><Link className="button secondary" to={`/${rolePath}/appointments/${handoff.data.visit.appointment.id}`}>Open Appointment</Link></> : null}</div></Card> : null}</main>;
}

export function NewBillPage() {
  const [searchParams] = useSearchParams();
  const initialPatientId = Number(searchParams.get("patient_id") || "0");
  const initialPatient = usePatient(initialPatientId);
  const mutations = useBillingMutations();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"SYP" | "USD">("SYP");
  const [note, setNote] = useState("");
  const [patientError, setPatientError] = useState("");
  useEffect(() => { if (initialPatient.data) setPatient(initialPatient.data); }, [initialPatient.data]);
  return <main className="billing-page new-invoice-page"><PageHeader eyebrow="Staff workspace" title="New Bill" description="Create a financial obligation for a patient. Payments are recorded later as invoices." actions={<Link className="button secondary" to="/staff/billing/handoffs">Back to Handoffs</Link>} />{initialPatientId > 0 && initialPatient.isLoading ? <LoadingState title="Loading selected patient…" /> : null}{initialPatientId > 0 && initialPatient.isError ? <ErrorState error={initialPatient.error} title="Selected patient unavailable" /> : null}<Card className="new-invoice-card"><form className="new-invoice-form" onSubmit={(event) => { event.preventDefault(); if (!patient) { setPatientError("Select a patient before creating a bill."); return; } void mutations.createHandoff.mutateAsync({ patient_id: patient.id, description: description.trim(), total_amount: amount, currency, note }).then((created) => navigate(`/staff/billing/handoffs/${created.id}`)); }}><div className="invoice-form-wide">{patient && initialPatientId > 0 ? <div className="patient-context-banner"><span>Patient</span><strong>{patient.full_name}</strong><small>The patient is fixed for this bill.</small></div> : <PatientPicker selectedPatient={patient} error={patientError} onSelect={(selected) => { setPatient(selected); setPatientError(""); }} onClear={() => setPatient(null)} />}</div><label className="invoice-form-wide">Treatment or service<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Bill total<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value as "SYP" | "USD")}><option value="SYP">SYP</option><option value="USD">USD</option></select></label><label className="invoice-form-wide">Notes <span>(optional)</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>{mutations.createHandoff.error ? <div className="invoice-form-wide"><ErrorState error={mutations.createHandoff.error} title="Unable to create bill" /></div> : null}<div className="form-actions invoice-form-wide"><Link className="button secondary" to="/staff/billing/handoffs">Cancel</Link><button className="button primary" disabled={mutations.createHandoff.isPending}>{mutations.createHandoff.isPending ? "Creating…" : "Create bill"}</button></div></form></Card></main>;
}

type PrintData = {
  clinic?: { clinic_name?: string; address?: string; phone?: string; email?: string };
  invoice?: { id?: number; invoice_number?: string; issued_at?: string; amount?: string; notes?: string; issued_by?: string };
  patient?: { full_name?: string; phone_number?: string; email?: string };
  handoff?: { id?: number; description?: string; total_amount?: string; paid_amount?: string; remaining_amount?: string; currency?: string; status?: string };
  visit?: { id?: number } | null;
  appointment?: { id?: number } | null;
};

export function InvoicePrintPage({ role }: { role: UserRole }) {
  const invoiceId = Number(useParams().invoiceId);
  const data = useInvoicePrintData(invoiceId);
  const printData = data.data as PrintData | undefined;
  const rolePath = role.toLowerCase();
  const currency = printData?.handoff?.currency;
  return <main className="print-invoice"><div className="print-toolbar"><Link className="button secondary" to={`/${rolePath}/billing/invoices/${invoiceId}`}>Back to invoice</Link><button className="button primary" type="button" onClick={() => window.print()}>Print invoice</button></div>{data.isLoading ? <LoadingState title="Loading print preview…" /> : null}{data.isError ? <ErrorState error={data.error} title="Print data unavailable" onRetry={() => void data.refetch()} /> : null}{printData ? <article className="invoice-document"><header className="invoice-document-header"><div><p className="invoice-clinic-name">{displayBillingText(printData.clinic?.clinic_name, "Clinic")}</p><p>{displayBillingText(printData.clinic?.address)}</p><p dir="ltr">{[printData.clinic?.phone, printData.clinic?.email].filter(Boolean).join(" · ")}</p></div><div><p>PAYMENT INVOICE</p><h1 dir="ltr">{displayBillingText(printData.invoice?.invoice_number)}</h1><StatusPill status="PAID" label="Payment received" /></div></header><section className="invoice-document-party"><div><span>Received from</span><strong>{displayBillingText(printData.patient?.full_name)}</strong><p dir="ltr">{displayBillingText(printData.patient?.phone_number)}</p></div><dl><div><dt>Payment date</dt><dd>{displayBillingDate(printData.invoice?.issued_at)}</dd></div><div><dt>Handoff</dt><dd>#{printData.handoff?.id}</dd></div>{printData.visit?.id ? <div><dt>Visit</dt><dd>#{printData.visit.id}</dd></div> : null}</dl></section><section className="invoice-document-description"><span>Treatment</span><p>{displayBillingText(printData.handoff?.description)}</p></section><section className="invoice-document-totals"><dl><div className="invoice-balance-row"><dt>Payment received</dt><dd dir="ltr">{currency && printData.invoice?.amount ? formatMoney(printData.invoice.amount, currency) : "—"}</dd></div><div><dt>Bill total</dt><dd dir="ltr">{currency && printData.handoff?.total_amount ? formatMoney(printData.handoff.total_amount, currency) : "—"}</dd></div><div><dt>Total paid</dt><dd dir="ltr">{currency && printData.handoff?.paid_amount ? formatMoney(printData.handoff.paid_amount, currency) : "—"}</dd></div><div><dt>Bill remaining</dt><dd dir="ltr">{currency && printData.handoff?.remaining_amount ? formatMoney(printData.handoff.remaining_amount, currency) : "—"}</dd></div></dl></section>{printData.invoice?.notes ? <section className="invoice-document-notes"><span>Notes</span><p>{printData.invoice.notes}</p></section> : null}<footer><p>This invoice records one payment against Handoff #{printData.handoff?.id}.</p><p>Issued by {displayBillingText(printData.invoice?.issued_by, "Staff")}.</p></footer></article> : null}</main>;
}
