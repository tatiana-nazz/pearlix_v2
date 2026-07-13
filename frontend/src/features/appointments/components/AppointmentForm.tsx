import { useEffect, useMemo, useRef, useState } from "react";

import type { AppointmentDetail, AppointmentListItem, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
import type { PatientListItem } from "../../../types/patients";
import { Combobox, useOverlayClose } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
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
  patients: PatientListItem[];
  appointment?: AppointmentDetail | AppointmentListItem | null;
  initialDate?: string;
  initialDoctorId?: number;
  isSubmitting?: boolean;
  error?: unknown;
  onDirtyChange?: (dirty: boolean) => void;
  onPatientSearch?: (query: string) => void;
  onSubmit: (payload: CreateAppointmentPayload | UpdateAppointmentPayload) => void | Promise<void>;
}

function initialValues(props: AppointmentFormProps): AppointmentFormValues {
  if (props.appointment) return appointmentToFormValues(props.appointment);
  return { ...defaultAppointmentFormValues, date: props.initialDate ?? "", doctorId: props.initialDoctorId ? String(props.initialDoctorId) : "" };
}

export function AppointmentForm(props: AppointmentFormProps) {
  const [values, setValues] = useState<AppointmentFormValues>(() => initialValues(props));
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const backendErrors = useMemo(() => apiFieldErrors(props.error), [props.error]);
  const initialSnapshot = useRef(JSON.stringify(initialValues(props)));
  const t = useFeatureT();
  const requestClose = useOverlayClose();

  useEffect(() => {
    const next = initialValues(props);
    initialSnapshot.current = JSON.stringify(next);
    setValues(next);
    props.onDirtyChange?.(false);
  }, [props.appointment, props.initialDate, props.initialDoctorId]);

  useEffect(() => {
    props.onDirtyChange?.(JSON.stringify(values) !== initialSnapshot.current);
  }, [props.onDirtyChange, values]);

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
    initialSnapshot.current = JSON.stringify(values);
    props.onDirtyChange?.(false);
  }

  function fieldError(field: keyof AppointmentFormValues) {
    const error = errors[field] ?? backendErrors[field];
    const local: Record<string, ReturnType<typeof t>> = {
      "Patient is required.": t("patientRequired"), "Doctor is required.": t("doctorRequired"), "Date is required.": t("dateRequired"), "Time is required.": t("timeRequired"), "Duration must be greater than zero.": t("durationInvalid"),
    };
    return error ? local[error] ?? error : undefined;
  }

  return (
    <form className="appointment-form" onSubmit={(event) => void submit(event)}>
      {props.error ? <p className="form-error">{t("unableToSaveAppointment")}</p> : null}
      <div className="appointment-form-grid">
        <Combobox label={t("patient")} value={values.patientId} onChange={(value) => setField("patientId", value)} onQueryChange={props.onPatientSearch} placeholder={t("selectPatient")} error={fieldError("patientId")} options={props.patients.map((patient) => ({ value: String(patient.id), label: `${patient.full_name}${patient.phone_number ? ` · ${patient.phone_number}` : ""}` }))} />
        <label>{t("doctor")}<select value={values.doctorId} onChange={(event) => setField("doctorId", event.target.value)} aria-invalid={Boolean(fieldError("doctorId"))}><option value="">{t("selectDoctor")}</option>{props.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</select>{fieldError("doctorId") ? <span className="field-error">{fieldError("doctorId")}</span> : null}</label>
        <label>{t("date")}<input type="date" value={values.date} onChange={(event) => setField("date", event.target.value)} aria-invalid={Boolean(fieldError("date"))} />{fieldError("date") ? <span className="field-error">{fieldError("date")}</span> : null}</label>
        <label>{t("time")}<input type="time" value={values.time} onChange={(event) => setField("time", event.target.value)} aria-invalid={Boolean(fieldError("time"))} />{fieldError("time") ? <span className="field-error">{fieldError("time")}</span> : null}</label>
        <label>{t("duration")}<input value={values.durationMinutes} onChange={(event) => setField("durationMinutes", event.target.value)} inputMode="numeric" aria-invalid={Boolean(fieldError("durationMinutes"))} />{fieldError("durationMinutes") ? <span className="field-error">{fieldError("durationMinutes")}</span> : null}</label>
        <label>{t("reason")}<input value={values.reason} onChange={(event) => setField("reason", event.target.value)} /></label>
      </div>
      <label>{t("notes")}<textarea value={values.notes} rows={4} onChange={(event) => setField("notes", event.target.value)} /></label>
      <p className="form-note">{t("statusChangedFromDetails")}</p>
      <div className="form-actions"><button className="button secondary" type="button" onClick={requestClose}>{t("cancel")}</button><button className="button primary" type="submit" disabled={props.isSubmitting}>{props.mode === "reschedule" ? t("saveReschedule") : props.mode === "edit" ? t("saveChanges") : t("saveAppointment")}</button></div>
    </form>
  );
}
