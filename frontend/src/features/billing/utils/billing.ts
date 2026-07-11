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
