import { useFeatureT, type FeatureMessageKey } from "../../../layouts/i18n";
import type { ClinicalNotesValues } from "../utils/visitForm";

interface ClinicalNotesFormProps {
  values: ClinicalNotesValues;
  disabled?: boolean;
  isSaving?: boolean;
  error?: unknown;
  onChange: (field: keyof ClinicalNotesValues, value: string) => void;
}

export const clinicalNoteFields: Array<{
  key: keyof ClinicalNotesValues;
  label: FeatureMessageKey;
  helper: FeatureMessageKey;
  area: string;
}> = [
  { key: "symptoms", label: "subjectiveNotes", helper: "subjectiveHelper", area: "subjective" },
  { key: "clinical_notes", label: "objectiveNotes", helper: "objectiveHelper", area: "objective" },
  { key: "diagnosis", label: "assessment", helper: "assessmentHelper", area: "assessment" },
  { key: "treatment", label: "plan", helper: "planHelper", area: "plan" },
  { key: "follow_up_notes", label: "generalNotes", helper: "generalNotesHelper", area: "general" },
];

export function ClinicalNotesForm({ values, disabled, isSaving, error, onChange }: ClinicalNotesFormProps) {
  const t = useFeatureT();
  return (
    <form className="clinical-notes-form" onSubmit={(event) => event.preventDefault()}>
      {clinicalNoteFields.map((field) => (
        <label className={`clinical-note-field clinical-note-${field.area}`} key={field.key}>
          <span className="clinical-note-label">{t(field.label)}</span>
          <span className="clinical-note-helper" id={`clinical-note-${field.key}-helper`}>{t(field.helper)}</span>
          <textarea
            name={field.key}
            aria-label={t(field.label)}
            aria-describedby={`clinical-note-${field.key}-helper`}
            rows={6}
            value={values[field.key]}
            disabled={disabled || isSaving}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}
      {error ? <p className="form-error" role="alert">{t("unableToSaveNotes")}</p> : null}
    </form>
  );
}
