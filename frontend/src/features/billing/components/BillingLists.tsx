import { useNavigate } from "react-router-dom";
import type { KeyboardEvent } from "react";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import type { UserRole } from "../../../types/auth";
import { displayBillingDate, displayBillingText, formatMoney } from "../utils/billing";

function rowKeyboardOpen(event: KeyboardEvent<HTMLTableRowElement>, onOpen: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); }
}

export function HandoffList({ role, handoffs }: { role: UserRole; handoffs: BillingHandoff[] }) {
  const navigate = useNavigate();
  if (!handoffs.length) return <EmptyState title="No billing handoffs found." />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Completed visit</th><th>Description</th><th className="amount-cell">Suggested amount</th><th>Created</th><th>Status</th></tr></thead><tbody>{handoffs.map((handoff) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`);
    const description = (handoff as BillingHandoff & { description?: string }).description;
    return <tr key={handoff.id} className="clickable-row" tabIndex={0} aria-label={`Open billing handoff for ${handoff.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td>{handoff.patient.full_name}</td><td>{handoff.doctor.full_name}</td><td>{displayBillingText(handoff.visit.appointment.reason, "Completed visit")}</td><td>{displayBillingText(description)}{handoff.note ? <small className="billing-handoff-note">{handoff.note}</small> : null}</td><td className="amount-cell" dir="ltr">{handoff.suggested_amount && handoff.currency ? formatMoney(handoff.suggested_amount, handoff.currency) : "—"}</td><td dir="ltr">{displayBillingDate(handoff.created_at)}</td><td><StatusPill status={handoff.status} /></td></tr>;
  })}</tbody></table></div></Card>;
}

export function InvoiceList({ role, invoices }: { role: UserRole; invoices: Invoice[] }) {
  const navigate = useNavigate();
  if (!invoices.length) return <EmptyState title="No invoices found." />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Related visit</th><th>Created</th><th className="amount-cell">Total</th><th className="amount-cell">Paid</th><th className="amount-cell">Balance</th><th>Status</th></tr></thead><tbody>{invoices.map((invoice) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/invoices/${invoice.id}`);
    return <tr key={invoice.id} className="clickable-row" tabIndex={0} aria-label={`Open invoice ${invoice.invoice_number} for ${invoice.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td dir="ltr">{invoice.invoice_number}</td><td>{invoice.patient.full_name}</td><td>{invoice.visit ? displayBillingText(invoice.visit.appointment.reason, "Completed visit") : "—"}</td><td dir="ltr">{displayBillingDate(invoice.created_at)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.total_amount, invoice.currency)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</td><td className="amount-cell" dir="ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td><StatusPill status={invoice.status} /></td></tr>;
  })}</tbody></table></div></Card>;
}
