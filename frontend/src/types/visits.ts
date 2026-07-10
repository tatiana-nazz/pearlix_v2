import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";
import type { PatientList } from "./patients";

export type VisitStatus = "ACTIVE" | "COMPLETED";

export interface VisitAppointmentSummary {
  id: number;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  status: string;
  reason: string;
}

export interface VisitDetail extends Timestamped {
  id: number;
  appointment: VisitAppointmentSummary;
  patient: PatientList;
  doctor: UserSummary;
  status: VisitStatus;
  started_at: string;
  completed_at: string | null;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  clinical_notes: string;
  follow_up_notes: string;
  created_by?: UserSummary | null;
  updated_by?: UserSummary | null;
}

export interface ClinicalNotesPayload {
  symptoms?: string;
  diagnosis?: string;
  treatment?: string;
  clinical_notes?: string;
  follow_up_notes?: string;
}
