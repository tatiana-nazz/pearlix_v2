import { ApiClientError } from "../../../api/errors";
import type { CreatePatientPayload, PatientBloodGroup, PatientDetail, PatientGender, UpdatePatientPayload } from "../../../types/patients";

export interface PatientFormValues {
  first_name: string;
  last_name: string;
  gender: PatientGender;
  date_of_birth: string;
  phone_number: string;
  email: string;
  national_id_or_passport: string;
  address: string;
  emergency_contact: string;
  blood_group: PatientBloodGroup;
  medical_conditions_history: string;
  insurance_info: string;
  general_notes: string;
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues | "form" | "conflict", string>>;

export const emptyPatientFormValues: PatientFormValues = {
  first_name: "",
  last_name: "",
  gender: "Female",
  date_of_birth: "",
  phone_number: "",
  email: "",
  national_id_or_passport: "",
  address: "",
  emergency_contact: "",
  blood_group: "",
  medical_conditions_history: "",
  insurance_info: "",
  general_notes: "",
};

export function formValuesFromPatient(patient?: PatientDetail | null): PatientFormValues {
  if (!patient) return emptyPatientFormValues;
  return {
    first_name: patient.first_name,
    last_name: patient.last_name,
    gender: patient.gender,
    date_of_birth: patient.date_of_birth ?? "",
    phone_number: patient.phone_number,
    email: patient.email,
    national_id_or_passport: patient.national_id_or_passport ?? "",
    address: patient.address,
    emergency_contact: patient.emergency_contact,
    blood_group: patient.blood_group,
    medical_conditions_history: patient.medical_conditions_history,
    insurance_info: patient.insurance_info,
    general_notes: patient.general_notes,
  };
}

export function createPayloadFromForm(values: PatientFormValues): CreatePatientPayload {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    gender: values.gender,
    date_of_birth: values.date_of_birth || null,
    phone_number: values.phone_number.trim(),
    email: values.email.trim(),
    national_id_or_passport: values.national_id_or_passport.trim() || null,
    address: values.address.trim(),
    emergency_contact: values.emergency_contact.trim(),
    blood_group: values.blood_group,
    medical_conditions_history: values.medical_conditions_history.trim(),
    insurance_info: values.insurance_info.trim(),
    general_notes: values.general_notes.trim(),
  };
}

export function updatePayloadFromForm(values: PatientFormValues, version: number): UpdatePatientPayload {
  return { ...createPayloadFromForm(values), version };
}

export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
  const errors: PatientFormErrors = {};
  if (!values.first_name.trim()) errors.first_name = "firstNameRequired";
  if (!values.last_name.trim()) errors.last_name = "lastNameRequired";
  if (!values.gender) errors.gender = "genderRequired";
  if (values.date_of_birth && values.date_of_birth > new Date().toISOString().slice(0, 10)) {
    errors.date_of_birth = "dobFuture";
  }
  return errors;
}

export function apiErrorToFormErrors(error: unknown): PatientFormErrors {
  if (!(error instanceof ApiClientError)) return { form: "requestFailed" };
  if (error.code === "VERSION_CONFLICT") {
    return { conflict: "patientChangedElsewhere" };
  }
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
