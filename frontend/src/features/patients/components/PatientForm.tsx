import { type FormEvent, useEffect, useState } from "react";

import type { UserRole } from "../../../types/auth";
import type { PatientBloodGroup, PatientDetail, PatientGender } from "../../../types/patients";
import { useFeatureT } from "../../../layouts/i18n";
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
  onReloadLatest?: () => void;
  onContinueReviewing?: () => void;
}

const bloodGroups = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function hasErrors(errors: PatientFormErrors) {
  return Object.values(errors).some(Boolean);
}

export function PatientForm({
  mode,
  role,
  patient,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  onReloadLatest,
  onContinueReviewing,
}: PatientFormProps) {
  const t = useFeatureT();
  const [values, setValues] = useState<PatientFormValues>(() => (mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));
  const [errors, setErrors] = useState<PatientFormErrors>({});

  useEffect(() => {
    if (mode === "edit") setValues(formValuesFromPatient(patient));
  }, [mode, patient]);

  useEffect(() => {
    if (error) setErrors(apiErrorToFormErrors(error));
  }, [error]);

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

  return (
    <form className="patient-form v2-form" onSubmit={handleSubmit} noValidate>
      {errors.form ? <div className="form-error">{errors.form}</div> : null}
      {errors.conflict ? (
        <div className="form-error conflict-banner">
          <p>{errors.conflict}</p>
          <div className="form-actions">
            <button className="button secondary compact-button" type="button" onClick={onContinueReviewing}>
              Continue reviewing my changes
            </button>
            <button className="button primary compact-button" type="button" onClick={onReloadLatest}>
              Reload latest record
            </button>
          </div>
        </div>
      ) : null}

      <section className="patient-form-section v2-form-section">
        <h4>{t("identity")}</h4>
        <div className="patient-form-grid">
          <label>
            {t("firstName")} <span aria-hidden="true">*</span>
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
            {t("lastName")} <span aria-hidden="true">*</span>
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
            {t("gender")} <span aria-hidden="true">*</span>
            <select value={values.gender} onChange={(event) => updateField("gender", event.target.value as PatientGender)}>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </label>

          <label>
            {t("dateOfBirth")}
            <input
              type="date"
              value={values.date_of_birth}
              onChange={(event) => updateField("date_of_birth", event.target.value)}
              aria-invalid={Boolean(errors.date_of_birth)}
            />
            {errors.date_of_birth ? <span className="field-error">{errors.date_of_birth}</span> : null}
          </label>
        </div>
      </section>

      <section className="patient-form-section v2-form-section">
        <h4>{t("contactIdentifiers")}</h4>
        <div className="patient-form-grid">
          <label>
            {t("phone")}
            <input id={`${fieldPrefix}-phone-number`} value={values.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} />
            {errors.phone_number ? <span className="field-error">{errors.phone_number}</span> : null}
          </label>
          <label>
            {t("email")}
            <input type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} />
            {errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>
          <label>
            {t("nationalId")}
            <input value={values.national_id_or_passport} onChange={(event) => updateField("national_id_or_passport", event.target.value)} />
            {errors.national_id_or_passport ? <span className="field-error">{errors.national_id_or_passport}</span> : null}
          </label>
          <label>
            {t("emergencyContact")}
            <input value={values.emergency_contact} onChange={(event) => updateField("emergency_contact", event.target.value)} />
            {errors.emergency_contact ? <span className="field-error">{errors.emergency_contact}</span> : null}
          </label>
        </div>
        <label>
          {t("address")}
          <textarea value={values.address} onChange={(event) => updateField("address", event.target.value)} rows={3} />
        </label>
      </section>

      <section className="patient-form-section v2-form-section">
        <h4>{t("clinicalProfile")}</h4>
        <div className="patient-form-grid">
          <label>
            {t("bloodGroup")}
            <select value={values.blood_group} onChange={(event) => updateField("blood_group", event.target.value as PatientBloodGroup)}>
              {bloodGroups.map((group) => (
                <option key={group || "none"} value={group}>
                  {group || "Not recorded"}
                </option>
              ))}
            </select>
            {errors.blood_group ? <span className="field-error">{errors.blood_group}</span> : null}
          </label>
        </div>
        <label>
          {t("medicalHistory")}
          <textarea value={values.medical_conditions_history} onChange={(event) => updateField("medical_conditions_history", event.target.value)} rows={5} />
        </label>
        <label>
          {t("insuranceInfo")}
          <textarea value={values.insurance_info} onChange={(event) => updateField("insurance_info", event.target.value)} rows={4} />
        </label>
        <label>
          {t("generalNotes")}
          <textarea value={values.general_notes} onChange={(event) => updateField("general_notes", event.target.value)} rows={5} />
        </label>
      </section>

      {role === "DOCTOR" ? <p className="form-note">Doctors can update patient profile fields for active patients only. Archive controls are hidden.</p> : null}

      <div className="v2-sticky-actions">
        {onCancel ? (
          <button className="button secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            {t("cancel")}
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? `${t("save")}...` : submitLabel ?? t("save")}
        </button>
      </div>
    </form>
  );
}

export { createPayloadFromForm, updatePayloadFromForm };
