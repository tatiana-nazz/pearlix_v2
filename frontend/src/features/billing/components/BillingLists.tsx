import { useNavigate } from "react-router-dom";
import type { KeyboardEvent } from "react";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import type { UserRole } from "../../../types/auth";
import { formatMoney } from "../utils/billing";

function rowKeyboardOpen(event: KeyboardEvent<HTMLTableRowElement>, onOpen: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); }
}

export function HandoffList({ role, handoffs }: { role: UserRole; handoffs: BillingHandoff[] }) {
  const navigate = useNavigate();
  if (!handoffs.length) return <EmptyState title="No billing handoffs found." />;
  return <Card><div className="table-scroll"><table className="billing-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Visit</th><th>Suggested amount</th><th>Status</th></tr></thead><tbody>{handoffs.map((handoff) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`);
    return <tr key={handoff.id} className="clickable-row" tabIndex={0} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td>{handoff.patient.full_name}</td><td>{handoff.doctor.full_name}</td><td>Visit #{handoff.visit.id}</td><td>{handoff.suggested_amount && handoff.currency ? formatMoney(handoff.suggested_amount, handoff.currency) : "Not set"}</td><td><StatusPill status={handoff.status} /></td></tr>;
  })}</tbody></table></div></Card>;
}

export function InvoiceList({ role, invoices }: { role: UserRole; invoices: Invoice[] }) {
  const navigate = useNavigate();
  if (!invoices.length) return <EmptyState title="No invoices found." />;
  return <Card><div className="table-scroll"><table className="billing-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Total</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{invoices.map((invoice) => {
    const open = () => navigate(`/${role.toLowerCase()}/billing/invoices/${invoice.id}`);
    return <tr key={invoice.id} className="clickable-row" tabIndex={0} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}><td>{invoice.invoice_number}</td><td>{invoice.patient.full_name}</td><td>{formatMoney(invoice.total_amount, invoice.currency)}</td><td>{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td><StatusPill status={invoice.status} /></td></tr>;
  })}</tbody></table></div></Card>;
}
