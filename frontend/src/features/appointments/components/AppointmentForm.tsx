import { useEffect, useMemo, useState } from "react";

import type { AppointmentDetail, AppointmentListItem, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import type { PatientListItem } from "../../../types/patients";
import { PatientPicker } from "./PatientPicker";
import {
  apiFieldErrors,
  appointmentToFormValues,
  defaultAppointmentFormValues,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
  validateAppointmentForm,
  type AppointmentFormErrors,
  type AppointmentFormValues,
} from "../utils/appointmentFormMapping";

interface AppointmentFormBaseProps {
  doctors: DoctorListItem[];
  initialDate?: string;
  initialDoctorId?: number;
  isSubmitting?: boolean;
  error?: unknown;
  clinicTimezone?: string;
  onCancel?: () => void;
  onSubmit: (payload: CreateAppointmentPayload | UpdateAppointmentPayload) => void | Promise<void>;
}

type AppointmentFormProps = AppointmentFormBaseProps &
  (
    | { mode: "create"; appointment?: null }
    | {
        mode: "edit" | "reschedule";
        appointment: AppointmentDetail | AppointmentListItem;
      }
  );

function initialValues(props: AppointmentFormProps): AppointmentFormValues {
  const fromAppointment = appointmentToFormValues(props.appointment, props.clinicTimezone);
  if (props.appointment) return fromAppointment;
  return {
    ...defaultAppointmentFormValues,
    date: props.initialDate ?? "",
    doctorId: props.initialDoctorId ? String(props.initialDoctorId) : "",
  };
}

export function AppointmentForm(props: AppointmentFormProps) {
  const [values, setValues] = useState<AppointmentFormValues>(() => initialValues(props));
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(() => props.appointment?.patient ?? null);
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const backendErrors = useMemo(() => apiFieldErrors(props.error), [props.error]);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);

  useEffect(() => {
    setValues(initialValues(props));
    setSelectedPatient(props.appointment?.patient ?? null);
  }, [props.appointment, props.initialDate, props.initialDoctorId, props.clinicTimezone]);

  function setField(field: keyof AppointmentFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAppointmentForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const payload =
      props.mode === "create"
        ? formValuesToCreatePayload(values)
        : formValuesToUpdatePayload(values, props.appointment.version);
    await props.onSubmit(payload);
  }

  function fieldError(field: keyof AppointmentFormValues) {
    return errors[field] ?? backendErrors[field];
  }

  function patientError() {
    const message = fieldError("patientId");
    if (!message) return undefined;
    if (!values.patientId) return c.patientRequired;
    return backendErrors.patientId ? c.patientUnavailable : message;
  }

  return (
    <form className="appointment-form" onSubmit={(event) => void submit(event)}>
      {props.error ? <p className="form-error">{c.saveError}</p> : null}
      <div className="appointment-form-grid">
        <PatientPicker
          selectedPatient={selectedPatient}
          error={patientError()}
          disabled={props.mode !== "create"}
          onSelect={(patient) => {
            setSelectedPatient(patient);
            setField("patientId", String(patient.id));
          }}
          onClear={() => {
            setSelectedPatient(null);
            setField("patientId", "");
          }}
        />
        <label>
          {c.doctor}
          <select value={values.doctorId} onChange={(event) => setField("doctorId", event.target.value)} aria-invalid={Boolean(fieldError("doctorId"))}>
            <option value="">{c.selectDoctor}</option>
            {props.doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.full_name}
              </option>
            ))}
          </select>
          {fieldError("doctorId") ? <span className="field-error">{fieldError("doctorId")}</span> : null}
        </label>
        <label>
          {c.date}
          <input type="date" value={values.date} onChange={(event) => setField("date", event.target.value)} aria-invalid={Boolean(fieldError("date"))} />
          {fieldError("date") ? <span className="field-error">{fieldError("date")}</span> : null}
        </label>
        <label>
          {c.time}
          <input type="time" value={values.time} onChange={(event) => setField("time", event.target.value)} aria-invalid={Boolean(fieldError("time"))} />
          {fieldError("time") ? <span className="field-error">{fieldError("time")}</span> : null}
        </label>
        <label>
          {c.duration}
          <input
            value={values.durationMinutes}
            onChange={(event) => setField("durationMinutes", event.target.value)}
            inputMode="numeric"
            aria-invalid={Boolean(fieldError("durationMinutes"))}
          />
          {fieldError("durationMinutes") ? <span className="field-error">{fieldError("durationMinutes")}</span> : null}
        </label>
        <label>
          {c.reason}
          <input value={values.reason} onChange={(event) => setField("reason", event.target.value)} />
        </label>
      </div>
      <label>
        {c.notes}
        <textarea value={values.notes} rows={4} onChange={(event) => setField("notes", event.target.value)} />
      </label>
      <p className="form-note">{c.statusManaged}</p>
      <div className="form-actions">
        {props.onCancel ? (
          <button className="button secondary" type="button" onClick={props.onCancel}>
            {c.cancel}
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={props.isSubmitting}>
          {props.mode === "reschedule" ? c.saveReschedule : c.save}
        </button>
      </div>
    </form>
  );
}
