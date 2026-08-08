import type { BillingHandoff } from "../../../types/billing";
import type { UserRole } from "../../../types/auth";
import { formatDate, formatDateTime } from "../../../utils/dates";

export function formatMoney(amount: string, currency: string): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "code" }).format(numeric) : `${amount} ${currency}`;
}

export function canRecordPayment(role: UserRole, handoff: BillingHandoff): boolean {
  return role === "STAFF"
    && (handoff.status === "OPEN" || handoff.status === "PARTIALLY_PAID")
    && Number(handoff.remaining_amount) > 0;
}

export function displayBillingDate(value: string | null | undefined, fallback = "—"): string {
  return value ? formatDate(value) || fallback : fallback;
}

export function displayBillingDateTime(value: string | null | undefined, fallback = "—"): string {
  return value ? formatDateTime(value) || fallback : fallback;
}

export function displayBillingText(value: string | null | undefined, fallback = "—"): string {
  return value?.trim() ? value : fallback;
}
