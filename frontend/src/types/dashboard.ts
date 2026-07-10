import type { AppointmentList } from "./appointments";
import type { BillingHandoff, InvoiceSummary } from "./billing";
import type { PatientList } from "./patients";
import type { AvailabilityException, WorkingHour } from "./schedule";
import type { VisitDetail } from "./visits";

export interface AdminDashboardResponse {
  total_active_patients: number;
  today_appointments_count: number;
  checked_in_appointments_count: number;
  needs_reschedule_appointments_count: number;
  active_visits_count: number;
  pending_billing_handoffs_count: number;
  unpaid_invoices_count: number;
  recent_appointments: AppointmentList[];
  recent_invoices: InvoiceSummary[];
}

export interface StaffDashboardResponse {
  today_appointments_count: number;
  upcoming_today_appointments: AppointmentList[];
  checked_in_appointments: AppointmentList[];
  needs_reschedule_appointments: AppointmentList[];
  pending_billing_handoffs: BillingHandoff[];
  unpaid_or_partially_paid_invoices: InvoiceSummary[];
  recent_patients: PatientList[];
  own_working_schedule: WorkingHour[];
  own_availability_exceptions: AvailabilityException[];
  doctor_unavailable_exceptions: AvailabilityException[];
}

export interface DoctorDashboardResponse {
  today_own_appointments: AppointmentList[];
  own_checked_in_appointments: AppointmentList[];
  own_needs_reschedule_appointments: AppointmentList[];
  own_active_visit: VisitDetail | null;
  own_completed_visits_today_count: number;
  own_recent_visits: VisitDetail[];
  own_pending_billing_handoffs: BillingHandoff[];
  own_working_schedule: WorkingHour[];
  own_availability_exceptions: AvailabilityException[];
}
