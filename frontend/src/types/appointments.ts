import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";
import type { PatientList } from "./patients";

export type AppointmentStatus =
  | "UPCOMING"
  | "CHECKED_IN"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "NEEDS_RESCHEDULE";

export interface AppointmentList extends Timestamped {
  id: number;
  patient: PatientList;
  doctor: UserSummary;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  reason: string;
  status: AppointmentStatus;
  version: number;
  reschedule_source_exception: number | null;
  reschedule_source_working_shift: number | null;
  reschedule_source_clinic_weekday?: number | null;
  reschedule_source_kind?: "LEAVE" | "WORKING_SCHEDULE_CHANGE" | "CLINIC_WEEKLY_CLOSURE" | "SCHEDULING_RULE_CONFLICT" | null;
  reschedule_source_type: "LEAVE" | "SHIFT_CHANGE" | "CLINIC_WEEKLY_CLOSURE" | "SCHEDULING_RULE_CONFLICT" | null;
  reschedule_source_label: string | null;
  reschedule_previous_status: AppointmentStatus | null;
}

export interface AppointmentDetail extends AppointmentList {
  notes: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface CreateAppointmentPayload {
  patient_id: number;
  doctor_id: number;
  start_datetime: string;
  duration_minutes?: number;
  reason?: string;
  notes?: string;
}

export type UpdateAppointmentPayload = Partial<CreateAppointmentPayload> & { version: number };
export type AppointmentPayload = UpdateAppointmentPayload;
export type AppointmentListItem = AppointmentList;
export type AppointmentViewMode = "day" | "week" | "month" | "list" | "needs-reschedule";

export interface AppointmentListFilters {
  page?: number;
  doctor_id?: number;
  patient_id?: number;
  status?: AppointmentStatus;
  date?: string;
  start_from?: string;
  start_to?: string;
  search?: string;
}

export interface AppointmentPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AppointmentList[];
  clinic_date: string;
  clinic_timezone: string;
}

export interface AppointmentAvailabilityFilters {
  doctor_id: number;
  date: string;
  duration_minutes?: number;
}

export interface AvailabilitySlot {
  start_datetime: string;
  end_datetime: string;
  current_count: number;
  capacity: number;
}

export interface AppointmentAvailability {
  doctor_id: number;
  date: string;
  duration_minutes: number;
  capacity_per_slot: number;
  clinic_closed: boolean;
  available_slots: AvailabilitySlot[];
}
