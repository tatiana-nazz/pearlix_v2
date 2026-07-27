import type { ClinicalNotesValues } from "../utils/visitForm";
import { useAuthStore } from "../../../auth/authStore";
import { visitCopy } from "../i18n";

interface ClinicalNotesFormProps {
  values: ClinicalNotesValues;
  disabled?: boolean;
  isSaving?: boolean;
  error?: unknown;
  onChange: (field: keyof ClinicalNotesValues, value: string) => void;
}

export function ClinicalNotesForm({ values, disabled, isSaving, error, onChange }: ClinicalNotesFormProps) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const fields: Array<{ key: keyof ClinicalNotesValues; label: string; helper: string; area: string }> = [
    { key: "symptoms", label: c.subjectiveNotes, helper: c.subjectiveHelper, area: "subjective" },
    { key: "clinical_notes", label: c.objectiveNotes, helper: c.objectiveHelper, area: "objective" },
    { key: "diagnosis", label: c.assessment, helper: c.assessmentHelper, area: "assessment" },
    { key: "treatment", label: c.plan, helper: c.planHelper, area: "plan" },
    { key: "follow_up_notes", label: c.generalNotes, helper: c.generalNotesHelper, area: "general" },
  ];
  return (
    <form className="clinical-notes-form" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <label className={`clinical-note-field clinical-note-${field.area}`} key={field.key}>
          <span className="clinical-note-label">{field.label}</span>
          <span className="clinical-note-helper" id={`clinical-note-${field.key}-helper`}>{field.helper}</span>
          <textarea
            name={field.key}
            aria-label={field.label}
            aria-describedby={`clinical-note-${field.key}-helper`}
            rows={6}
            value={values[field.key]}
            disabled={disabled || isSaving}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}
      {error ? <p className="form-error" role="alert">{c.saveError}</p> : null}
    </form>
  );
}
