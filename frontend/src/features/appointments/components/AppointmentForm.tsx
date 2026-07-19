import { useEffect, useMemo, useRef, useState } from "react";

import type { AppointmentDetail, AppointmentListItem, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
import type { PatientListItem } from "../../../types/patients";
import { Button, Combobox, SelectField, useOverlayClose } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import { useAppointmentAvailability } from "../hooks/useAppointments";
import type { ValidClinicSafeSettings } from "../hooks/useClinicSafeSettings";
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
  doctorsLoading?: boolean;
  doctorsError?: unknown;
  onRetryDoctors?: () => void;
  patients: PatientListItem[];
  patientsLoading?: boolean;
  patientsError?: unknown;
  onRetryPatients?: () => void;
  settings?: ValidClinicSafeSettings;
  settingsLoading?: boolean;
  settingsError?: unknown;
  onRetrySettings?: () => void;
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
  return {
    ...defaultAppointmentFormValues,
    date: props.initialDate ?? "",
    doctorId: props.initialDoctorId && props.doctors.some((doctor) => doctor.id === props.initialDoctorId && doctor.is_active) ? String(props.initialDoctorId) : "",
    durationMinutes: props.settings ? String(props.settings.default_appointment_duration_minutes) : "",
  };
}

function slotTime(value: string) {
  return value.split("T")[1]?.slice(0, 5) ?? "";
}

export function AppointmentForm(props: AppointmentFormProps) {
  const [values, setValues] = useState<AppointmentFormValues>(() => initialValues(props));
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const [availabilityMessage, setAvailabilityMessage] = useState<string>();
  const backendErrors = useMemo(() => apiFieldErrors(props.error), [props.error]);
  const initialSnapshot = useRef(JSON.stringify(initialValues(props)));
  const initial = useRef(initialValues(props));
  const t = useFeatureT();
  const requestClose = useOverlayClose();
  const duration = Number(values.durationMinutes);
  const dependenciesValid = Number(values.doctorId) > 0 && Boolean(values.date) && Number.isInteger(duration) && duration > 0;
  const availability = useAppointmentAvailability(dependenciesValid ? { doctor_id: Number(values.doctorId), date: values.date, duration_minutes: duration } : null);
  const currentContext = Boolean(props.appointment)
    && values.doctorId === initial.current.doctorId
    && values.date === initial.current.date
    && values.durationMinutes === initial.current.durationMinutes;
  const currentTime = initial.current.time;
  const slots = useMemo(() => [...(availability.data?.available_slots ?? [])]
    .filter((slot) => slot.capacity > slot.current_count)
    .sort((left, right) => left.start_datetime.localeCompare(right.start_datetime)), [availability.data?.available_slots]);
  const liveTimes = slots.map((slot) => slotTime(slot.start_datetime)).filter(Boolean);
  const canPreserveCurrentTime = currentContext && values.time === currentTime;

  useEffect(() => {
    const next = initialValues(props);
    initial.current = next;
    initialSnapshot.current = JSON.stringify(next);
    setValues(next);
    setErrors({});
    setAvailabilityMessage(undefined);
    props.onDirtyChange?.(false);
  }, [props.appointment, props.initialDate, props.initialDoctorId, props.settings?.default_appointment_duration_minutes]);

  useEffect(() => {
    if (props.appointment || !props.initialDoctorId || !props.doctors.some((doctor) => doctor.id === props.initialDoctorId && doctor.is_active)) return;
    setValues((current) => current.doctorId ? current : { ...current, doctorId: String(props.initialDoctorId) });
  }, [props.appointment, props.doctors, props.initialDoctorId]);

  useEffect(() => {
    props.onDirtyChange?.(JSON.stringify(values) !== initialSnapshot.current);
  }, [props.onDirtyChange, values]);

  function setField(field: keyof AppointmentFormValues, value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value };
      if ((field === "doctorId" || field === "date" || field === "durationMinutes") && value !== current[field]) next.time = "";
      return next;
    });
    setAvailabilityMessage(undefined);
    setErrors((current) => ({ ...current, [field]: undefined, ...(field === "doctorId" || field === "date" || field === "durationMinutes" ? { time: undefined } : {}) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!props.settings) {
      setErrors({ form: "Clinic settings unavailable." });
      return;
    }
    const refreshed = dependenciesValid ? await availability.refetch() : undefined;
    const refreshedTimes = refreshed?.data?.available_slots.filter((slot) => slot.capacity > slot.current_count).map((slot) => slotTime(slot.start_datetime)) ?? liveTimes;
    const nextErrors = validateAppointmentForm(values, {
      allowedDurations: props.settings.allowed_durations_minutes,
      validTimes: refreshedTimes,
      allowCurrentTime: canPreserveCurrentTime,
    });
    const activeDoctor = props.doctors.some((doctor) => doctor.is_active && doctor.id === Number(values.doctorId));
    const preservingCurrentDoctor = Boolean(props.appointment) && values.doctorId === initial.current.doctorId;
    if (!activeDoctor && !preservingCurrentDoctor) nextErrors.doctorId = "Select an active doctor.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (values.time && !canPreserveCurrentTime && !refreshedTimes.includes(values.time)) setAvailabilityMessage(t("slotNoLongerAvailable"));
      return;
    }
    const payload = props.mode === "create" ? formValuesToCreatePayload(values) : formValuesToUpdatePayload(values);
    await props.onSubmit(payload);
    initialSnapshot.current = JSON.stringify(values);
    props.onDirtyChange?.(false);
  }

  function fieldError(field: keyof AppointmentFormValues) {
    const error = errors[field] ?? backendErrors[field];
    const local: Record<string, string> = {
      "Patient is required.": t("patientRequired"), "Doctor is required.": t("doctorRequired"), "Select an active doctor.": t("selectActiveDoctor"), "Date is required.": t("dateRequired"), "Time is required.": t("timeRequired"), "Duration must be greater than zero.": t("durationInvalid"), "Select an allowed duration.": t("selectAllowedDuration"), "Select an available time.": t("selectAvailableTime"),
    };
    return error ? local[error] ?? error : undefined;
  }

  const activeDoctors = props.doctors.filter((doctor) => doctor.is_active);
  const currentDoctor = props.appointment?.doctor;
  const doctorOptions = currentDoctor && !activeDoctors.some((doctor) => doctor.id === currentDoctor.id)
    ? [{ id: currentDoctor.id, full_name: currentDoctor.full_name, is_active: false, doctor_profile: null }, ...activeDoctors]
    : activeDoctors;
  const patientOptions = props.patients.map((patient) => ({ value: String(patient.id), label: `${patient.full_name}${patient.phone_number ? ` · ${patient.phone_number}` : ""}`, disabled: patient.is_archived && String(patient.id) !== values.patientId }));

  return (
    <form className="appointment-form" onSubmit={(event) => void submit(event)}>
      {props.error || errors.form || availabilityMessage ? <p className="form-error" role="alert">{availabilityMessage ?? (errors.form ? t("clinicSettingsUnavailable") : t("unableToSaveAppointment"))}</p> : null}
      {props.settingsError && !errors.form ? <p className="form-error" role="alert">{t("clinicSettingsUnavailable")} <Button compact type="button" variant="secondary" onClick={props.onRetrySettings}>{t("retrySettings")}</Button></p> : null}
      <div className="appointment-form-grid">
        <div className="appointment-field patient-field"><Combobox label={t("patient")} value={values.patientId} onChange={(value) => setField("patientId", value)} onQueryChange={props.onPatientSearch} placeholder={t("selectPatient")} error={fieldError("patientId")} options={patientOptions} />{props.patientsLoading ? <span className="form-note">{t("patientSearchLoading")}</span> : null}{props.patientsError ? <span className="field-error">{t("patientSearchError")} <Button compact type="button" variant="secondary" onClick={props.onRetryPatients}>{t("retry")}</Button></span> : null}{!props.patientsLoading && !props.patientsError && patientOptions.length === 0 ? <span className="form-note">{t("patientSearchNoMatch")}</span> : null}</div>
        <div className="appointment-field doctor-field"><SelectField label={t("doctor")} value={values.doctorId} onChange={(event) => setField("doctorId", event.target.value)} error={fieldError("doctorId")} disabled={props.doctorsLoading || Boolean(props.doctorsError)}><option value="">{props.doctorsLoading ? t("loadingDoctors") : t("selectDoctor")}</option>{doctorOptions.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}{doctor.doctor_profile?.specialty ? ` — ${doctor.doctor_profile.specialty}` : ""}{!doctor.is_active ? ` (${t("inactiveCurrentDoctor")})` : ""}</option>)}</SelectField>{props.doctorsError ? <span className="field-error">{t("doctorsUnavailable")} <Button compact type="button" variant="secondary" onClick={props.onRetryDoctors}>{t("retry")}</Button></span> : null}{!props.doctorsLoading && !props.doctorsError && activeDoctors.length === 0 ? <span className="form-note">{t("noActiveDoctors")}</span> : null}</div>
        <div className="appointment-field date-field"><label>{t("date")}<input type="date" value={values.date} onChange={(event) => setField("date", event.target.value)} aria-invalid={Boolean(fieldError("date"))} />{fieldError("date") ? <span className="field-error">{fieldError("date")}</span> : null}</label></div>
        <div className="appointment-field duration-field"><SelectField label={t("duration")} value={values.durationMinutes} onChange={(event) => setField("durationMinutes", event.target.value)} error={fieldError("durationMinutes")} disabled={props.settingsLoading || Boolean(props.settingsError) || !props.settings}><option value="">{props.settingsLoading ? t("loading") : t("selectAllowedDuration")}</option>{props.appointment && props.settings && !props.settings.allowed_durations_minutes.includes(Number(initial.current.durationMinutes)) ? <option value={initial.current.durationMinutes}>{t("currentLegacyDuration")} ({initial.current.durationMinutes} {t("minutes")})</option> : null}{props.settings?.allowed_durations_minutes.map((minutes) => <option key={minutes} value={minutes}>{minutes} {t("minutes")}</option>)}</SelectField></div>
        <div className="appointment-field time-field"><SelectField label={t("availableTime")} value={values.time} onChange={(event) => setField("time", event.target.value)} error={fieldError("time")} disabled={!dependenciesValid || availability.isLoading || Boolean(availability.error) || !slots.length}><option value="">{availability.isLoading ? t("loadingAvailableTimes") : !dependenciesValid ? t("selectAvailableTime") : !slots.length ? t("noAvailableTimes") : t("selectAvailableTime")}</option>{canPreserveCurrentTime && !liveTimes.includes(currentTime) ? <option value={currentTime}>{t("currentAppointmentTime")} ({currentTime})</option> : null}{slots.map((slot) => { const remaining = slot.capacity - slot.current_count; return <option key={slot.start_datetime} value={slotTime(slot.start_datetime)}>{slotTime(slot.start_datetime)} – {slotTime(slot.end_datetime)}{remaining < slot.capacity ? ` · ${remaining} ${t("remainingSpots")}` : ""}</option>; })}</SelectField>{availability.error ? <span className="field-error">{t("unableToLoadAvailability")} <Button compact type="button" variant="secondary" onClick={() => void availability.refetch()}>{t("retryAvailability")}</Button></span> : null}</div>
        <div className="appointment-field reason-field"><label>{t("reason")}<input value={values.reason} onChange={(event) => setField("reason", event.target.value)} aria-invalid={Boolean(fieldError("reason"))} />{fieldError("reason") ? <span className="field-error">{fieldError("reason")}</span> : null}</label></div>
        <div className="appointment-field notes-field"><label>{t("notes")}<textarea value={values.notes} rows={4} onChange={(event) => setField("notes", event.target.value)} aria-invalid={Boolean(fieldError("notes"))} />{fieldError("notes") ? <span className="field-error">{fieldError("notes")}</span> : null}</label></div>
      </div>
      <p className="form-note">{t("statusChangedFromDetails")}</p>
      <div className="form-actions"><button className="button secondary" type="button" disabled={props.isSubmitting} onClick={requestClose}>{t("cancel")}</button><button className="button primary" type="submit" disabled={props.isSubmitting || props.settingsLoading}>{props.mode === "reschedule" ? t("saveReschedule") : props.mode === "edit" ? t("saveChanges") : t("saveAppointment")}</button></div>
    </form>
  );
}
