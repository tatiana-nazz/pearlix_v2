import { type FormEvent, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { t as shellT, useFeatureT } from "../layouts/i18n";
import { getErrorMessage } from "../utils/apiErrors";
import { Button, ConfirmDialog } from "./v2";

export function ChangePasswordForm({ onSuccess, standalone = false }: { onSuccess: () => void; standalone?: boolean }) {
  const t = useFeatureT();
  const { changePassword, logout } = useAuthStore();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dirty = Boolean(currentPassword || newPassword || confirmPassword);
  const blocker = useBlocker(() => (dirty || isSubmitting) && !success);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty || isSubmitting) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, isSubmitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) { setError(t("passwordFieldsRequired")); return; }
    if (newPassword !== confirmPassword) { setError(t("passwordMismatch")); return; }
    setIsSubmitting(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSuccess(true); onSuccess();
    } catch (reason) { setError(getErrorMessage(reason)); } finally { setIsSubmitting(false); }
  }

  return <><form className="form-stack" onSubmit={submit}>
    <label>{t("currentPassword")}<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
    <label>{t("newPassword")}<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" required /></label>
    <label>{t("confirmNewPassword")}<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required /></label>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {success ? <p role="status" className="form-success">{t("passwordChanged")}</p> : null}
    <Button type="submit" loading={isSubmitting}>{isSubmitting ? t("updatingPassword") : t("changePassword")}</Button>
    {standalone ? <Button type="button" variant="secondary" onClick={() => void logout()} disabled={isSubmitting}>{shellT(language, "logout")}</Button> : null}
  </form>
  <ConfirmDialog open={blocker.state === "blocked"} title={t("discardPasswordChanges")} description={t("discardPasswordChanges")} onClose={() => blocker.reset?.()} pending={isSubmitting}>
    <Button type="button" variant="secondary" onClick={() => blocker.reset?.()} disabled={isSubmitting}>{t("keepEditing")}</Button>
    <Button type="button" variant="danger" onClick={() => blocker.proceed?.()} disabled={isSubmitting}>{t("discard")}</Button>
  </ConfirmDialog></>;
}
