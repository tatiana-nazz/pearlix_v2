import type { BillingHandoff, Invoice } from "../../../types/billing";
import type { UserRole } from "../../../types/auth";

export function formatMoney(amount: string, currency: string): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "code" }).format(numeric) : `${amount} ${currency}`;
}

export function canManageInvoice(role: UserRole, invoice: Invoice): boolean {
  return role === "STAFF" && invoice.status !== "PAID" && invoice.status !== "CANCELLED";
}

export function canManageHandoff(role: UserRole, handoff: BillingHandoff): boolean {
  return role === "STAFF" && handoff.status === "PENDING";
}

export function isPositiveMoney(value: string): boolean { return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0; }
export function handoffStatusLabel(status: BillingHandoff["status"]): string { return status === "PENDING" ? "Pending" : status === "CONVERTED_TO_INVOICE" ? "Converted to invoice" : "Dismissed"; }
export function invoiceStatusLabel(status: Invoice["status"]): string { return status === "UNPAID" ? "Unpaid" : status === "PARTIALLY_PAID" ? "Partially paid" : status === "PAID" ? "Paid" : "Cancelled"; }
