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
  reschedule_source_exception: number | null;
  reschedule_previous_status: AppointmentStatus | null;
}

export interface AppointmentDetail extends AppointmentList {
  notes: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface AppointmentPayload {
  patient_id?: number;
  doctor_id?: number;
  start_datetime?: string;
  duration_minutes?: number;
  reason?: string;
  notes?: string;
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
  available_slots: AvailabilitySlot[];
}
