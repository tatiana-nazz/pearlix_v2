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

export interface DashboardHandoffSummary {
  id: number;
  patient: DashboardPatientSummary;
  description: string;
  currency: Currency;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  created_at: string;
}

export type DashboardAppointmentStatusCounts = Record<AppointmentStatus, number>;

export interface DashboardBillingActivityDay {
  date: string;
  SYP: { billed: string; collected: string };
  USD: { billed: string; collected: string };
}

export interface DashboardAppointmentActivityDay extends DashboardAppointmentStatusCounts {
  date: string;
}

export interface DashboardDoctorUtilization {
  doctor: { id: number; full_name: string };
  booked_minutes: number;
  available_minutes: number;
  utilization_percent: number;
}

export interface DashboardPatientMixWeek {
  week_start: string;
  new: number;
  returning: number;
}

export interface DashboardProblemRateWeek {
  week_start: string;
  scheduled: number;
  cancelled: number;
  no_show: number;
  rate_percent: number;
}

export interface DashboardReceivablesAgingBucket {
  bucket: "0_7" | "8_30" | "31_60" | "60_plus";
  SYP: string;
  USD: string;
}

export interface AdminDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  checked_in_appointments_count: number;
  needs_reschedule_appointments_count: number;
  active_visits_count: number;
  open_bills_count: number;
  partially_paid_bills_count: number;
  today_invoices_count: number;
  collected_today: Record<Currency, string>;
  today_appointments: DashboardAppointmentSummary[];
  appointment_status_last_7_days: DashboardAppointmentStatusCounts;
  billing_activity_last_30_days: DashboardBillingActivityDay[];
  appointments_daily_last_30_days: DashboardAppointmentActivityDay[];
  doctor_utilization_last_30_days: DashboardDoctorUtilization[];
  doctor_utilization_schedule_accuracy: "CURRENT_TEMPLATE_APPROXIMATION";
  patient_mix_last_8_weeks: DashboardPatientMixWeek[];
  appointment_problem_rate_last_8_weeks: DashboardProblemRateWeek[];
  receivables_aging: DashboardReceivablesAgingBucket[];
  recent_handoffs: DashboardHandoffSummary[];
}

export interface StaffDashboardResponse {
  clinic_date: string;
  clinic_timezone: string;
  today_appointments_count: number;
  patients_ready_count: number;
  needs_reschedule_count: number;
  open_bills_count: number;
  partially_paid_bills_count: number;
  today_invoices_count: number;
  collected_today: Record<Currency, string>;
  today_appointments: DashboardAppointmentSummary[];
  open_handoffs: DashboardHandoffSummary[];
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
