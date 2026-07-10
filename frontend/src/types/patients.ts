import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";

export type PatientGender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

export interface PatientList extends Timestamped {
  id: number;
  full_name: string;
  phone: string;
  gender: PatientGender;
  birth_date: string | null;
  age: number | null;
  is_archived: boolean;
  last_visit_with_me_at?: string | null;
}

export interface PatientDetail extends PatientList {
  address: string;
  medical_summary: string;
  general_notes: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface PatientPayload {
  full_name: string;
  phone: string;
  gender?: PatientGender;
  birth_date?: string | null;
  address?: string;
  medical_summary?: string;
  general_notes?: string;
}

export type PatientUpdatePayload = Partial<PatientPayload> & {
  is_archived?: boolean;
};
