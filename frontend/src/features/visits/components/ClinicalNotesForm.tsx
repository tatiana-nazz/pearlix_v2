import type { ClinicalNotesValues } from "../utils/visitForm";
import { Button } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";

interface ClinicalNotesFormProps {
  values: ClinicalNotesValues;
  disabled?: boolean;
  isSaving?: boolean;
  error?: unknown;
  onChange: (field: keyof ClinicalNotesValues, value: string) => void;
  onSave: () => void;
}

export const clinicalNoteFields: Array<{ key: keyof ClinicalNotesValues; label: "symptoms" | "diagnosis" | "treatment" | "clinicalNotes" | "followUpNotes"; rows: number }> = [
  { key: "symptoms", label: "symptoms", rows: 3 },
  { key: "diagnosis", label: "diagnosis", rows: 3 },
  { key: "treatment", label: "treatment", rows: 3 },
  { key: "clinical_notes", label: "clinicalNotes", rows: 6 },
  { key: "follow_up_notes", label: "followUpNotes", rows: 3 },
];

export function ClinicalNotesForm({ values, disabled, isSaving, error, onChange, onSave }: ClinicalNotesFormProps) {
  const t = useFeatureT();
  return (
    <form
      className="clinical-notes-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="clinical-notes-grid">
      {clinicalNoteFields.map((field, index) => (
        <label key={field.key} className={index === 3 ? "clinical-note-field wide" : "clinical-note-field"}>
          <span>{t(field.label)}</span>
          <textarea
            name={field.key}
            rows={field.rows}
            value={values[field.key]}
            disabled={disabled || isSaving}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}
      </div>
      {error ? <p className="form-error" role="alert">{t("unableToSaveNotes")}</p> : null}
      <div className="form-actions clinical-notes-actions">
        <Button type="submit" loading={isSaving} disabled={disabled}>{isSaving ? t("savingNotes") : t("saveNotes")}</Button>
      </div>
    </form>
  );
}
