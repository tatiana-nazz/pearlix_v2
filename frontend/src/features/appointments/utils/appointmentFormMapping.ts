import type { ApiClientError } from "../../../api/errors";
import type { AppointmentDetail, AppointmentListItem, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import { dateFromAppointment } from "./appointmentFilters";

export interface AppointmentFormValues {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  durationMinutes: string;
  reason: string;
  notes: string;
}

export type AppointmentFormErrors = Partial<Record<keyof AppointmentFormValues | "form", string>>;

export const defaultAppointmentFormValues: AppointmentFormValues = {
  patientId: "",
  doctorId: "",
  date: "",
  time: "09:00",
  durationMinutes: "30",
  reason: "",
  notes: "",
};

export function appointmentToFormValues(appointment?: AppointmentDetail | AppointmentListItem | null): AppointmentFormValues {
  if (!appointment) return defaultAppointmentFormValues;
  const startsAt = new Date(appointment.start_datetime);
  return {
    patientId: String(appointment.patient.id),
    doctorId: String(appointment.doctor.id),
    date: dateFromAppointment(appointment.start_datetime),
    time: `${String(startsAt.getHours()).padStart(2, "0")}:${String(startsAt.getMinutes()).padStart(2, "0")}`,
    durationMinutes: String(appointment.duration_minutes),
    reason: appointment.reason ?? "",
    notes: "notes" in appointment ? appointment.notes : "",
  };
}

export function validateAppointmentForm(values: AppointmentFormValues): AppointmentFormErrors {
  const errors: AppointmentFormErrors = {};
  if (!Number(values.patientId)) errors.patientId = "Patient is required.";
  if (!Number(values.doctorId)) errors.doctorId = "Doctor is required.";
  if (!values.date) errors.date = "Date is required.";
  if (!values.time) errors.time = "Time is required.";
  const duration = Number(values.durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) errors.durationMinutes = "Duration must be greater than zero.";
  return errors;
}

export function formValuesToCreatePayload(values: AppointmentFormValues): CreateAppointmentPayload {
  return {
    patient_id: Number(values.patientId),
    doctor_id: Number(values.doctorId),
    start_datetime: `${values.date}T${values.time}:00`,
    duration_minutes: Number(values.durationMinutes),
    reason: values.reason.trim(),
    notes: values.notes.trim(),
  };
}

export function formValuesToUpdatePayload(values: AppointmentFormValues): UpdateAppointmentPayload {
  return formValuesToCreatePayload(values);
}

export function apiFieldErrors(error: unknown): AppointmentFormErrors {
  const details = (error as ApiClientError | undefined)?.details;
  if (!details) return {};
  const mapping: Record<string, keyof AppointmentFormValues> = {
    patient_id: "patientId",
    doctor_id: "doctorId",
    start_datetime: "date",
    duration_minutes: "durationMinutes",
    reason: "reason",
    notes: "notes",
  };
  return Object.entries(details).reduce<AppointmentFormErrors>((acc, [field, messages]) => {
    const target = mapping[field];
    if (!target) return acc;
    acc[target] = Array.isArray(messages) ? String(messages[0]) : String(messages);
    return acc;
  }, {});
}
