import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";
import type { Currency } from "./clinic";
import type { AppointmentStatus } from "./appointments";
import type { PatientList } from "./patients";
import type { VisitStatus } from "./visits";

export type BillingHandoffStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type BillingHandoffOrigin = "VISIT_COMPLETION" | "MANUAL" | "LEGACY_MIGRATED";

export interface BillingVisitSummary {
  id: number;
  status: VisitStatus;
  started_at: string;
  completed_at: string | null;
  appointment: {
    id: number;
    start_datetime: string;
    end_datetime: string;
    duration_minutes: number;
    status: AppointmentStatus;
    reason: string;
  };
}

export interface Invoice extends Timestamped {
  id: number;
  invoice_number: string;
  billing_handoff_id: number;
  patient: PatientList;
  description: string;
  amount: string;
  currency: Currency;
  issued_at: string;
  notes: string;
  created_by: UserSummary | null;
}

export interface BillingHandoff extends Timestamped {
  id: number;
  patient: PatientList;
  visit: BillingVisitSummary | null;
  doctor: UserSummary | null;
  description: string;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  invoice_count: number;
  currency: Currency;
  note: string;
  status: BillingHandoffStatus;
  origin: BillingHandoffOrigin;
  legacy_reference: string;
  cancelled_at: string | null;
  cancelled_reason: string;
  invoices: Invoice[];
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface BillingHandoffPayload {
  patient_id: number;
  description: string;
  total_amount: string;
  currency: Currency;
  note?: string;
}

export interface BillingHandoffUpdatePayload {
  description?: string;
  total_amount?: string;
  currency?: Currency;
  note?: string;
}

export interface InvoiceIssuePayload {
  amount: string;
  issued_at?: string;
  notes?: string;
}

export interface HandoffInvoiceResponse {
  invoice: Invoice;
  handoff: BillingHandoff;
}

export interface HandoffCurrencyTotals {
  bill_total: string;
  paid: string;
  outstanding: string;
}

export interface HandoffFinancialSummary {
  clinic_date: string;
  clinic_timezone: string;
  status_counts: Record<BillingHandoffStatus, number>;
  open_count: number;
  partially_paid_count: number;
  paid_count: number;
  cancelled_count: number;
  currency_totals: Record<Currency, HandoffCurrencyTotals>;
}

export interface InvoiceFinancialSummary {
  clinic_date: string;
  clinic_timezone: string;
  invoice_count: number;
  collected_by_currency: Record<Currency, string>;
}
