import { Link } from "react-router-dom";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import type { UserRole } from "../../../types/auth";
import { formatMoney } from "../utils/billing";

export function HandoffList({ role, handoffs }: { role: UserRole; handoffs: BillingHandoff[] }) {
  if (!handoffs.length) return <EmptyState title="No billing handoffs found." />;
  return <Card><div className="table-scroll"><table className="billing-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Visit</th><th>Suggested amount</th><th>Status</th><th /></tr></thead><tbody>{handoffs.map((handoff) => <tr key={handoff.id}><td>{handoff.patient.full_name}</td><td>{handoff.doctor.full_name}</td><td>Visit #{handoff.visit.id}</td><td>{handoff.suggested_amount && handoff.currency ? formatMoney(handoff.suggested_amount, handoff.currency) : "Not set"}</td><td><StatusPill status={handoff.status} /></td><td><Link className="button secondary compact-button" to={`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`}>Open</Link></td></tr>)}</tbody></table></div></Card>;
}

export function InvoiceList({ role, invoices }: { role: UserRole; invoices: Invoice[] }) {
  if (!invoices.length) return <EmptyState title="No invoices found." />;
  return <Card><div className="table-scroll"><table className="billing-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Total</th><th>Remaining</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{invoice.patient.full_name}</td><td>{formatMoney(invoice.total_amount, invoice.currency)}</td><td>{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td><StatusPill status={invoice.status} /></td><td><Link className="button secondary compact-button" to={`/${role.toLowerCase()}/billing/invoices/${invoice.id}`}>Open</Link></td></tr>)}</tbody></table></div></Card>;
}
