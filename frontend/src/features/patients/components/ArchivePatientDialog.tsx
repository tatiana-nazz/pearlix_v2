import { useEffect } from "react";

import { getErrorMessage } from "../../../utils/apiErrors";
import type { PatientDetail, PatientListItem } from "../../../types/patients";

interface ArchivePatientDialogProps {
  patient: PatientDetail | PatientListItem | null;
  mode: "archive" | "unarchive";
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchivePatientDialog({ patient, mode, isSubmitting, error, onCancel, onConfirm }: ArchivePatientDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onCancel]);

  if (!patient) return null;
  const isArchive = mode === "archive";

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="archive-patient-title">
        <h3 id="archive-patient-title">{isArchive ? "Archive Patient" : "Unarchive Patient"}</h3>
        <p>
          {isArchive
            ? "Archived patients are hidden from active patient lists. The patient record remains stored."
            : "This patient will return to active patient lists."}
        </p>
        <p>
          Patient: <strong>{patient.full_name}</strong>
        </p>
        {error ? <div className="form-error">{getErrorMessage(error)}</div> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="button primary" type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isArchive ? "Archive Patient" : "Unarchive Patient"}
          </button>
        </div>
      </section>
    </div>
  );
}
