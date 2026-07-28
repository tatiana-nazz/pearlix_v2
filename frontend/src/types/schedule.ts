import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";

export type AvailabilityExceptionType = "UNAVAILABLE" | "AVAILABLE_OVERRIDE";
export type ScheduleApplyMode = "MISSING_ONLY" | "REPLACE_ALL";

export interface DoctorProfileSummary { id: number; specialty: string; phone: string; bio: string; is_active: boolean; }
export interface DoctorListItem { id: number; full_name: string; email: string; role: "DOCTOR"; is_active: boolean; doctor_profile: DoctorProfileSummary | null; }
export interface ClinicDefaultShift extends Timestamped { id: number; name: string; weekday: number; weekday_label: string; start_time: string; end_time: string; is_active: boolean; version: number; created_by: UserSummary | null; updated_by: UserSummary | null; }
export interface WorkingShift extends Timestamped { id: number; employee: UserSummary; name: string; weekday: number; weekday_label: string; start_time: string; end_time: string; is_active: boolean; source_default_shift: number | null; version: number; created_by: UserSummary | null; updated_by: UserSummary | null; }
export interface WorkingShiftPayload { employee_id: number; name: string; weekday: number; start_time: string; end_time: string; version?: number; }
export interface WorkingHoursResponse { working_hours: WorkingShift[]; }
export interface WorkingHoursPayload { working_hours: Array<Pick<WorkingShift, "name" | "weekday" | "start_time" | "end_time" | "is_active">>; confirm_appointment_impact?: boolean; }
export interface AvailabilityException extends Timestamped { id: number; doctor: UserSummary | null; staff: UserSummary | null; start_datetime: string; end_datetime: string; type: AvailabilityExceptionType; reason: string; is_cancelled: boolean; cancelled_at: string | null; cancelled_by: UserSummary | null; version: number; created_by: UserSummary | null; updated_by: UserSummary | null; }
export interface AvailabilityExceptionMutationResult extends AvailabilityException { marked_needs_reschedule_count?: number; }
export interface AvailabilityExceptionPayload { doctor_id?: number | null; staff_id?: number | null; start_datetime: string; end_datetime: string; type: AvailabilityExceptionType; reason?: string; version?: number; }
export interface AvailabilityCancelResponse extends AvailabilityException { restored_appointments_count: number; still_blocked_appointments_count: number; }
export interface ScheduleMutationResult { employee: UserSummary; mode: ScheduleApplyMode; created_count: number; deactivated_count: number; skipped_count: number; impacted_appointments_count: number; working_shifts: WorkingShift[]; }
export interface ShiftImpact { impacted_count: number; appointments: Array<{ id: number; patient_name: string; start_datetime: string; end_datetime: string; status: string }>; employee: UserSummary; proposed_schedule: unknown; }
