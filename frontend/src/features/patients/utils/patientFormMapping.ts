import { ApiClientError } from "../../../api/errors";
import type { CreatePatientPayload, PatientDetail, PatientGender, UpdatePatientPayload } from "../../../types/patients";

export interface PatientFormValues {
  full_name: string;
  phone: string;
  gender: PatientGender;
  birth_date: string;
  address: string;
  medical_summary: string;
  general_notes: string;
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues | "form", string>>;

export const emptyPatientFormValues: PatientFormValues = {
  full_name: "",
  phone: "",
  gender: "UNSPECIFIED",
  birth_date: "",
  address: "",
  medical_summary: "",
  general_notes: "",
};

export function formValuesFromPatient(patient?: PatientDetail | null): PatientFormValues {
  if (!patient) return emptyPatientFormValues;
  return {
    full_name: patient.full_name,
    phone: patient.phone,
    gender: patient.gender,
    birth_date: patient.birth_date ?? "",
    address: patient.address,
    medical_summary: patient.medical_summary,
    general_notes: patient.general_notes,
  };
}

export function createPayloadFromForm(values: PatientFormValues): CreatePatientPayload {
  return {
    full_name: values.full_name.trim(),
    phone: values.phone.trim(),
    gender: values.gender,
    birth_date: values.birth_date || null,
    address: values.address.trim(),
    medical_summary: values.medical_summary.trim(),
    general_notes: values.general_notes.trim(),
  };
}

export function updatePayloadFromForm(values: PatientFormValues): UpdatePatientPayload {
  return createPayloadFromForm(values);
}

export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
  const errors: PatientFormErrors = {};
  if (!values.full_name.trim()) errors.full_name = "Full name is required.";
  if (!values.phone.trim()) errors.phone = "Phone is required.";
  if (values.birth_date && values.birth_date > new Date().toISOString().slice(0, 10)) {
    errors.birth_date = "Birth date cannot be in the future.";
  }
  return errors;
}

export function apiErrorToFormErrors(error: unknown): PatientFormErrors {
  if (!(error instanceof ApiClientError)) return { form: "Request failed." };
  const errors: PatientFormErrors = {};
  for (const field of Object.keys(emptyPatientFormValues) as Array<keyof PatientFormValues>) {
    const detail = error.details[field];
    if (Array.isArray(detail)) errors[field] = detail.join(" ");
    else if (typeof detail === "string") errors[field] = detail;
  }
  const nonField = error.details.non_field_errors;
  if (Array.isArray(nonField)) errors.form = nonField.join(" ");
  if (!Object.keys(errors).length) errors.form = error.message;
  return errors;
}
