import { useEffect, useMemo, useState } from "react";

import type { AppointmentDetail, AppointmentListItem, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
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

interface AppointmentFormProps {
  mode: "create" | "edit" | "reschedule";
  doctors: DoctorListItem[];
  appointment?: AppointmentDetail | AppointmentListItem | null;
  initialDate?: string;
  initialDoctorId?: number;
  isSubmitting?: boolean;
  error?: unknown;
  onCancel?: () => void;
  onSubmit: (payload: CreateAppointmentPayload | UpdateAppointmentPayload) => void | Promise<void>;
}

function initialValues(props: AppointmentFormProps): AppointmentFormValues {
  const fromAppointment = appointmentToFormValues(props.appointment);
  if (props.appointment) return fromAppointment;
  return {
    ...defaultAppointmentFormValues,
    date: props.initialDate ?? "",
    doctorId: props.initialDoctorId ? String(props.initialDoctorId) : "",
  };
}

export function AppointmentForm(props: AppointmentFormProps) {
  const [values, setValues] = useState<AppointmentFormValues>(() => initialValues(props));
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const backendErrors = useMemo(() => apiFieldErrors(props.error), [props.error]);

  useEffect(() => {
    setValues(initialValues(props));
  }, [props.appointment, props.initialDate, props.initialDoctorId]);

  function setField(field: keyof AppointmentFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAppointmentForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const payload = props.mode === "create" ? formValuesToCreatePayload(values) : formValuesToUpdatePayload(values);
    await props.onSubmit(payload);
  }

  function fieldError(field: keyof AppointmentFormValues) {
    return errors[field] ?? backendErrors[field];
  }

  return (
    <form className="appointment-form" onSubmit={(event) => void submit(event)}>
      {props.error ? <p className="form-error">Unable to save appointment. Review the highlighted fields and try again.</p> : null}
      <div className="appointment-form-grid">
        <label>
          Patient ID
          <input
            value={values.patientId}
            onChange={(event) => setField("patientId", event.target.value)}
            inputMode="numeric"
            aria-invalid={Boolean(fieldError("patientId"))}
          />
          {fieldError("patientId") ? <span className="field-error">{fieldError("patientId")}</span> : null}
        </label>
        <label>
          Doctor
          <select value={values.doctorId} onChange={(event) => setField("doctorId", event.target.value)} aria-invalid={Boolean(fieldError("doctorId"))}>
            <option value="">Select doctor</option>
            {props.doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.full_name}
              </option>
            ))}
          </select>
          {fieldError("doctorId") ? <span className="field-error">{fieldError("doctorId")}</span> : null}
        </label>
        <label>
          Date
          <input type="date" value={values.date} onChange={(event) => setField("date", event.target.value)} aria-invalid={Boolean(fieldError("date"))} />
          {fieldError("date") ? <span className="field-error">{fieldError("date")}</span> : null}
        </label>
        <label>
          Time
          <input type="time" value={values.time} onChange={(event) => setField("time", event.target.value)} aria-invalid={Boolean(fieldError("time"))} />
          {fieldError("time") ? <span className="field-error">{fieldError("time")}</span> : null}
        </label>
        <label>
          Duration
          <input
            value={values.durationMinutes}
            onChange={(event) => setField("durationMinutes", event.target.value)}
            inputMode="numeric"
            aria-invalid={Boolean(fieldError("durationMinutes"))}
          />
          {fieldError("durationMinutes") ? <span className="field-error">{fieldError("durationMinutes")}</span> : null}
        </label>
        <label>
          Reason
          <input value={values.reason} onChange={(event) => setField("reason", event.target.value)} />
        </label>
      </div>
      <label>
        Notes
        <textarea value={values.notes} rows={4} onChange={(event) => setField("notes", event.target.value)} />
      </label>
      <p className="form-note">Status is managed through appointment action endpoints, not the appointment form.</p>
      <div className="form-actions">
        {props.onCancel ? (
          <button className="button secondary" type="button" onClick={props.onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={props.isSubmitting}>
          {props.mode === "reschedule" ? "Save reschedule" : "Save appointment"}
        </button>
      </div>
    </form>
  );
}
