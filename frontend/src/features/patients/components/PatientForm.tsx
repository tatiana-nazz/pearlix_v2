import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";

import type { UserRole } from "../../../types/auth";
import type { PatientBloodGroup, PatientDetail, PatientGender } from "../../../types/patients";
import { useFeatureT } from "../../../layouts/i18n";
import { useOverlayClose } from "../../../components/v2";
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
  onSubmit: (values: PatientFormValues) => Promise<void | boolean> | void | boolean;
  onCancel?: () => void;
  onReloadLatest?: () => void;
  reloadLatestRef?: RefObject<HTMLButtonElement>;
  onContinueReviewing?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
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
  reloadLatestRef,
  onContinueReviewing,
  onDirtyChange,
}: PatientFormProps) {
  const t = useFeatureT();
  const [values, setValues] = useState<PatientFormValues>(() => (mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [apiErrors, setApiErrors] = useState<PatientFormErrors>({});
  const initialSnapshot = useRef(JSON.stringify(mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues));
  const requestClose = useOverlayClose();

  useEffect(() => {
    const next = mode === "edit" ? formValuesFromPatient(patient) : emptyPatientFormValues;
    initialSnapshot.current = JSON.stringify(next);
    setValues(next);
    onDirtyChange?.(false);
  }, [mode, patient]);

  useEffect(() => { onDirtyChange?.(JSON.stringify(values) !== initialSnapshot.current); }, [onDirtyChange, values]);

  useEffect(() => { setApiErrors(error ? apiErrorToFormErrors(error) : {}); }, [error]);

  function updateField<K extends keyof PatientFormValues>(field: K, value: PatientFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setApiErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function message(error: string | undefined) {
    if (!error) return error;
    const known: Record<string, "firstNameRequired" | "lastNameRequired" | "genderRequired" | "dobFuture" | "requestFailed" | "patientChangedElsewhere" | "duplicatePhone" | "duplicateEmail" | "duplicateNationalId" | "invalidPhone" | "invalidEmail" | "invalidNationalId" | "invalidGender" | "invalidDateOfBirth"> = {
      firstNameRequired: "firstNameRequired", lastNameRequired: "lastNameRequired", genderRequired: "genderRequired", dobFuture: "dobFuture", requestFailed: "requestFailed", patientChangedElsewhere: "patientChangedElsewhere", duplicatePhone: "duplicatePhone", duplicateEmail: "duplicateEmail", duplicateNationalId: "duplicateNationalId", invalidPhone: "invalidPhone", invalidEmail: "invalidEmail", invalidNationalId: "invalidNationalId", invalidGender: "invalidGender", invalidDateOfBirth: "invalidDateOfBirth",
    };
    if (known[error]) return t(known[error]);
    const lower = error.toLowerCase();
    if (lower.includes("phone") && (lower.includes("already") || lower.includes("unique") || lower.includes("exists"))) return t("duplicatePhone");
    if (lower.includes("email") && (lower.includes("already") || lower.includes("unique") || lower.includes("exists"))) return t("duplicateEmail");
    if ((lower.includes("national") || lower.includes("passport")) && (lower.includes("already") || lower.includes("unique") || lower.includes("exists"))) return t("duplicateNationalId");
    if (lower.includes("phone") && (lower.includes("valid") || lower.includes("invalid"))) return t("invalidPhone");
    if (lower.includes("email") && (lower.includes("valid") || lower.includes("invalid"))) return t("invalidEmail");
    if (lower.includes("national") || lower.includes("passport")) return lower.includes("valid") || lower.includes("invalid") ? t("invalidNationalId") : error;
    if (lower.includes("gender")) return t("invalidGender");
    if (lower.includes("date") && lower.includes("birth")) return t("invalidDateOfBirth");
    return error;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validatePatientForm(values);
    if (hasErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }
    const completed = await onSubmit(values);
    if (completed === false) return;
    initialSnapshot.current = JSON.stringify(values);
    onDirtyChange?.(false);
  }

  const fieldPrefix = mode === "create" ? "create-patient" : "edit-patient";

  return (
    <form className="patient-form v2-form" onSubmit={handleSubmit} noValidate>
      {errors.form || apiErrors.form ? <div className="form-error">{message(errors.form ?? apiErrors.form)}</div> : null}
      {apiErrors.conflict ? (
        <div className="form-error conflict-banner">
          <p>{message(apiErrors.conflict)}</p>
          <div className="form-actions">
            <button className="button secondary compact-button" type="button" onClick={() => { setApiErrors((current) => ({ ...current, conflict: undefined, form: undefined })); onContinueReviewing?.(); }}>
              {t("continueReviewing")}
            </button>
            <button ref={reloadLatestRef} className="button primary compact-button" type="button" onClick={onReloadLatest}>
              {t("reloadLatest")}
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
              aria-invalid={Boolean(errors.first_name ?? apiErrors.first_name)}
              aria-describedby={errors.first_name ?? apiErrors.first_name ? `${fieldPrefix}-first-name-error` : undefined}
            />
            {errors.first_name || apiErrors.first_name ? <span id={`${fieldPrefix}-first-name-error`} className="field-error">{message(errors.first_name ?? apiErrors.first_name)}</span> : null}
          </label>

          <label>
            {t("lastName")} <span aria-hidden="true">*</span>
            <input
              id={`${fieldPrefix}-last-name`}
              value={values.last_name}
              onChange={(event) => updateField("last_name", event.target.value)}
              aria-invalid={Boolean(errors.last_name ?? apiErrors.last_name)}
              aria-describedby={errors.last_name ?? apiErrors.last_name ? `${fieldPrefix}-last-name-error` : undefined}
            />
            {errors.last_name || apiErrors.last_name ? <span id={`${fieldPrefix}-last-name-error`} className="field-error">{message(errors.last_name ?? apiErrors.last_name)}</span> : null}
          </label>

          <label>
            {t("gender")} <span aria-hidden="true">*</span>
            <select id={`${fieldPrefix}-gender`} value={values.gender} onChange={(event) => updateField("gender", event.target.value as PatientGender)} aria-invalid={Boolean(errors.gender ?? apiErrors.gender)} aria-describedby={errors.gender ?? apiErrors.gender ? `${fieldPrefix}-gender-error` : undefined}>
              <option value="Female">{t("female")}</option>
              <option value="Male">{t("male")}</option>
            </select>
            {errors.gender || apiErrors.gender ? <span id={`${fieldPrefix}-gender-error`} className="field-error">{message(errors.gender ?? apiErrors.gender)}</span> : null}
          </label>

          <label>
            {t("dateOfBirth")}
            <input
              type="date"
              id={`${fieldPrefix}-date-of-birth`}
              value={values.date_of_birth}
              onChange={(event) => updateField("date_of_birth", event.target.value)}
              aria-invalid={Boolean(errors.date_of_birth ?? apiErrors.date_of_birth)}
              aria-describedby={errors.date_of_birth ?? apiErrors.date_of_birth ? `${fieldPrefix}-date-of-birth-error` : undefined}
            />
            {errors.date_of_birth || apiErrors.date_of_birth ? <span id={`${fieldPrefix}-date-of-birth-error`} className="field-error">{message(errors.date_of_birth ?? apiErrors.date_of_birth)}</span> : null}
          </label>
        </div>
      </section>

      <section className="patient-form-section v2-form-section">
        <h4>{t("contactIdentifiers")}</h4>
        <div className="patient-form-grid">
          <label>
            {t("phone")}
            <input id={`${fieldPrefix}-phone-number`} value={values.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} aria-invalid={Boolean(errors.phone_number ?? apiErrors.phone_number)} aria-describedby={errors.phone_number ?? apiErrors.phone_number ? `${fieldPrefix}-phone-number-error` : undefined} />
            {errors.phone_number || apiErrors.phone_number ? <span id={`${fieldPrefix}-phone-number-error`} className="field-error">{message(errors.phone_number ?? apiErrors.phone_number)}</span> : null}
          </label>
          <label>
            {t("email")}
            <input id={`${fieldPrefix}-email`} type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email ?? apiErrors.email)} aria-describedby={errors.email ?? apiErrors.email ? `${fieldPrefix}-email-error` : undefined} />
            {errors.email || apiErrors.email ? <span id={`${fieldPrefix}-email-error`} className="field-error">{message(errors.email ?? apiErrors.email)}</span> : null}
          </label>
          <label>
            {t("nationalId")}
            <input id={`${fieldPrefix}-national-id`} value={values.national_id_or_passport} onChange={(event) => updateField("national_id_or_passport", event.target.value)} aria-invalid={Boolean(errors.national_id_or_passport ?? apiErrors.national_id_or_passport)} aria-describedby={errors.national_id_or_passport ?? apiErrors.national_id_or_passport ? `${fieldPrefix}-national-id-error` : undefined} />
            {errors.national_id_or_passport || apiErrors.national_id_or_passport ? <span id={`${fieldPrefix}-national-id-error`} className="field-error">{message(errors.national_id_or_passport ?? apiErrors.national_id_or_passport)}</span> : null}
          </label>
          <label>
            {t("emergencyContact")}
            <input id={`${fieldPrefix}-emergency-contact`} value={values.emergency_contact} onChange={(event) => updateField("emergency_contact", event.target.value)} aria-invalid={Boolean(errors.emergency_contact ?? apiErrors.emergency_contact)} aria-describedby={errors.emergency_contact ?? apiErrors.emergency_contact ? `${fieldPrefix}-emergency-contact-error` : undefined} />
            {errors.emergency_contact || apiErrors.emergency_contact ? <span id={`${fieldPrefix}-emergency-contact-error`} className="field-error">{message(errors.emergency_contact ?? apiErrors.emergency_contact)}</span> : null}
          </label>
        </div>
        <label>
          {t("address")}
          <textarea id={`${fieldPrefix}-address`} value={values.address} onChange={(event) => updateField("address", event.target.value)} rows={3} aria-invalid={Boolean(errors.address ?? apiErrors.address)} aria-describedby={errors.address ?? apiErrors.address ? `${fieldPrefix}-address-error` : undefined} />
          {errors.address || apiErrors.address ? <span id={`${fieldPrefix}-address-error`} className="field-error">{message(errors.address ?? apiErrors.address)}</span> : null}
        </label>
      </section>

      <section className="patient-form-section v2-form-section">
        <h4>{t("clinicalProfile")}</h4>
        <div className="patient-form-grid">
          <label>
            {t("bloodGroup")}
            <select id={`${fieldPrefix}-blood-group`} value={values.blood_group} onChange={(event) => updateField("blood_group", event.target.value as PatientBloodGroup)} aria-invalid={Boolean(errors.blood_group ?? apiErrors.blood_group)} aria-describedby={errors.blood_group ?? apiErrors.blood_group ? `${fieldPrefix}-blood-group-error` : undefined}>
              {bloodGroups.map((group) => (
                <option key={group || "none"} value={group}>
                  {group || t("notRecorded")}
                </option>
              ))}
            </select>
            {errors.blood_group || apiErrors.blood_group ? <span id={`${fieldPrefix}-blood-group-error`} className="field-error">{message(errors.blood_group ?? apiErrors.blood_group)}</span> : null}
          </label>
        </div>
        <label>
          {t("medicalHistory")}
          <textarea id={`${fieldPrefix}-medical-history`} value={values.medical_conditions_history} onChange={(event) => updateField("medical_conditions_history", event.target.value)} rows={5} aria-invalid={Boolean(errors.medical_conditions_history ?? apiErrors.medical_conditions_history)} aria-describedby={errors.medical_conditions_history ?? apiErrors.medical_conditions_history ? `${fieldPrefix}-medical-history-error` : undefined} />
          {errors.medical_conditions_history || apiErrors.medical_conditions_history ? <span id={`${fieldPrefix}-medical-history-error`} className="field-error">{message(errors.medical_conditions_history ?? apiErrors.medical_conditions_history)}</span> : null}
        </label>
        <label>
          {t("insuranceInfo")}
          <textarea id={`${fieldPrefix}-insurance-info`} value={values.insurance_info} onChange={(event) => updateField("insurance_info", event.target.value)} rows={4} aria-invalid={Boolean(errors.insurance_info ?? apiErrors.insurance_info)} aria-describedby={errors.insurance_info ?? apiErrors.insurance_info ? `${fieldPrefix}-insurance-info-error` : undefined} />
          {errors.insurance_info || apiErrors.insurance_info ? <span id={`${fieldPrefix}-insurance-info-error`} className="field-error">{message(errors.insurance_info ?? apiErrors.insurance_info)}</span> : null}
        </label>
        <label>
          {t("generalNotes")}
          <textarea id={`${fieldPrefix}-general-notes`} value={values.general_notes} onChange={(event) => updateField("general_notes", event.target.value)} rows={5} aria-invalid={Boolean(errors.general_notes ?? apiErrors.general_notes)} aria-describedby={errors.general_notes ?? apiErrors.general_notes ? `${fieldPrefix}-general-notes-error` : undefined} />
          {errors.general_notes || apiErrors.general_notes ? <span id={`${fieldPrefix}-general-notes-error`} className="field-error">{message(errors.general_notes ?? apiErrors.general_notes)}</span> : null}
        </label>
      </section>

      {role === "DOCTOR" ? <p className="form-note">{t("doctorPatientHelp")}</p> : null}

      <div className="v2-sticky-actions">
        {onCancel || mode === "edit" ? (
          <button className="button secondary" type="button" onClick={onCancel ?? requestClose} disabled={isSubmitting}>
            {t("cancel")}
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("saving") : submitLabel ?? t("save")}
        </button>
      </div>
    </form>
  );
}

export { createPayloadFromForm, updatePayloadFromForm };
