import { type FormEvent, useEffect, useState } from "react";

import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
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

interface PatientFormProps {
  mode: "create" | "edit";
  role: UserRole;
  patient?: PatientDetail | null;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: unknown;
  onSubmit: (values: PatientFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

function hasErrors(errors: PatientFormErrors) {
  return Object.values(errors).some(Boolean);
}

export function PatientForm({ mode, role, patient, submitLabel, isSubmitting, error, onSubmit, onCancel }: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(() => (mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));
  const [errors, setErrors] = useState<PatientFormErrors>({});

  useEffect(() => {
    if (mode === "edit") setValues(formValuesFromPatient(patient));
  }, [mode, patient]);

  useEffect(() => {
    if (error) setErrors(apiErrorToFormErrors(error));
  }, [error]);

  function updateField(field: keyof PatientFormValues, value: string) {
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

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      {errors.form ? <div className="form-error">{errors.form}</div> : null}
      <div className="patient-form-grid">
        <label>
          Full name <span aria-hidden="true">*</span>
          <input
            id={`${fieldPrefix}-full-name`}
            value={values.full_name}
            onChange={(event) => updateField("full_name", event.target.value)}
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? `${fieldPrefix}-full-name-error` : undefined}
          />
          {errors.full_name ? <span id={`${fieldPrefix}-full-name-error`} className="field-error">{errors.full_name}</span> : null}
        </label>

        <label>
          Phone <span aria-hidden="true">*</span>
          <input
            id={`${fieldPrefix}-phone`}
            value={values.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${fieldPrefix}-phone-error` : undefined}
          />
          {errors.phone ? <span id={`${fieldPrefix}-phone-error`} className="field-error">{errors.phone}</span> : null}
        </label>

        <label>
          Gender
          <select value={values.gender} onChange={(event) => updateField("gender", event.target.value)}>
            <option value="UNSPECIFIED">Unspecified</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Birth date
          <input
            type="date"
            value={values.birth_date}
            onChange={(event) => updateField("birth_date", event.target.value)}
            aria-invalid={Boolean(errors.birth_date)}
          />
          {errors.birth_date ? <span className="field-error">{errors.birth_date}</span> : null}
        </label>
      </div>

      <label>
        Address
        <textarea value={values.address} onChange={(event) => updateField("address", event.target.value)} rows={3} />
      </label>

      <label>
        Medical summary
        <textarea value={values.medical_summary} onChange={(event) => updateField("medical_summary", event.target.value)} rows={5} />
      </label>

      <label>
        General notes
        <textarea value={values.general_notes} onChange={(event) => updateField("general_notes", event.target.value)} rows={5} />
      </label>

      {role === "DOCTOR" ? <p className="form-note">Doctors can update patient profile fields for active patients only. Archive controls are hidden.</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button className="button secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel ?? "Save patient"}
        </button>
      </div>
    </form>
  );
}

export { createPayloadFromForm, updatePayloadFromForm };
