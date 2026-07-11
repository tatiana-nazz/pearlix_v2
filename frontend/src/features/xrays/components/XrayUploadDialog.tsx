import { useEffect, useState } from "react";

import { ErrorState } from "../../../components/ErrorState";
import type { XrayUploadPayload } from "../../../types/xrays";
import { formatFileSize, validateXrayFile } from "../utils/xrayValidation";

interface XrayUploadDialogProps { title: string; isSubmitting: boolean; error?: unknown; onCancel: () => void; onSubmit: (payload: XrayUploadPayload) => void; }

export function XrayUploadDialog({ title, isSubmitting, error, onCancel, onSubmit }: XrayUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [notes, setNotes] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function selectFile(nextFile: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextError = validateXrayFile(nextFile);
    setFileError(nextError);
    setFile(nextError ? null : nextFile);
    setPreviewUrl(!nextError && nextFile ? URL.createObjectURL(nextFile) : null);
  }
  function close() { selectFile(null); onCancel(); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextError = validateXrayFile(file);
    setFileError(nextError);
    if (file && !nextError) onSubmit({ file, title: titleValue, notes });
  }
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="xray-upload-title">
    <h3 id="xray-upload-title">{title}</h3>
    <form className="clinical-notes-form" onSubmit={submit}>
      <label>Image file<input aria-label="X-ray image file" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /></label>
      <p className="form-note">PNG, JPG, or JPEG only. Maximum size 10 MB.</p>
      {file ? <p className="form-note">{file.name} ({formatFileSize(file.size)})</p> : null}
      {previewUrl ? <img className="xray-upload-preview" src={previewUrl} alt="Selected X-ray preview" /> : null}
      {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
      <label>Title<input value={titleValue} onChange={(event) => setTitleValue(event.target.value)} /></label>
      <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error ? <ErrorState error={error} title="Unable to upload X-ray" /> : null}
      <div className="form-actions"><button className="button secondary" type="button" onClick={close}>Cancel</button><button className="button primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Uploading..." : "Upload X-ray"}</button></div>
    </form>
  </section></div>;
}
