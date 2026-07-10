import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";

export type PatientGender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

export interface PatientListItem extends Timestamped {
  id: number;
  full_name: string;
  phone: string;
  gender: PatientGender;
  birth_date: string | null;
  age: number | null;
  is_archived: boolean;
  last_visit_with_me_at?: string | null;
}

export type PatientList = PatientListItem;

export interface PatientDetail extends PatientListItem {
  address: string;
  medical_summary: string;
  general_notes: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface CreatePatientPayload {
  full_name: string;
  phone: string;
  gender?: PatientGender;
  birth_date?: string | null;
  address?: string;
  medical_summary?: string;
  general_notes?: string;
}

export type PatientPayload = CreatePatientPayload;

export type UpdatePatientPayload = Partial<CreatePatientPayload> & {
  is_archived?: boolean;
};

export type PatientUpdatePayload = UpdatePatientPayload;

export interface PatientListFilters {
  page?: number;
  search?: string;
  name?: string;
  phone?: string;
  is_archived?: boolean;
  my_patients?: boolean;
  upcoming_with_me?: boolean;
  last_visit_with_me?: boolean;
}
