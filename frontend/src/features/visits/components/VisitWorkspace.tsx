import { CalendarDays, ClipboardList, Clock3, ExternalLink, FileImage, ReceiptText, Save, Stethoscope, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { StatePanel } from "../../../components/v2";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { VisitBillingSection } from "../../billing/components/VisitBillingSection";
import { usePatient } from "../../patients/hooks/usePatient";
import { ActiveVisitXrayWorkspace } from "../../xrays/components/ActiveVisitXrayWorkspace";
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
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof ClipboardList }> = [
    { id: "notes", label: c.visitNotes, icon: ClipboardList },
    { id: "patient", label: c.patientProfile, icon: UserRound },
    { id: "attachments", label: c.attachments, icon: FileImage },
    { id: "billing", label: c.billing, icon: ReceiptText },
  ];
  return <div className="visit-workspace-tabs" role="tablist" aria-label={c.activeVisit}>{tabs.map((tab, index) => {
    const Icon = tab.icon;
    return <button key={tab.id} id={`visit-tab-${tab.id}`} className={selected === tab.id ? "active" : undefined} type="button" role="tab" aria-selected={selected === tab.id} aria-controls={`visit-panel-${tab.id}`} tabIndex={selected === tab.id ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={(event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget.parentElement ?? event.currentTarget).direction === "rtl";
    const visualForward = event.key === "ArrowRight" ? 1 : -1;
    const delta = rtl ? -visualForward : visualForward;
    const next = (index + delta + tabs.length) % tabs.length;
    const tablist = event.currentTarget.parentElement;
    onSelect(tabs[next].id);
    window.requestAnimationFrame(() => tablist?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus());
  }}><Icon size={18} aria-hidden="true" /><span>{tab.label}</span></button>;
  })}</div>;
}

function PatientAndVisitSummary({
  role,
  visit,
  isDirty,
  canSave,
  isSaving,
  canComplete,
  onSave,
  onComplete,
}: {
  role: UserRole;
  visit: VisitDetail;
  isDirty: boolean;
  canSave: boolean;
  isSaving: boolean;
  canComplete: boolean;
  onSave: () => void;
  onComplete: () => void;
}) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const initials = `${visit.patient.first_name.slice(0, 1)}${visit.patient.last_name.slice(0, 1)}`.toUpperCase();
  const profilePath = `/${role.toLowerCase()}/patients/${visit.patient.id}`;
  const guardProfile = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDirty && !window.confirm(c.unsavedProfileConfirm)) event.preventDefault();
  };
  return <section className="active-visit-summary" aria-labelledby="active-visit-patient-name">
    <div className="active-visit-identity">
      <span className="active-visit-avatar" aria-hidden="true">{initials}</span>
      <div><h2 id="active-visit-patient-name">{visit.patient.full_name}</h2><p>{visit.patient.age ? `${visit.patient.age} ${c.yearsOld}` : c.notRecorded} · {displayText(visit.patient.gender, c.notRecorded)}</p><p dir="ltr">{displayText(visit.patient.phone_number, c.notRecorded)}</p></div>
    </div>
    <dl className="active-visit-summary-list active-visit-appointment-list">
      <div><dt><CalendarDays size={17} aria-hidden="true" />{c.appointment}</dt><dd className="active-visit-appointment" dir="ltr"><span>{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime) || c.notRecorded}</span><StatusPill status={visit.appointment.status} /></dd></div>
      <div><dt><Clock3 size={17} aria-hidden="true" />{c.visitStatus}</dt><dd><StatusPill status={visit.status} /></dd></div>
    </dl>
    <dl className="active-visit-summary-list active-visit-audit-list">
      <div><dt><Clock3 size={17} aria-hidden="true" />{c.created}</dt><dd dir="ltr">{formatDateTime(visit.created_at) || c.notRecorded}</dd></div>
      <div><dt><Clock3 size={17} aria-hidden="true" />{c.updated}</dt><dd dir="ltr">{formatDateTime(visit.updated_at) || c.notRecorded}</dd></div>
      <div><dt><Stethoscope size={17} aria-hidden="true" />{c.doctor}</dt><dd>{displayText(visit.doctor.full_name, c.notRecorded)}</dd></div>
    </dl>
    <div className="active-visit-summary-actions">
      <Link className="button secondary" to={profilePath} onClick={guardProfile}><ExternalLink size={17} aria-hidden="true" />{c.openPatient}</Link>
      {canSave || canComplete ? <div className="active-visit-clinical-actions">
        {canSave ? <button className={`button ${isDirty ? "primary" : "secondary"}`} type="button" disabled={!isDirty || isSaving} aria-busy={isSaving || undefined} onClick={onSave}><Save size={17} aria-hidden="true" />{isSaving ? c.saving : c.saveNotes}</button> : null}
        {canComplete ? <button className="button active-visit-complete" type="button" onClick={onComplete}>{c.completeVisit}</button> : null}
      </div> : null}
    </div>
  </section>;
}

function PatientProfileTab({ role, visit, isDirty }: { role: UserRole; visit: VisitDetail; isDirty: boolean }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const patient = usePatient(visit.patient.id);
  if (patient.isLoading) return <Card><LoadingState title={c.patientProfile} /></Card>;
  if (patient.isError || !patient.data) return <Card><ErrorState error={patient.error} title={c.patientProfile} onRetry={() => void patient.refetch()} /></Card>;
  const openProfile = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDirty && !window.confirm(c.unsavedProfileConfirm)) event.preventDefault();
  };
  return <Card><div className="section-header"><h3><UserRound size={20} aria-hidden="true" />{c.patientProfile}</h3><p>{c.patientContext}</p></div><dl className="detail-grid visit-patient-grid">
    <div><dt>{c.phone}</dt><dd dir="ltr">{displayText(patient.data.phone_number, c.notRecorded)}</dd></div>
    <div><dt>{c.email}</dt><dd dir="ltr">{displayText(patient.data.email, c.notRecorded)}</dd></div>
    <div><dt>{c.age}</dt><dd>{patient.data.age ?? c.notRecorded}</dd></div>
    <div><dt>{c.gender}</dt><dd>{displayText(patient.data.gender, c.notRecorded)}</dd></div>
    <div><dt>{c.bloodGroup}</dt><dd>{displayText(patient.data.blood_group, c.notRecorded)}</dd></div>
    <div><dt>{c.emergencyContact}</dt><dd>{displayText(patient.data.emergency_contact, c.notRecorded)}</dd></div>
    <div className="detail-wide"><dt>{c.medicalHistory}</dt><dd>{displayText(patient.data.medical_conditions_history, c.notRecorded)}</dd></div>
    <div className="detail-wide"><dt>{c.insurance}</dt><dd>{displayText(patient.data.insurance_info, c.notRecorded)}</dd></div>
    <div className="detail-wide"><dt>{c.generalNotes}</dt><dd>{displayText(patient.data.general_notes, c.notRecorded)}</dd></div>
  </dl><Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`} onClick={openProfile}>{c.openPatient}</Link></Card>;
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

  useEffect(() => { setValues(initialValues); setSavedValues(initialValues); setConfirmOpen(false); }, [visit.id, initialValues]);
  useEffect(() => { if (!saveNotice) return undefined; const timer = window.setTimeout(() => setSaveNotice(false), 4000); return () => window.clearTimeout(timer); }, [saveNotice]);
  const isDirty = !areClinicalNotesEqual(values, savedValues);
  useEffect(() => { if (!isDirty) return undefined; const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warnBeforeUnload); return () => window.removeEventListener("beforeunload", warnBeforeUnload); }, [isDirty]);

  async function saveNotes() { const updated = await updateNotes.mutateAsync(values); const updatedValues = clinicalNotesValues(updated); setValues(updatedValues); setSavedValues(updatedValues); setSaveNotice(true); return updated; }
  async function complete() { if (isDirty) await saveNotes(); await completeVisit.mutateAsync(); setConfirmOpen(false); }
  const isCompleting = updateNotes.isPending || completeVisit.isPending;
  const completionError = completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined);
  const isConflict = (updateNotes.error as { code?: string } | null)?.code === "VERSION_CONFLICT";

  return <div className="visit-workspace">
    <div className="active-visit-context-stack">
      <PatientAndVisitSummary role={role} visit={visit} isDirty={isDirty} canSave={permissions.canEditClinicalNotes} isSaving={updateNotes.isPending} canComplete={permissions.canCompleteVisit} onSave={() => void saveNotes()} onComplete={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }} />
      <VisitTabs selected={selectedTab} onSelect={setSelectedTab} />
    </div>
    <section id={`visit-panel-${selectedTab}`} className="visit-tab-panel" role="tabpanel" aria-labelledby={`visit-tab-${selectedTab}`} tabIndex={0}>
      {selectedTab === "notes" ? <Card><div className="section-header"><h3>{c.clinicalNotes}</h3><p>{permissions.canEditClinicalNotes ? c.notesDescription : c.notesReadOnly}</p></div>{saveNotice ? <p className="visit-save-notice" role="status">{c.notesSaved}</p> : null}{isConflict ? <StatePanel state="locked" title={c.conflictTitle} description={c.conflictDescription} action={onReloadVisit ? <button className="button secondary" type="button" onClick={() => void onReloadVisit()}>{c.refreshVisit}</button> : undefined} /> : null}{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isDirty={isDirty} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => { setSaveNotice(false); setValues((current) => ({ ...current, [field]: value })); }} onSave={() => void saveNotes()} /> : <ReadOnlyNotes values={values} />}</Card> : null}
      {selectedTab === "patient" ? <PatientProfileTab role={role} visit={visit} isDirty={isDirty} /> : null}
      {selectedTab === "attachments" ? <ActiveVisitXrayWorkspace role={role} visit={visit} /> : null}
      {selectedTab === "billing" ? <VisitBillingSection role={role} visit={visit} /> : null}
    </section>
    {isConfirmOpen ? <CompleteVisitDialog patientName={visit.patient.full_name} hasUnsavedNotes={isDirty} isSubmitting={isCompleting} error={completionError} onCancel={() => setConfirmOpen(false)} onConfirm={() => void complete()} /> : null}
  </div>;
}
