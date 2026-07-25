import { ErrorState } from "../../../components/ErrorState";
import { Modal } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { visitCopy } from "../i18n";

interface CompleteVisitDialogProps {
  patientName: string;
  hasUnsavedNotes: boolean;
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CompleteVisitDialog({ patientName, hasUnsavedNotes, isSubmitting, error, onCancel, onConfirm }: CompleteVisitDialogProps) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  return (
    <Modal open title={c.completeConfirm} onClose={onCancel} pending={isSubmitting}>
        <div>
          <p className="eyebrow">{c.workflow}</p>
          <h3>{c.completeConfirm}</h3>
        </div>
        <p>
          {c.completeQuestion.replace("{patient}", patientName)}
        </p>
        {hasUnsavedNotes ? <p className="form-note">{c.unsaved}</p> : null}
        {error ? <ErrorState error={error} title={c.completeError} /> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" disabled={isSubmitting} onClick={onCancel}>
            {c.keepActive}
          </button>
          <button className="button primary" type="button" disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? c.completing : hasUnsavedNotes ? c.saveAndComplete : c.completeVisit}
          </button>
        </div>
    </Modal>
  );
}
