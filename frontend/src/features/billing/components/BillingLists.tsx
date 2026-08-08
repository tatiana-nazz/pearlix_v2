import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import { billingCopy, billingStatusLabel } from "../i18n";
import { displayBillingDate, displayBillingText, formatMoney } from "../utils/billing";

function rowKeyboardOpen(event: KeyboardEvent<HTMLTableRowElement>, onOpen: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); }
}

export function HandoffList({ role, handoffs, compact = false }: { role: UserRole; handoffs: BillingHandoff[]; compact?: boolean }) {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  if (!handoffs.length) return <EmptyState title={c.noBills} />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>{c.patient}</th><th>{c.treatment}</th>{compact ? null : <th>{c.doctor}</th>}<th className="amount-cell">{c.billTotal}</th><th className="amount-cell">{c.paid}</th><th className="amount-cell">{c.remaining}</th><th>{c.status}</th>{compact ? null : <th>{c.created}</th>}</tr></thead><tbody>{handoffs.map((handoff) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`);
    const patientPath = `/${role.toLowerCase()}/patients/${handoff.patient.id}?tab=billing`;
    return <tr key={handoff.id} className="clickable-row" tabIndex={0} aria-label={`Open bill ${handoff.id} for ${handoff.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}>
      <td><Link className="billing-patient-link" to={patientPath} onClick={(event) => event.stopPropagation()}>{handoff.patient.full_name}</Link></td>
      <td>{displayBillingText(handoff.description)}<small className="billing-row-description" dir="ltr">Bill #{handoff.id}</small></td>
      {compact ? null : <td>{handoff.doctor?.full_name ?? "—"}</td>}
      <td className="amount-cell bidi-ltr">{formatMoney(handoff.total_amount, handoff.currency)}</td>
      <td className="amount-cell bidi-ltr">{formatMoney(handoff.paid_amount, handoff.currency)}</td>
      <td className="amount-cell bidi-ltr">{formatMoney(handoff.remaining_amount, handoff.currency)}</td>
      <td><StatusPill status={handoff.status} label={billingStatusLabel(language, handoff.status)} /></td>
      {compact ? null : <td className="bidi-ltr">{displayBillingDate(handoff.created_at)}</td>}
    </tr>;
  })}</tbody></table></div></Card>;
}

export function InvoiceList({ role, invoices, compact = false, handoffContext = false }: { role: UserRole; invoices: Invoice[]; compact?: boolean; handoffContext?: boolean }) {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  if (!invoices.length) return <EmptyState title={c.noInvoices} />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>{c.invoiceNumber}</th>{handoffContext ? null : <><th>{c.patient}</th><th>{c.handoff}</th></>}<th>{c.paymentDate}</th><th className="amount-cell">{c.amount}</th>{handoffContext ? <th>Notes</th> : <th>{c.currency}</th>}{compact ? null : <th>{c.issuedBy}</th>}</tr></thead><tbody>{invoices.map((invoice) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/invoices/${invoice.id}`);
    const patientPath = `/${role.toLowerCase()}/patients/${invoice.patient.id}?tab=billing`;
    return <tr key={invoice.id} className="clickable-row" tabIndex={0} aria-label={`Invoice ${invoice.invoice_number}, ${invoice.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}>
      <td className="bidi-ltr"><strong>{invoice.invoice_number}</strong></td>
      {handoffContext ? null : <><td><Link className="billing-patient-link" to={patientPath} onClick={(event) => event.stopPropagation()}>{invoice.patient.full_name}</Link></td><td className="bidi-ltr">#{invoice.billing_handoff_id}</td></>}
      <td className="bidi-ltr">{displayBillingDate(invoice.issued_at)}</td>
      <td className="amount-cell bidi-ltr">{formatMoney(invoice.amount, invoice.currency)}</td>
      {handoffContext ? <td>{displayBillingText(invoice.notes)}</td> : <td className="bidi-ltr">{invoice.currency}</td>}
      {compact ? null : <td>{invoice.created_by?.full_name ?? "Staff"}</td>}
    </tr>;
  })}</tbody></table></div></Card>;
}
