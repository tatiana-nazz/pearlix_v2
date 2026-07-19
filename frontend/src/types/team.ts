import type { UserRole } from "./auth";

export type ProfessionalStatus = "ACTIVE" | "INACTIVE";
export type OperationalStatus = "ACTIVE" | "INACTIVE" | "SETUP_REQUIRED" | "INVARIANT_VIOLATION";
export type TeamAvailability = "AVAILABLE" | "ON_LEAVE" | "UNAVAILABLE";

export interface LinkedAccountSummary {
  id: number;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberSummary {
  id: number;
  role: Extract<UserRole, "DOCTOR" | "STAFF">;
  full_name: string;
  professional_status: ProfessionalStatus;
  operational_status: OperationalStatus;
  specialty: string | null;
  position: string | null;
  phone: string;
  /** Safe contact field available to both Admin and Staff directory views. */
  email: string;
  availability: { availability: TeamAvailability; on_leave: boolean; next_exception: { id: number; start_datetime: string; end_datetime: string; reason: string } | null };
  today_workload: { appointment_count: number; active_visit_count: number };
  schedule_summary: { has_active_schedule: boolean; active_shift_count: number };
}

export interface AdminTeamMemberSummary extends TeamMemberSummary {
  account: LinkedAccountSummary;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberDetail extends TeamMemberSummary {
  profile: { specialty: string; phone: string; bio: string; is_active: boolean } | { position: string; phone: string; is_active: boolean };
  active_shifts: Array<{ id: number; name: string; weekday: number; start_time: string; end_time: string; is_active: boolean; version: number }>;
  current_future_leave: Array<{ id: number; start_datetime: string; end_datetime: string; type: string; reason: string; is_cancelled: boolean; version: number }>;
  today_appointments: Array<{ id: number; patient_id: number; patient_name: string; start_datetime: string; end_datetime: string; status: string; reason: string }>;
}

export interface AdminTeamMemberDetail extends TeamMemberDetail, AdminTeamMemberSummary {}

export interface StaffTeamMemberDetail extends TeamMemberSummary {
  profile: { specialty: string; phone: string; bio: string } | { position: string; phone: string };
  active_shifts: Array<{ name: string; weekday: number; start_time: string; end_time: string }>;
  current_future_leave: Array<{ start_datetime: string; end_datetime: string; type: string; reason: string }>;
  today_appointments: Array<{ patient_name: string; start_datetime: string; end_datetime: string; status: string; reason: string }>;
}

export interface TeamMemberCreatePayload {
  account: { full_name: string; email: string; temporary_password: string };
  role: "DOCTOR" | "STAFF";
  doctor_profile?: { specialty?: string; phone?: string; bio?: string };
  staff_profile?: { position?: string; phone?: string };
}

export type TeamMemberUpdatePayload = { version: number; specialty?: string; phone?: string; bio?: string } | { version: number; position?: string; phone?: string };
export interface ProfessionalStatusPayload { is_active: boolean; version: number; reason?: string; }
export interface RoleTransitionPreview { current_role: UserRole; target_role: UserRole; linked_profile_state: string; operational_history: Record<string, number>; required_target_profile: "doctor_profile" | "staff_profile" | null; schedule_setup_required?: boolean; allowed: boolean; blockers: Array<{ code: string; counts: Record<string, number> }>; consequences: string[]; confirmation_token: string | null; }
export interface RoleTransitionConfirmPayload { target_role: UserRole; mode: "CONFIRM"; confirmation_token: string; profile: Record<string, string>; version: number; }
