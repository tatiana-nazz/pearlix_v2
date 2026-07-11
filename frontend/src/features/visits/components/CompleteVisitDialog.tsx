import { ErrorState } from "../../../components/ErrorState";

interface CompleteVisitDialogProps {
  patientName: string;
  hasUnsavedNotes: boolean;
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CompleteVisitDialog({ patientName, hasUnsavedNotes, isSubmitting, error, onCancel, onConfirm }: CompleteVisitDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="complete-visit-title">
        <div>
          <p className="eyebrow">Clinical workflow</p>
          <h3 id="complete-visit-title">Complete visit</h3>
        </div>
        <p>
          Mark the active visit for {patientName} as completed? This also completes the linked appointment.
        </p>
        {hasUnsavedNotes ? <p className="form-note">Unsaved clinical notes will be saved before the visit is completed.</p> : null}
        {error ? <ErrorState error={error} title="Unable to complete visit" /> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" disabled={isSubmitting} onClick={onCancel}>
            Keep visit active
          </button>
          <button className="button primary" type="button" disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? "Completing..." : hasUnsavedNotes ? "Save & Complete" : "Complete Visit"}
          </button>
        </div>
      </section>
    </div>
  );
}
