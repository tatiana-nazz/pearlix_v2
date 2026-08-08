import type { AppointmentStatus } from "./appointments";
import type { Currency } from "./clinic";
import type { UserRole } from "./auth";
import type { VisitStatus } from "./visits";

export interface DashboardPatientSummary {
  id: number;
  full_name: string;
  phone_number: string;
}

export interface DashboardUserSummary {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
}

export interface DashboardAppointmentSummary {
  id: number;
  patient: DashboardPatientSummary;
  doctor: DashboardUserSummary;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  status: AppointmentStatus;
  reason: string;
}

export interface DashboardVisitSummary {
  id: number;
  patient: DashboardPatientSummary;
  appointment_id: number;
  appointment_reason: string;
  appointment_start_datetime: string;
  status: VisitStatus;
  started_at: string;
  completed_at: string | null;
}

export interface DashboardInvoiceSummary {
  id: number;
  invoice_number: string;
  patient: DashboardPatientSummary;
  currency: Currency;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  created_at: string;
}

export type DashboardAppointmentStatusCounts = Record<AppointmentStatus, number>;

export interface DashboardBillingActivityDay {
  date: string;
  SYP: { invoiced: string; collected: string };
  USD: { invoiced: string; collected: string };
}

export interface AdminDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  checked_in_appointments_count: number;
  needs_reschedule_appointments_count: number;
  active_visits_count: number;
  pending_billing_handoffs_count: number;
  today_appointments: DashboardAppointmentSummary[];
  appointment_status_last_7_days: DashboardAppointmentStatusCounts;
  billing_activity_last_30_days: DashboardBillingActivityDay[];
  recent_invoices: DashboardInvoiceSummary[];
}

export interface StaffDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  patients_ready_count: number;
  needs_reschedule_count: number;
  pending_billing_count: number;
  today_appointments: DashboardAppointmentSummary[];
  open_invoices: DashboardInvoiceSummary[];
}

export interface DoctorDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  patients_ready_count: number;
  completed_today_count: number;
  needs_reschedule_count: number;
  today_appointments: DashboardAppointmentSummary[];
  own_active_visit: DashboardVisitSummary | null;
}
