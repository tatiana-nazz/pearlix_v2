import { useEffect, useMemo, useState } from "react";

import { Button, Modal } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { XrayUploadPayload } from "../../../types/xrays";
import { formatFileSize, validateXrayFile } from "../utils/xrayValidation";

interface XrayUploadDialogProps { title: string; isSubmitting: boolean; error?: unknown; onCancel: () => void; onSubmit: (payload: XrayUploadPayload) => void; }

export function XrayUploadDialog({ title, isSubmitting, error, onCancel, onSubmit }: XrayUploadDialogProps) {
  const t = useFeatureT();
  const [file, setFile] = useState<File | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [notes, setNotes] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  const dirty = Boolean(file || titleValue || notes);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function selectFile(nextFile: File | null) {
    const nextError = validateXrayFile(nextFile);
    setFileError(nextError);
    setFile(nextError ? null : nextFile);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextError = validateXrayFile(file);
    setFileError(nextError);
    if (file && !nextError && !isSubmitting) onSubmit({ file, title: titleValue, notes });
  }
  return <Modal open title={title} onClose={onCancel} pending={isSubmitting} dirty={dirty} wide>
    <form className="clinical-notes-form" onSubmit={submit}>
      <label>{t("xrayImageFile")}<input aria-label={t("xrayImageFile")} type="file" disabled={isSubmitting} accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /></label>
      <p className="form-note">{t("fileHelp")}</p>
      {file ? <p className="form-note bidi-isolate">{t("selectedFile")}: {file.name} ({formatFileSize(file.size)})</p> : null}
      {previewUrl ? <img className="xray-upload-preview" src={previewUrl} alt={t("xrayImageFile")} /> : null}
      {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
      <label>{t("title")}<input value={titleValue} disabled={isSubmitting} onChange={(event) => setTitleValue(event.target.value)} /></label>
      <label>{t("notes")}<textarea rows={3} disabled={isSubmitting} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error ? <p className="form-error" role="alert">{t("uploadUnavailable")}</p> : null}
      <div className="form-actions"><Button variant="secondary" type="button" disabled={isSubmitting} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={isSubmitting}>{isSubmitting ? t("uploading") : t("upload")}</Button></div>
    </form>
  </Modal>;
}
