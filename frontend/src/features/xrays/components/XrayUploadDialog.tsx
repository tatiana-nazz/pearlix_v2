import { useId, useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { ErrorState } from "../../../components/ErrorState";
import { Button, Modal } from "../../../components/v2";
import type { XrayUploadPayload } from "../../../types/xrays";
import { xrayCopy } from "../i18n";
import { formatFileSize, validateXrayFile } from "../utils/xrayValidation";

interface XrayUploadDialogProps {
  title: string;
  isSubmitting: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (payload: XrayUploadPayload) => void;
}

export function XrayUploadDialog({ title, isSubmitting, error, onCancel, onSubmit }: XrayUploadDialogProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [notes, setNotes] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  function selectFile(nextFile: File | null) {
    const nextError = validateXrayFile(nextFile);
    setFileError(nextError);
    setFile(nextError ? null : nextFile);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextError = validateXrayFile(file);
    setFileError(nextError);
    if (file && !nextError) onSubmit({ file, title: titleValue, notes });
  }

  return (
    <Modal open title={title} description={c.supportedFiles} onClose={onCancel} pending={isSubmitting}>
      <form className="xray-upload-form" onSubmit={submit}>
        <div className="v2-field">
          <label htmlFor={inputId}>{c.imageFile}</label>
          <input id={inputId} aria-label={c.chooseFile} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} disabled={isSubmitting} />
          <span>{c.supportedFiles}</span>
          {file ? <p className="xray-selected-file" dir="ltr"><strong>{c.selectedFile}:</strong> {file.name} ({formatFileSize(file.size)})</p> : null}
          {fileError ? <p className="v2-field-error" role="alert">{fileError}</p> : null}
        </div>
        <label className="v2-field">{c.optionalTitle}<input value={titleValue} onChange={(event) => setTitleValue(event.target.value)} disabled={isSubmitting} /></label>
        <label className="v2-field">{c.description}<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSubmitting} /></label>
        {error ? <ErrorState error={error} title={c.uploadFailed} /> : null}
        <div className="xray-dialog-actions">
          <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>{c.cancel}</Button>
          <Button type="submit" loading={isSubmitting}>{isSubmitting ? c.uploading : c.upload}</Button>
        </div>
      </form>
    </Modal>
  );
}
