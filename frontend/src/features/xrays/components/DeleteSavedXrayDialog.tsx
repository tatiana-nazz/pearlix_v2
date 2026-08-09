import { useAuthStore } from "../../../auth/authStore";
import { ErrorState } from "../../../components/ErrorState";
import { Button, ConfirmDialog } from "../../../components/v2";
import type { XrayAttachment } from "../../../types/xrays";
import { xrayCopy } from "../i18n";
import { xrayText } from "../utils/xrayPresentation";

interface DeleteSavedXrayDialogProps {
  xray: XrayAttachment | null;
  error?: unknown;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSavedXrayDialog({ xray, error, isSubmitting, onCancel, onConfirm }: DeleteSavedXrayDialogProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  if (!xray) return null;
  const label = xrayText(xray.title || xray.original_file_name);
  return <ConfirmDialog open title={c.deleteSavedXray} description={c.deleteSavedXrayDescription} onClose={onCancel} pending={isSubmitting}>
    <p><strong>{label}</strong> <span dir="ltr">({xray.original_file_name})</span></p>
    {error ? <ErrorState error={error} title={c.deleteSavedXrayFailed} /> : null}
    <div className="xray-dialog-actions">
      <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>{c.keepSavedXray}</Button>
      <Button variant="danger" type="button" loading={isSubmitting} onClick={onConfirm}>{isSubmitting ? c.deletingSavedXray : c.deleteSavedXray}</Button>
    </div>
  </ConfirmDialog>;
}
