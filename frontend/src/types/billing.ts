import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";
import type { Currency } from "./clinic";
import type { AppointmentStatus } from "./appointments";
import type { PatientList } from "./patients";
import type { VisitStatus } from "./visits";

export type BillingHandoffStatus = "PENDING" | "CONVERTED_TO_INVOICE" | "DISMISSED";
export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

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

export interface InvoiceSummary {
  id: number;
  invoice_number: string;
  currency: Currency;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: InvoiceStatus;
}

export interface BillingHandoff extends Timestamped {
  id: number;
  patient: PatientList;
  visit: BillingVisitSummary;
  doctor: UserSummary;
  note: string;
  suggested_amount: string | null;
  currency: Currency | null;
  status: BillingHandoffStatus;
  converted_invoice: InvoiceSummary | null;
  dismissed_reason: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface BillingHandoffCreatePayload {
  note?: string;
  suggested_amount?: string | null;
  currency?: Currency | null;
}

export interface HandoffConversionPayload {
  total_amount?: string;
  currency?: Currency;
  notes?: string;
}

export interface Invoice extends Timestamped {
  id: number;
  invoice_number: string;
  patient: PatientList;
  appointment: {
    id: number;
    start_datetime: string;
    end_datetime: string;
    duration_minutes: number;
    status: AppointmentStatus;
    reason: string;
  } | null;
  visit: BillingVisitSummary | null;
  billing_handoff: number | null;
  created_by: UserSummary | null;
  currency: Currency;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  payment_count: number;
  notes: string;
  status: InvoiceStatus;
  cancelled_at: string | null;
  cancelled_reason: string;
  payments: Payment[];
}

export interface InvoicePayload {
  patient_id?: number;
  visit_id?: number | null;
  appointment_id?: number | null;
  total_amount?: string;
  currency?: Currency;
  notes?: string;
}

export interface Payment extends Timestamped {
  id: number;
  invoice: number;
  amount: string;
  currency: Currency;
  payment_date: string;
  notes: string;
  created_by: UserSummary | null;
}

export interface PaymentPayload {
  amount: string;
  currency: Currency;
  payment_date?: string;
  notes?: string;
}

export interface PaymentResponse {
  payment: Payment;
  invoice: InvoiceSummary;
}

export interface InvoicePrintData {
  clinic: { clinic_name: string; address: string; phone_number: string; email: string };
  invoice: { invoice_number: string; status: InvoiceStatus; created_at: string; cancelled_at: string | null; cancelled_reason: string };
  patient: { id: number; full_name: string; phone_number: string };
  visit: BillingVisitSummary | null;
  appointment: Invoice["appointment"];
  currency: Currency;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  notes: string;
  payments: Payment[];
}
