import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";

export type AvailabilityExceptionType = "UNAVAILABLE" | "AVAILABLE_OVERRIDE";

export interface DoctorProfileSummary {
  id: number;
  specialty: string;
  phone: string;
  bio: string;
  is_active: boolean;
}

export interface DoctorListItem {
  id: number;
  full_name: string;
  email: string;
  role: "DOCTOR";
  is_active: boolean;
  doctor_profile: DoctorProfileSummary | null;
}

export interface WorkingHour extends Timestamped {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface WorkingHoursResponse {
  working_hours: WorkingHour[];
}

export interface WorkingHoursPayload {
  working_hours: Array<Pick<WorkingHour, "weekday" | "start_time" | "end_time" | "is_active">>;
}

export interface AvailabilityException extends Timestamped {
  id: number;
  doctor: UserSummary | null;
  staff: UserSummary | null;
  start_datetime: string;
  end_datetime: string;
  type: AvailabilityExceptionType;
  reason: string;
  is_cancelled: boolean;
  cancelled_at: string | null;
  cancelled_by: UserSummary | null;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface AvailabilityExceptionPayload {
  doctor_id?: number | null;
  staff_id?: number | null;
  start_datetime: string;
  end_datetime: string;
  type: AvailabilityExceptionType;
  reason?: string;
}

export interface AvailabilityCancelResponse extends AvailabilityException {
  restored_appointments_count: number;
  still_blocked_appointments_count: number;
}
