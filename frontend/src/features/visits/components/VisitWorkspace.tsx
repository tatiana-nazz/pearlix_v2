import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router-dom";

import { patientsApi } from "../../../api/endpoints/patients";
import { Button, ClickableRow, ConfirmDialog, DataTableShell, StatusBadge, SurfaceCard } from "../../../components/v2";
import { WorkspaceTabs } from "../../../components/WorkspaceTabs";
import { useAuthStore } from "../../../auth/authStore";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { getErrorMessage } from "../../../utils/apiErrors";
import { displayText } from "../../../utils/formatters";
import { VisitBillingSection } from "../../billing/components/VisitBillingSection";
import { VisitXraySection } from "../../xrays/components/VisitXraySection";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";
import { CompleteVisitDialog } from "./CompleteVisitDialog";

interface VisitWorkspaceProps { role: UserRole; visit: VisitDetail; }

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  const t = useFeatureT();
  const notes: Array<[keyof ClinicalNotesValues, "symptoms" | "diagnosis" | "treatment" | "clinicalNotes" | "followUpNotes"]> = [["symptoms", "symptoms"], ["diagnosis", "diagnosis"], ["treatment", "treatment"], ["clinical_notes", "clinicalNotes"], ["follow_up_notes", "followUpNotes"]];
  return <dl className="visit-notes-readonly">{notes.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd className="bidi-isolate">{displayText(values[key]) || t("visitNotRecorded")}</dd></div>)}</dl>;
}

function VisitHistory({ role, visit }: VisitWorkspaceProps) {
  const t = useFeatureT(); const navigate = useNavigate();
  const history = useQuery({ queryKey: ["patient", visit.patient.id, "visits", "visit-history"], queryFn: () => patientsApi.visits(visit.patient.id, { page: 1 }), staleTime: 30_000 });
  if (history.isLoading) return <SurfaceCard><p role="status">{t("loadingVisits")}</p></SurfaceCard>;
  if (history.isError) return <SurfaceCard><p role="alert">{t("unableToLoadVisits")}: {getErrorMessage(history.error)}</p><Button type="button" variant="secondary" onClick={() => void history.refetch()}>{t("retry")}</Button></SurfaceCard>;
  const rows = (history.data?.results ?? []).filter((item) => item.id !== visit.id);
  return <SurfaceCard>{!rows.length ? <p>{t("noVisitsRecorded")}</p> : <DataTableShell title={t("history")} count={history.data?.count ?? rows.length}><table><thead><tr><th>{t("date")}</th><th>{t("doctor")}</th><th>{t("status")}</th><th>{t("diagnosis")}</th><th>{t("treatment")}</th></tr></thead><tbody>{rows.map((item) => <ClickableRow key={item.id} onOpen={() => navigate(`/${role.toLowerCase()}/visits/${item.id}`)}><td className="bidi-isolate">{formatDateTime(item.started_at ?? item.created_at)}</td><td><bdi>{item.doctor.full_name}</bdi></td><td><StatusBadge status={item.status} /></td><td className="bidi-isolate">{displayText(item.diagnosis) || t("visitNotRecorded")}</td><td className="bidi-isolate">{displayText(item.treatment) || t("visitNotRecorded")}</td></ClickableRow>)}</tbody></table></DataTableShell>}</SurfaceCard>;
}

function AppointmentInfo({ role, visit }: VisitWorkspaceProps) {
  const t = useFeatureT();
  return <><SurfaceCard major><dl className="detail-grid"><div><dt>{t("patient")}</dt><dd><Link className="bidi-isolate" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{visit.patient.full_name}</Link></dd></div><div><dt>{t("doctor")}</dt><dd className="bidi-isolate">{visit.doctor.full_name}</dd></div><div><dt>{t("appointment")}</dt><dd className="bidi-isolate">{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime)}</dd></div><div><dt>{t("duration")}</dt><dd>{visit.appointment.duration_minutes} {t("minutes")}</dd></div><div><dt>{t("reason")}</dt><dd className="bidi-isolate">{displayText(visit.appointment.reason) || t("visitNotRecorded")}</dd></div><div><dt>{t("status")}</dt><dd><StatusBadge status={visit.status} /></dd></div><div><dt>{t("started")}</dt><dd className="bidi-isolate">{formatDateTime(visit.started_at)}</dd></div>{visit.completed_at ? <div><dt>{t("completed")}</dt><dd className="bidi-isolate">{formatDateTime(visit.completed_at)}</dd></div> : null}</dl></SurfaceCard><VisitBillingSection role={role} visit={visit} /></>;
}

export function VisitWorkspace({ role, visit }: VisitWorkspaceProps) {
  const t = useFeatureT(); const navigate = useNavigate(); const [params] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const permissions = useMemo(() => getVisitPermissions(role, user?.id, visit), [role, user?.id, visit]);
  const initialValues = useMemo(() => clinicalNotesValues(visit), [visit]);
  const [values, setValues] = useState<ClinicalNotesValues>(initialValues); const [savedValues, setSavedValues] = useState<ClinicalNotesValues>(initialValues);
  const [isConfirmOpen, setConfirmOpen] = useState(false); const [confirmLeave, setConfirmLeave] = useState(false);
  const dirtyRef = useRef(false); const pendingRef = useRef(false); const approvedNavigation = useRef(false); const navigatedAfterCompletion = useRef(false);
  const updateNotes = useUpdateClinicalNotes(visit.id); const completeVisit = useCompleteVisit(visit.id);
  const isDirty = !areClinicalNotesEqual(values, savedValues); const isSubmitting = updateNotes.isPending || completeVisit.isPending;
  dirtyRef.current = isDirty; pendingRef.current = isSubmitting;
  const blocker = useBlocker(() => !approvedNavigation.current && (dirtyRef.current || pendingRef.current));
  const tabs = [{ id: "notes", label: t("notes") }, { id: "history", label: t("history") }, { id: "xrays", label: t("xraysAi") }, { id: "appointment", label: t("appointmentInfo") }];
  const selected = tabs.some((item) => item.id === params.get("tab")) ? params.get("tab")! : "notes";
  useEffect(() => { setValues(initialValues); setSavedValues(initialValues); setConfirmOpen(false); }, [initialValues]);
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current || pendingRef.current) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, []);
  useEffect(() => { if (blocker.state === "blocked") setConfirmLeave(true); }, [blocker.state]);
  async function saveNotes() { try { const updated = await updateNotes.mutateAsync(values); const updatedValues = clinicalNotesValues(updated); setValues(updatedValues); setSavedValues(updatedValues); return updated; } catch { return undefined; } }
  async function complete() { if (isDirty && !await saveNotes()) return; try { await completeVisit.mutateAsync(); } catch { return; } if (navigatedAfterCompletion.current) return; navigatedAfterCompletion.current = true; approvedNavigation.current = true; dirtyRef.current = false; pendingRef.current = false; setConfirmOpen(false); navigate("/doctor/appointments/day"); }
  function keepEditing() { if (blocker.state === "blocked") blocker.reset(); setConfirmLeave(false); }
  function discardChanges() { if (isSubmitting || blocker.state !== "blocked") return; dirtyRef.current = false; setConfirmLeave(false); blocker.proceed(); }
  return <div className="visit-workspace"><SurfaceCard major><div className="visit-summary-header"><h3 className="bidi-isolate">{visit.patient.full_name}</h3><StatusBadge status={visit.status} /></div><dl className="visit-context"><div><dt>{t("doctor")}</dt><dd className="bidi-isolate">{visit.doctor.full_name}</dd></div><div><dt>{t("started")}</dt><dd className="bidi-isolate">{formatDateTime(visit.started_at)}</dd></div>{visit.completed_at ? <div><dt>{t("completed")}</dt><dd className="bidi-isolate">{formatDateTime(visit.completed_at)}</dd></div> : null}</dl></SurfaceCard>
    <WorkspaceTabs tabs={tabs} defaultTab="notes" ariaLabel={t("visitTabs")} />
    {selected === "notes" ? <SurfaceCard>{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))} onSave={() => void saveNotes()} /> : <ReadOnlyNotes values={values} />}</SurfaceCard> : null}
    {selected === "history" ? <VisitHistory role={role} visit={visit} /> : null}{selected === "xrays" ? <VisitXraySection role={role} visit={visit} /> : null}{selected === "appointment" ? <AppointmentInfo role={role} visit={visit} /> : null}
    <div className="visit-workspace-actions"><Link className="v2-button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{t("patientProfile")}</Link>{permissions.canCompleteVisit ? <Button type="button" onClick={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }}>{t("completeVisit")}</Button> : null}</div>
    {isConfirmOpen ? <CompleteVisitDialog patientName={visit.patient.full_name} hasUnsavedNotes={isDirty} isSubmitting={isSubmitting} error={completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined)} onCancel={() => { if (!isSubmitting) setConfirmOpen(false); }} onConfirm={() => void complete()} /> : null}<ConfirmDialog open={confirmLeave} title={t("discardVisitChanges")} description={t("discardVisitChanges")} onClose={keepEditing} pending={isSubmitting}><Button type="button" variant="secondary" onClick={keepEditing} disabled={isSubmitting}>{t("keepEditing")}</Button><Button type="button" variant="danger" onClick={discardChanges} disabled={isSubmitting || blocker.state !== "blocked"}>{t("discard")}</Button></ConfirmDialog>
  </div>;
}
