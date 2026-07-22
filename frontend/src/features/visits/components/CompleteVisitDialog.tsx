import { Button, ConfirmDialog, StatePanel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";

interface CompleteVisitDialogProps {
  patientName: string;
  hasUnsavedNotes: boolean;
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CompleteVisitDialog({ patientName, hasUnsavedNotes, isSubmitting, error, onCancel, onConfirm }: CompleteVisitDialogProps) {
  const t = useFeatureT();
  return (
    <ConfirmDialog open title={t("completeVisit")} description={`${t("completeVisitDescription")} ${patientName}`} onClose={onCancel} pending={isSubmitting}>
      <div className="visit-completion-summary">
        <span className="visit-completion-label">{t("patient")}</span>
        <strong className="bidi-isolate">{patientName}</strong>
        {hasUnsavedNotes ? <p className="form-note">{t("dirtyNotesComplete")}</p> : null}
      </div>
      {error ? <StatePanel state="error" title={t("unableToCompleteVisit")} /> : null}
      <div className="form-actions">
        <Button variant="secondary" type="button" disabled={isSubmitting} onClick={onCancel}>{t("keepVisitActive")}</Button>
        <Button type="button" loading={isSubmitting} onClick={onConfirm}>{isSubmitting ? t("completingVisit") : hasUnsavedNotes ? t("saveAndComplete") : t("completeVisit")}</Button>
      </div>
    </ConfirmDialog>
  );
}
