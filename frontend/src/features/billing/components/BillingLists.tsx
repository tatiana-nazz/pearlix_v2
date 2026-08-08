import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

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

export function HandoffList({ role, handoffs }: { role: UserRole; handoffs: BillingHandoff[] }) {
  const navigate = useNavigate();
  if (!handoffs.length) return <EmptyState title="No billing handoffs found." />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Completed visit</th><th>Description</th><th className="amount-cell">Suggested amount</th><th>Created</th><th>Status</th></tr></thead><tbody>{handoffs.map((handoff) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`);
    const description = (handoff as BillingHandoff & { description?: string }).description;
    return <tr key={handoff.id} className="clickable-row" tabIndex={0} aria-label={`Open billing handoff for ${handoff.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td>{handoff.patient.full_name}</td><td>{handoff.doctor.full_name}</td><td>{displayBillingText(handoff.visit.appointment.reason, "Completed visit")}</td><td>{displayBillingText(description)}{handoff.note ? <small className="billing-handoff-note">{handoff.note}</small> : null}</td><td className="amount-cell bidi-ltr">{handoff.suggested_amount && handoff.currency ? formatMoney(handoff.suggested_amount, handoff.currency) : "—"}</td><td className="bidi-ltr">{displayBillingDate(handoff.created_at)}</td><td><StatusPill status={handoff.status} /></td></tr>;
  })}</tbody></table></div></Card>;
}

export function InvoiceList({ role, invoices, variant = "history", emptyTitle }: { role: UserRole; invoices: Invoice[]; variant?: "history" | "overview"; emptyTitle?: string }) {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = billingCopy(language);
  if (!invoices.length) return <EmptyState title={emptyTitle ?? c.noInvoices} />;
  return <Card className="billing-collection-card"><div className="table-scroll"><table className="billing-table"><thead><tr><th>{variant === "overview" ? c.invoiceNumber : c.invoice}</th><th>{c.patient}</th><th>{variant === "overview" ? c.created : c.date}</th><th className="amount-cell">{c.total}</th>{variant === "history" ? <th className="amount-cell">{c.paidAmount}</th> : null}<th className="amount-cell">{c.balance}</th><th>{c.status}</th></tr></thead><tbody>{invoices.map((invoice) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/invoices/${invoice.id}`);
    return <tr key={invoice.id} className="clickable-row" tabIndex={0} aria-label={`${c.invoice} ${invoice.invoice_number}, ${invoice.patient.full_name}`} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td className="bidi-ltr">{invoice.invoice_number}</td><td>{invoice.patient.full_name}</td><td className="bidi-ltr">{displayBillingDate(invoice.created_at)}</td><td className="amount-cell bidi-ltr">{formatMoney(invoice.total_amount, invoice.currency)}</td>{variant === "history" ? <td className="amount-cell bidi-ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</td> : null}<td className="amount-cell bidi-ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td><StatusPill status={invoice.status} label={billingStatusLabel(language, invoice.status)} /></td></tr>;
  })}</tbody></table></div></Card>;
}
