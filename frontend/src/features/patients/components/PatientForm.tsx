import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { PatientBloodGroup, PatientDetail, PatientGender } from "../../../types/patients";
import {
  PatientFormErrors,
  PatientFormValues,
  apiErrorToFormErrors,
  createPayloadFromForm,
  emptyPatientFormValues,
  formValuesFromPatient,
  updatePayloadFromForm,
  validatePatientForm,
} from "../utils/patientFormMapping";
import { patientCopy } from "../i18n";

interface PatientFormProps {
  mode: "create" | "edit";
  section?: "general" | "medical";
  role: UserRole;
  patient?: PatientDetail | null;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: unknown;
  onSubmit: (values: PatientFormValues) => Promise<void> | void;
  onCancel?: () => void;
  onReloadLatest?: () => void;
  onContinueReviewing?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const bloodGroups = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function hasErrors(errors: PatientFormErrors) {
  return Object.values(errors).some(Boolean);
}

export function PatientForm({
  mode,
  section,
  role,
  patient,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  onReloadLatest,
  onContinueReviewing,
  onDirtyChange,
}: PatientFormProps) {
  const language = useAuthStore((state) => state.user?.language_preference);
  const c = patientCopy(language);
  const [values, setValues] = useState<PatientFormValues>(() => (mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const initialValues = useRef(JSON.stringify(mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));

  useEffect(() => {
    const next = mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues;
    setValues(next);
    initialValues.current = JSON.stringify(next);
  }, [mode, patient]);

  useEffect(() => {
    if (error) setErrors(apiErrorToFormErrors(error));
  }, [error]);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(values) !== initialValues.current);
  }, [onDirtyChange, values]);

  function updateField<K extends keyof PatientFormValues>(field: K, value: PatientFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validatePatientForm(values);
    if (hasErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }
    await onSubmit(values);
  }

  const fieldPrefix = mode === "create" ? "create-patient" : "edit-patient";

  const isMedicalOnly = section === "medical";
  const showGeneralInformation = !isMedicalOnly;
  const showMedicalInformation = section === "medical" || (mode === "edit" && section === "general");

  function cancel() {
    if (isSubmitting) return;
    if (JSON.stringify(values) !== initialValues.current && !window.confirm(c.discardChanges)) return;
    onCancel?.();
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      {errors.form ? <div className="form-error">{errors.form}</div> : null}
      {errors.conflict ? (
        <div className="form-error conflict-banner">
          <p>{errors.conflict}</p>
          <div className="form-actions">
            <button className="button secondary compact-button" type="button" onClick={onContinueReviewing}>
              {c.continueReviewing}
            </button>
            <button className="button primary compact-button" type="button" onClick={onReloadLatest}>
              {c.reloadLatest}
            </button>
          </div>
        </div>
      ) : null}

      {showGeneralInformation ? <>
      <section className="patient-form-section">
        <h4>{c.identity}</h4>
        <div className="patient-form-grid">
          <label>
            {c.firstName} <span aria-hidden="true">*</span>
            <input
              id={`${fieldPrefix}-first-name`}
              value={values.first_name}
              onChange={(event) => updateField("first_name", event.target.value)}
              aria-invalid={Boolean(errors.first_name)}
              aria-describedby={errors.first_name ? `${fieldPrefix}-first-name-error` : undefined}
            />
            {errors.first_name ? <span id={`${fieldPrefix}-first-name-error`} className="field-error">{errors.first_name}</span> : null}
          </label>

          <label>
            {c.lastName} <span aria-hidden="true">*</span>
            <input
              id={`${fieldPrefix}-last-name`}
              value={values.last_name}
              onChange={(event) => updateField("last_name", event.target.value)}
              aria-invalid={Boolean(errors.last_name)}
              aria-describedby={errors.last_name ? `${fieldPrefix}-last-name-error` : undefined}
            />
            {errors.last_name ? <span id={`${fieldPrefix}-last-name-error`} className="field-error">{errors.last_name}</span> : null}
          </label>

          <label>
            {c.gender} <span aria-hidden="true">*</span>
            <select value={values.gender} onChange={(event) => updateField("gender", event.target.value as PatientGender)}>
              <option value="Female">{c.female}</option>
              <option value="Male">{c.male}</option>
            </select>
          </label>

          <label>
            {c.dateOfBirth}
            <input
              type="date"
              value={values.date_of_birth}
              onChange={(event) => updateField("date_of_birth", event.target.value)}
              aria-invalid={Boolean(errors.date_of_birth)}
            />
            {errors.date_of_birth ? <span className="field-error">{errors.date_of_birth}</span> : null}
          </label>
          <label>
            {c.bloodGroup}
            <select value={values.blood_group} onChange={(event) => updateField("blood_group", event.target.value as PatientBloodGroup)}>
              {bloodGroups.map((group) => <option key={group || "none"} value={group}>{group || c.noBloodGroup}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="patient-form-section">
        <h4>{c.contactDetails}</h4>
        <div className="patient-form-grid">
          <label>
            {c.phone}
            <input id={`${fieldPrefix}-phone-number`} value={values.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} />
            {errors.phone_number ? <span className="field-error">{errors.phone_number}</span> : null}
          </label>
          <label>
            {c.email}
            <input type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} />
            {errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>
          <label>
            {c.nationalId}
            <input value={values.national_id_or_passport} onChange={(event) => updateField("national_id_or_passport", event.target.value)} />
            {errors.national_id_or_passport ? <span className="field-error">{errors.national_id_or_passport}</span> : null}
          </label>
          <label>
            {c.emergencyContact}
            <input value={values.emergency_contact} onChange={(event) => updateField("emergency_contact", event.target.value)} />
          </label>
        </div>
        <label>
          {c.address}
          <textarea value={values.address} onChange={(event) => updateField("address", event.target.value)} rows={3} />
        </label>
      </section></> : null}

      {showMedicalInformation ? <section className="patient-form-section">
        <h4>{c.clinicalProfile}</h4>
        <label>
          {c.medicalConditions}
          <textarea value={values.medical_conditions_history} onChange={(event) => updateField("medical_conditions_history", event.target.value)} rows={5} />
        </label>
        <label>
          {c.insurance}
          <textarea value={values.insurance_info} onChange={(event) => updateField("insurance_info", event.target.value)} rows={4} />
        </label>
        <label>
          {c.generalNotes}
          <textarea value={values.general_notes} onChange={(event) => updateField("general_notes", event.target.value)} rows={5} />
        </label>
      </section> : null}

      {role === "DOCTOR" ? <p className="form-note">{c.staffOnlyNote}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button className="button secondary" type="button" onClick={cancel} disabled={isSubmitting}>
            {c.cancel}
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? c.saving : submitLabel ?? c.save}
        </button>
      </div>
    </form>
  );
}

export { createPayloadFromForm, updatePayloadFromForm };
