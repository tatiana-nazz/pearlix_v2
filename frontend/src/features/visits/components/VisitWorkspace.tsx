import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router-dom";

import { Button, ConfirmDialog, StatusBadge, SurfaceCard } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { VisitBillingSection } from "../../billing/components/VisitBillingSection";
import { VisitXraySection } from "../../xrays/components/VisitXraySection";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";
import { CompleteVisitDialog } from "./CompleteVisitDialog";

interface VisitWorkspaceProps { role: UserRole; visit: VisitDetail; }

function DetailGrid({ visit }: { visit: VisitDetail }) {
  const t = useFeatureT();
  const details = [
    [t("patient"), visit.patient.full_name],
    [t("doctor"), visit.doctor.full_name],
    [t("appointment"), formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime)],
    [t("reason"), displayText(visit.appointment.reason) || t("visitNotRecorded")],
    [t("started"), formatDateTime(visit.started_at)],
  ];
  return <dl className="detail-grid">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="bidi-isolate">{value}</dd></div>)}<div><dt>{t("status")}</dt><dd><StatusBadge status={visit.status} /></dd></div>{visit.completed_at ? <div><dt>{t("completed")}</dt><dd className="bidi-isolate">{formatDateTime(visit.completed_at)}</dd></div> : null}</dl>;
}

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  const t = useFeatureT();
  const notes: Array<[keyof ClinicalNotesValues, "symptoms" | "diagnosis" | "treatment" | "clinicalNotes" | "followUpNotes"]> = [["symptoms", "symptoms"], ["diagnosis", "diagnosis"], ["treatment", "treatment"], ["clinical_notes", "clinicalNotes"], ["follow_up_notes", "followUpNotes"]];
  return <dl className="visit-notes-readonly">{notes.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd className="bidi-isolate">{displayText(values[key]) || t("visitNotRecorded")}</dd></div>)}</dl>;
}

export function VisitWorkspace({ role, visit }: VisitWorkspaceProps) {
  const t = useFeatureT();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const permissions = useMemo(() => getVisitPermissions(role, user?.id, visit), [role, user?.id, visit]);
  const initialValues = useMemo(() => clinicalNotesValues(visit), [visit]);
  const [values, setValues] = useState<ClinicalNotesValues>(initialValues);
  const [savedValues, setSavedValues] = useState<ClinicalNotesValues>(initialValues);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const approvedNavigation = useRef(false);
  const navigatedAfterCompletion = useRef(false);
  const updateNotes = useUpdateClinicalNotes(visit.id);
  const completeVisit = useCompleteVisit(visit.id);
  const isDirty = !areClinicalNotesEqual(values, savedValues);
  const isSubmitting = updateNotes.isPending || completeVisit.isPending;
  dirtyRef.current = isDirty;
  pendingRef.current = isSubmitting;
  const blocker = useBlocker(() => !approvedNavigation.current && (dirtyRef.current || pendingRef.current));

  useEffect(() => { setValues(initialValues); setSavedValues(initialValues); setConfirmOpen(false); }, [initialValues]);
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || pendingRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  useEffect(() => { if (blocker.state === "blocked") setConfirmLeave(true); }, [blocker.state]);

  async function saveNotes() {
    try {
      const updated = await updateNotes.mutateAsync(values);
      const updatedValues = clinicalNotesValues(updated);
      setValues(updatedValues);
      setSavedValues(updatedValues);
      return updated;
    } catch { return undefined; }
  }

  async function complete() {
    if (isDirty && !await saveNotes()) return;
    try { await completeVisit.mutateAsync(); } catch { return; }
    if (navigatedAfterCompletion.current) return;
    navigatedAfterCompletion.current = true;
    approvedNavigation.current = true;
    dirtyRef.current = false;
    pendingRef.current = false;
    setConfirmOpen(false);
    navigate("/doctor/appointments/day");
  }

  function keepEditing() { if (blocker.state === "blocked") blocker.reset(); setConfirmLeave(false); }
  function discardChanges() { if (isSubmitting || blocker.state !== "blocked") return; dirtyRef.current = false; setConfirmLeave(false); blocker.proceed(); }

  return <div className="visit-workspace">
    <SurfaceCard major>
      <div className="visit-summary-header"><h3 className="bidi-isolate">{visit.patient.full_name}</h3><StatusBadge status={visit.status} /></div>
      <DetailGrid visit={visit} />
    </SurfaceCard>
    <SurfaceCard>
      <div className="section-header"><h3>{t("clinicalNotes")}</h3><p>{permissions.canEditClinicalNotes ? t("clinicalNotesDescription") : t("clinicalNotesReadOnly")}</p></div>
      {permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))} onSave={() => void saveNotes()} /> : <ReadOnlyNotes values={values} />}
    </SurfaceCard>
    <VisitXraySection role={role} visit={visit} />
    <VisitBillingSection role={role} visit={visit} />
    <div className="visit-workspace-actions"><Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{t("patientProfile")}</Link>{permissions.canCompleteVisit ? <Button type="button" onClick={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }}>{t("completeVisit")}</Button> : null}</div>
    {isConfirmOpen ? <CompleteVisitDialog patientName={visit.patient.full_name} hasUnsavedNotes={isDirty} isSubmitting={isSubmitting} error={completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined)} onCancel={() => { if (!isSubmitting) setConfirmOpen(false); }} onConfirm={() => void complete()} /> : null}
    <ConfirmDialog open={confirmLeave} title={t("discardVisitChanges")} description={t("discardVisitChanges")} onClose={keepEditing} pending={isSubmitting}>
      <Button type="button" variant="secondary" onClick={keepEditing} disabled={isSubmitting}>{t("keepEditing")}</Button>
      <Button type="button" variant="danger" onClick={discardChanges} disabled={isSubmitting || blocker.state !== "blocked"}>{t("discard")}</Button>
    </ConfirmDialog>
  </div>;
}
