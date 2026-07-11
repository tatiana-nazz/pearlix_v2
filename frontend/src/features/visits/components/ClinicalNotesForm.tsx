import type { ClinicalNotesValues } from "../utils/visitForm";

interface ClinicalNotesFormProps {
  values: ClinicalNotesValues;
  disabled?: boolean;
  isSaving?: boolean;
  error?: unknown;
  onChange: (field: keyof ClinicalNotesValues, value: string) => void;
  onSave: () => void;
}

const fields: Array<{ key: keyof ClinicalNotesValues; label: string; rows: number }> = [
  { key: "symptoms", label: "Symptoms", rows: 3 },
  { key: "diagnosis", label: "Diagnosis", rows: 3 },
  { key: "treatment", label: "Treatment", rows: 3 },
  { key: "clinical_notes", label: "Clinical notes", rows: 6 },
  { key: "follow_up_notes", label: "Follow-up notes", rows: 3 },
];

export function ClinicalNotesForm({ values, disabled, isSaving, error, onChange, onSave }: ClinicalNotesFormProps) {
  return (
    <form
      className="clinical-notes-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          <textarea
            name={field.key}
            rows={field.rows}
            value={values[field.key]}
            disabled={disabled || isSaving}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}
      {error ? <p className="form-error" role="alert">Unable to save clinical notes. Review the entries and try again.</p> : null}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={disabled || isSaving}>
          {isSaving ? "Saving..." : "Save Notes"}
        </button>
      </div>
    </form>
  );
}
