import type { AppointmentStatus } from "./appointments";
import type { Currency } from "./clinic";
import type { AvailabilityExceptionType } from "./schedule";
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

export interface DashboardWorkingHourSummary {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface DashboardAvailabilityExceptionSummary {
  id: number;
  doctor: DashboardUserSummary | null;
  staff: DashboardUserSummary | null;
  start_datetime: string;
  end_datetime: string;
  type: AvailabilityExceptionType;
  reason: string;
  is_cancelled: boolean;
  cancelled_at: string | null;
}

export interface DashboardVisitSummary {
  id: number;
  patient: DashboardPatientSummary;
  appointment_id: number;
  status: VisitStatus;
  started_at: string;
  completed_at: string | null;
}

export interface DashboardBillingHandoffSummary {
  id: number;
  patient: DashboardPatientSummary;
  visit_id: number;
  doctor: DashboardUserSummary;
  suggested_amount: string | number | null;
  currency: Currency | null;
  status: "PENDING" | "CONVERTED_TO_INVOICE" | "DISMISSED";
  created_at: string;
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

export interface AdminDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  total_active_patients: number;
  today_appointments_count: number;
  checked_in_appointments_count: number;
  needs_reschedule_appointments_count: number;
  active_visits_count: number;
  pending_billing_handoffs_count: number;
  unpaid_invoices_count: number;
  recent_appointments: DashboardAppointmentSummary[];
  recent_invoices: DashboardInvoiceSummary[];
}

export interface StaffDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  upcoming_today_appointments: DashboardAppointmentSummary[];
  checked_in_appointments: DashboardAppointmentSummary[];
  needs_reschedule_appointments: DashboardAppointmentSummary[];
  pending_billing_handoffs: DashboardBillingHandoffSummary[];
  unpaid_or_partially_paid_invoices: DashboardInvoiceSummary[];
  recent_patients: DashboardPatientSummary[];
  own_working_schedule: DashboardWorkingHourSummary[];
  own_availability_exceptions: DashboardAvailabilityExceptionSummary[];
  doctor_unavailable_exceptions: DashboardAvailabilityExceptionSummary[];
}

export interface DoctorDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_own_appointments: DashboardAppointmentSummary[];
  own_checked_in_appointments: DashboardAppointmentSummary[];
  own_needs_reschedule_appointments: DashboardAppointmentSummary[];
  own_active_visit: DashboardVisitSummary | null;
  own_completed_visits_today_count: number;
  own_recent_visits: DashboardVisitSummary[];
  own_pending_billing_handoffs: DashboardBillingHandoffSummary[];
  own_working_schedule: DashboardWorkingHourSummary[];
  own_availability_exceptions: DashboardAvailabilityExceptionSummary[];
}
