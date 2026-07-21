import { useNavigate } from "react-router-dom";

import { ClickableRow, DataTableShell, StatusBadge, statusLabel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { BillingHandoff, Invoice } from "../../../types/billing";
import { formatDateTime } from "../../../utils/dates";
import { formatMoney } from "../utils/billing";

function handoffStatus(status: BillingHandoff["status"], t: ReturnType<typeof useFeatureT>) {
  return t(status === "PENDING" ? "pending" : status === "CONVERTED_TO_INVOICE" ? "converted" : "dismissed");
}

function invoiceStatus(status: Invoice["status"], t: ReturnType<typeof useFeatureT>) {
  return t(status === "UNPAID" ? "unpaid" : status === "PARTIALLY_PAID" ? "partiallyPaid" : status === "PAID" ? "paidStatus" : "cancelled");
}

export function HandoffList({ role, handoffs }: { role: UserRole; handoffs: BillingHandoff[] }) {
  const navigate = useNavigate();
  const t = useFeatureT();
  return <DataTableShell title={role === "DOCTOR" ? t("myBillingHandoffs") : t("billingHandoffs")} state={!handoffs.length ? <p>{t("noBillingHandoffs")}</p> : undefined}>
    <table className="billing-table"><thead><tr><th>{t("patient")}</th><th>{t("visit")}</th><th>{t("doctor")}</th><th>{t("suggestedAmount")}</th><th>{t("status")}</th><th>{t("created")}</th></tr></thead><tbody>
      {handoffs.map((handoff) => <ClickableRow key={handoff.id} onOpen={() => navigate(`/${role.toLowerCase()}/billing/handoffs/${handoff.id}`)}>
        <td className="bidi-isolate">{handoff.patient.full_name}</td><td className="bidi-isolate">{formatDateTime(handoff.visit.started_at)} · {statusLabel(handoff.visit.status)}</td><td className="bidi-isolate">{handoff.doctor.full_name}</td><td className="bidi-isolate">{handoff.suggested_amount && handoff.currency ? formatMoney(handoff.suggested_amount, handoff.currency) : t("notSet")}</td><td>{handoffStatus(handoff.status, t)}</td><td className="bidi-isolate">{formatDateTime(handoff.created_at)}</td>
      </ClickableRow>)}
    </tbody></table>
  </DataTableShell>;
}

export function InvoiceList({ role, invoices }: { role: UserRole; invoices: Invoice[] }) {
  const navigate = useNavigate();
  const t = useFeatureT();
  return <DataTableShell title={t("invoices")} state={!invoices.length ? <p>{t("noInvoices")}</p> : undefined}>
    <table className="billing-table"><thead><tr><th>{t("invoice")}</th><th>{t("patient")}</th><th>{t("status")}</th><th>{t("total")}</th><th>{t("paid")}</th><th>{t("remaining")}</th><th>{t("issued")}</th></tr></thead><tbody>
      {invoices.map((invoice) => <ClickableRow key={invoice.id} onOpen={() => navigate(`/${role.toLowerCase()}/billing?tab=invoices&invoice=${invoice.id}`)}>
        <td className="bidi-isolate">{invoice.invoice_number}</td><td className="bidi-isolate">{invoice.patient.full_name}</td><td><StatusBadge status={invoice.status} /></td><td className="bidi-isolate">{formatMoney(invoice.total_amount, invoice.currency)}</td><td className="bidi-isolate">{formatMoney(invoice.paid_amount, invoice.currency)}</td><td className="bidi-isolate">{formatMoney(invoice.remaining_amount, invoice.currency)}</td><td className="bidi-isolate">{formatDateTime(invoice.created_at)}</td>
      </ClickableRow>)}
    </tbody></table>
  </DataTableShell>;
}
