import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";

export type PatientGender = "Male" | "Female";
export type PatientBloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "";

export interface PatientListItem extends Timestamped {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: PatientGender;
  date_of_birth: string | null;
  age: number | null;
  phone_number: string;
  email: string;
  national_id_or_passport: string | null;
  blood_group: PatientBloodGroup;
  is_archived: boolean;
  version: number;
  last_visit_with_me_at?: string | null;
  last_visit_at?: string | null;
  next_appointment_at?: string | null;
}

export type PatientList = PatientListItem;

export interface PatientDetail extends PatientListItem {
  address: string;
  emergency_contact: string;
  medical_conditions_history: string;
  insurance_info: string;
  general_notes: string;
  created_by: UserSummary | null;
  updated_by: UserSummary | null;
}

export interface CreatePatientPayload {
  first_name: string;
  last_name: string;
  gender: PatientGender;
  date_of_birth?: string | null;
  phone_number?: string;
  email?: string;
  national_id_or_passport?: string | null;
  address?: string;
  emergency_contact?: string;
  blood_group?: PatientBloodGroup;
  medical_conditions_history?: string;
  insurance_info?: string;
  general_notes?: string;
}

export type PatientPayload = CreatePatientPayload;

export type UpdatePatientPayload = Partial<CreatePatientPayload> & { version: number };

export type PatientUpdatePayload = UpdatePatientPayload;

export interface PatientVersionPayload {
  version: number;
}

export interface PatientListFilters {
  page?: number;
  search?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  national_id_or_passport?: string;
  is_archived?: boolean;
  my_patients?: boolean;
  upcoming_with_me?: boolean;
  last_visit_with_me?: boolean;
}
