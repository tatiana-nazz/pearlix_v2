import type { ClinicalNotesValues } from "../utils/visitForm";
import { useAuthStore } from "../../../auth/authStore";
import { visitCopy } from "../i18n";

interface ClinicalNotesFormProps {
  values: ClinicalNotesValues;
  disabled?: boolean;
  isSaving?: boolean;
  error?: unknown;
  onChange: (field: keyof ClinicalNotesValues, value: string) => void;
  onSave: () => void;
}

export function ClinicalNotesForm({ values, disabled, isSaving, error, onChange, onSave }: ClinicalNotesFormProps) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const fields: Array<{ key: keyof ClinicalNotesValues; label: string; rows: number }> = [
    { key: "symptoms", label: c.symptoms, rows: 3 }, { key: "diagnosis", label: c.diagnosis, rows: 3 }, { key: "treatment", label: c.treatment, rows: 3 }, { key: "clinical_notes", label: c.clinicalNotesField, rows: 6 }, { key: "follow_up_notes", label: c.followUp, rows: 3 },
  ];
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
      {error ? <p className="form-error" role="alert">{c.saveError}</p> : null}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={disabled || isSaving}>
          {isSaving ? c.saving : c.saveNotes}
        </button>
      </div>
    </form>
  );
}
