import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { StatePanel } from "../../../components/v2";
import { StatusPill } from "../../../components/StatusPill";
import { usePatient } from "../../patients/hooks/usePatient";
import { VisitBillingSection } from "../../billing/components/VisitBillingSection";
import { VisitXraySection } from "../../xrays/components/VisitXraySection";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { visitCopy } from "../i18n";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";
import { CompleteVisitDialog } from "./CompleteVisitDialog";

interface VisitWorkspaceProps {
  role: UserRole;
  visit: VisitDetail;
  onReloadVisit?: () => Promise<unknown> | void;
}

type WorkspaceTab = "notes" | "patient" | "attachments" | "billing";

function VisitTabs({ selected, onSelect }: { selected: WorkspaceTab; onSelect: (tab: WorkspaceTab) => void }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "notes", label: c.visitNotes }, { id: "patient", label: c.patientProfile }, { id: "attachments", label: c.attachments }, { id: "billing", label: c.billing },
  ];
  return <div className="visit-workspace-tabs" role="tablist" aria-label={c.activeVisit}>{tabs.map((tab, index) => <button key={tab.id} id={`visit-tab-${tab.id}`} className={selected === tab.id ? "active" : undefined} type="button" role="tab" aria-selected={selected === tab.id} aria-controls={`visit-panel-${tab.id}`} tabIndex={selected === tab.id ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); onSelect(tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id); } }}>{tab.label}</button>)}</div>;
}

function DetailGrid({ visit }: { visit: VisitDetail }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  return <dl className="detail-grid visit-summary-grid">
    <div><dt>{c.phone}</dt><dd dir="ltr">{displayText(visit.patient.phone_number, c.notRecorded)}</dd></div>
    <div><dt>{c.age}</dt><dd>{visit.patient.age ?? c.notRecorded}</dd></div>
    <div><dt>{c.gender}</dt><dd>{visit.patient.gender ?? c.notRecorded}</dd></div>
    <div><dt>{c.doctor}</dt><dd>{visit.doctor.full_name}</dd></div>
    <div><dt>{c.appointment}</dt><dd dir="ltr">{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime)}</dd></div>
    <div><dt>{c.reason}</dt><dd>{displayText(visit.appointment.reason, c.notRecorded)}</dd></div>
    <div><dt>{c.appointmentStatus}</dt><dd><StatusPill status={visit.appointment.status} /></dd></div>
    <div><dt>{c.visitStatus}</dt><dd><StatusPill status={visit.status} /></dd></div>
    <div><dt>{c.started}</dt><dd dir="ltr">{formatDateTime(visit.started_at)}</dd></div>
    {visit.completed_at ? <div><dt>{c.completed}</dt><dd dir="ltr">{formatDateTime(visit.completed_at)}</dd></div> : null}
  </dl>;
}

function PatientProfileTab({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const patient = usePatient(visit.patient.id);
  if (patient.isLoading) return <Card><LoadingState title={c.patientProfile} /></Card>;
  if (patient.isError || !patient.data) return <Card><ErrorState error={patient.error} title={c.patientProfile} onRetry={() => void patient.refetch()} /></Card>;
  return <Card><div className="section-header"><h3>{c.patientProfile}</h3><p>{c.patientContext}</p></div><dl className="detail-grid visit-patient-grid"><div><dt>{c.phone}</dt><dd dir="ltr">{displayText(patient.data.phone_number, c.notRecorded)}</dd></div><div><dt>{c.bloodGroup}</dt><dd>{displayText(patient.data.blood_group, c.notRecorded)}</dd></div><div><dt>{c.insurance}</dt><dd>{displayText(patient.data.insurance_info, c.notRecorded)}</dd></div><div className="detail-wide"><dt>{c.medicalHistory}</dt><dd>{displayText(patient.data.medical_conditions_history, c.notRecorded)}</dd></div></dl><Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{c.openPatient}</Link></Card>;
}

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const fields: Array<[keyof ClinicalNotesValues, string]> = [["symptoms", c.symptoms], ["diagnosis", c.diagnosis], ["treatment", c.treatment], ["clinical_notes", c.clinicalNotesField], ["follow_up_notes", c.followUp]];
  return <dl className="visit-notes-readonly">{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{displayText(values[key], c.notRecorded)}</dd></div>)}</dl>;
}

export function VisitWorkspace({ role, visit, onReloadVisit }: VisitWorkspaceProps) {
  const user = useAuthStore((state) => state.user);
  const c = visitCopy(user?.language_preference);
  const permissions = useMemo(() => getVisitPermissions(role, user?.id, visit), [role, user?.id, visit]);
  const initialValues = useMemo(() => clinicalNotesValues(visit), [visit]);
  const [values, setValues] = useState<ClinicalNotesValues>(initialValues);
  const [savedValues, setSavedValues] = useState<ClinicalNotesValues>(initialValues);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("notes");
  const [saveNotice, setSaveNotice] = useState(false);
  const updateNotes = useUpdateClinicalNotes(visit.id);
  const completeVisit = useCompleteVisit(visit.id);

  useEffect(() => { setValues(initialValues); setSavedValues(initialValues); setConfirmOpen(false); setSaveNotice(false); }, [visit.id, initialValues]);
  useEffect(() => { if (!saveNotice) return undefined; const timer = window.setTimeout(() => setSaveNotice(false), 4000); return () => window.clearTimeout(timer); }, [saveNotice]);
  const isDirty = !areClinicalNotesEqual(values, savedValues);
  useEffect(() => { if (!isDirty) return undefined; const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warnBeforeUnload); return () => window.removeEventListener("beforeunload", warnBeforeUnload); }, [isDirty]);

  async function saveNotes() { const updated = await updateNotes.mutateAsync(values); const updatedValues = clinicalNotesValues(updated); setValues(updatedValues); setSavedValues(updatedValues); setSaveNotice(true); return updated; }
  async function complete() { if (isDirty) await saveNotes(); await completeVisit.mutateAsync(); setConfirmOpen(false); }
  const isCompleting = updateNotes.isPending || completeVisit.isPending;
  const completionError = completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined);
  const isConflict = (updateNotes.error as { code?: string } | null)?.code === "VERSION_CONFLICT";

  return <div className="visit-workspace">
    <Card><div className="visit-summary-header"><div><p className="eyebrow">{c.visitSummary}</p><h2>{visit.patient.full_name}</h2><p>{displayText(visit.appointment.reason, c.notRecorded)}</p></div><StatusPill status={visit.status} /></div><DetailGrid visit={visit} /></Card>
    <VisitTabs selected={selectedTab} onSelect={setSelectedTab} />
    <section id={`visit-panel-${selectedTab}`} className="visit-tab-panel" role="tabpanel" aria-labelledby={`visit-tab-${selectedTab}`} tabIndex={0}>
      {selectedTab === "notes" ? <Card><div className="section-header"><h3>{c.clinicalNotes}</h3><p>{permissions.canEditClinicalNotes ? c.notesDescription : c.notesReadOnly}</p></div>{saveNotice ? <p className="visit-save-notice" role="status">{c.notesSaved}</p> : null}{isConflict ? <StatePanel state="locked" title={c.conflictTitle} description={c.conflictDescription} action={onReloadVisit ? <button className="button secondary" type="button" onClick={() => void onReloadVisit()}>{c.refreshVisit}</button> : undefined} /> : null}{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => { setSaveNotice(false); setValues((current) => ({ ...current, [field]: value })); }} onSave={() => void saveNotes()} /> : <ReadOnlyNotes values={values} />}</Card> : null}
      {selectedTab === "patient" ? <PatientProfileTab role={role} visit={visit} /> : null}
      {selectedTab === "attachments" ? <VisitXraySection role={role} visit={visit} /> : null}
      {selectedTab === "billing" ? <VisitBillingSection role={role} visit={visit} /> : null}
    </section>
    <div className="visit-workspace-actions">{selectedTab !== "patient" ? <Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{c.openPatient}</Link> : null}{permissions.canCompleteVisit ? <div className="visit-finalize-action"><span>{c.completeDescription}</span><button className="button secondary" type="button" onClick={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }}>{c.completeVisit}</button></div> : null}</div>
    {isConfirmOpen ? <CompleteVisitDialog patientName={visit.patient.full_name} hasUnsavedNotes={isDirty} isSubmitting={isCompleting} error={completionError} onCancel={() => setConfirmOpen(false)} onConfirm={() => void complete()} /> : null}
  </div>;
}
