import { useEffect } from "react";

import { getErrorMessage } from "../../../utils/apiErrors";
import { useAuthStore } from "../../../auth/authStore";
import type { PatientDetail, PatientListItem } from "../../../types/patients";
import { patientCopy } from "../i18n";

interface ArchivePatientDialogProps {
  patient: PatientDetail | PatientListItem | null;
  mode: "archive" | "unarchive";
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchivePatientDialog({ patient, mode, isSubmitting, error, onCancel, onConfirm }: ArchivePatientDialogProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
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
        <h3 id="archive-patient-title">{isArchive ? c.archivePatient : c.unarchivePatient}</h3>
        <p>
          {isArchive
            ? c.archiveStoredDescription
            : c.reactivateDescription}
        </p>
        <p>
          {c.patientLabel}: <strong>{patient.full_name}</strong>
        </p>
        {error ? <div className="form-error">{getErrorMessage(error)}</div> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            {c.cancel}
          </button>
          <button className="button primary" type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? c.saving : isArchive ? c.archivePatient : c.unarchivePatient}
          </button>
        </div>
      </section>
    </div>
  );
}
