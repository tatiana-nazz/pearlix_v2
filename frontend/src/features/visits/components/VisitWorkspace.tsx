import { CalendarDays, ClipboardList, Clock3, ExternalLink, FileImage, HeartPulse, Mail, Phone, ReceiptText, Save, Stethoscope, UserRound } from "lucide-react";
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
import { PatientAppointmentsSummary } from "../../patients/components/PatientAppointmentsSummary";
import { PatientVisitsSummary } from "../../patients/components/PatientVisitsSummary";
import { usePatient, usePatientAppointments, usePatientVisits } from "../../patients/hooks/usePatient";
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
}: {
  role: UserRole;
  visit: VisitDetail;
  isDirty: boolean;
}) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const patient = usePatient(visit.patient.id);
  const detail = patient.data;
  const initials = `${visit.patient.first_name.slice(0, 1)}${visit.patient.last_name.slice(0, 1)}`.toUpperCase();
  const profilePath = `/${role.toLowerCase()}/patients/${visit.patient.id}`;
  const guardProfile = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDirty && !window.confirm(c.unsavedProfileConfirm)) event.preventDefault();
  };
  const medicalConditions = detail?.medical_conditions_history.trim();
  return <section className="active-visit-summary" aria-labelledby="active-visit-patient-name">
    <div className="active-visit-summary-section active-visit-identity">
      <span className="active-visit-avatar" aria-hidden="true">{initials}</span>
      <div><p className="active-visit-summary-kicker">{c.patient}</p><h2 id="active-visit-patient-name">{visit.patient.full_name}</h2><p>{displayText(visit.patient.gender, c.notRecorded)} · {visit.patient.age ? `${visit.patient.age} ${c.yearsOld}` : c.notRecorded}</p></div>
    </div>
    <div className="active-visit-summary-section active-visit-contact">
      <p className="active-visit-summary-kicker">{c.contact}</p>
      <dl className="active-visit-summary-list">
        <div><dt><Phone size={16} aria-hidden="true" />{c.phone}</dt><dd dir="ltr">{displayText(detail?.phone_number ?? visit.patient.phone_number, c.notRecorded)}</dd></div>
        <div><dt><Mail size={16} aria-hidden="true" />{c.email}</dt><dd dir="ltr">{displayText(detail?.email ?? visit.patient.email, c.notRecorded)}</dd></div>
        <div><dt>{c.emergencyContact}</dt><dd>{displayText(detail?.emergency_contact, c.notRecorded)}</dd></div>
      </dl>
    </div>
    <div className="active-visit-summary-section active-visit-visit-context">
      <p className="active-visit-summary-kicker">{c.appointmentContext}</p>
      <dl className="active-visit-summary-list">
        <div><dt><CalendarDays size={16} aria-hidden="true" />{c.appointment}</dt><dd dir="ltr">{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime) || c.notRecorded}</dd></div>
        <div><dt><Stethoscope size={16} aria-hidden="true" />{c.doctor}</dt><dd>{displayText(visit.doctor.full_name, c.notRecorded)}</dd></div>
        <div><dt>{c.reason}</dt><dd>{displayText(visit.appointment.reason, c.notRecorded)}</dd></div>
        <div className="active-visit-status-pair"><dt>{c.status}</dt><dd><StatusPill status={visit.appointment.status} /><StatusPill status={visit.status} /></dd></div>
        <div><dt><Clock3 size={16} aria-hidden="true" />{c.started}</dt><dd dir="ltr">{formatDateTime(visit.started_at) || c.notRecorded}</dd></div>
      </dl>
    </div>
    <div className={`active-visit-summary-section active-visit-medical-alert${medicalConditions ? " has-alert" : ""}`}>
      <div><p className="active-visit-summary-kicker"><HeartPulse size={17} aria-hidden="true" />{c.medicalHistory}</p><p>{medicalConditions || c.noMedicalConditions}</p></div>
      <Link className="button secondary" to={profilePath} onClick={guardProfile}><ExternalLink size={17} aria-hidden="true" />{c.openPatient}</Link>
    </div>
  </section>;
}

function PatientProfileTab({ role, visit, isDirty }: { role: UserRole; visit: VisitDetail; isDirty: boolean }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const patient = usePatient(visit.patient.id);
  const visits = usePatientVisits(visit.patient.id);
  const appointments = usePatientAppointments(visit.patient.id);
  if (patient.isLoading) return <Card><LoadingState title={c.patientProfile} /></Card>;
  if (patient.isError || !patient.data) return <Card><ErrorState error={patient.error} title={c.patientProfile} onRetry={() => void patient.refetch()} /></Card>;
  const openProfile = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDirty && !window.confirm(c.unsavedProfileConfirm)) event.preventDefault();
  };
  return <div className="active-visit-patient-tab">
    <Card className="active-visit-patient-general"><div className="section-header"><h3><UserRound size={20} aria-hidden="true" />{c.patientProfile}</h3><p>{c.patientContext}</p></div><dl className="detail-grid visit-patient-grid">
      <div><dt>{c.patient}</dt><dd>{patient.data.full_name}</dd></div>
      <div><dt>{c.dateOfBirth}</dt><dd dir="ltr">{displayText(patient.data.date_of_birth, c.notRecorded)}</dd></div>
      <div><dt>{c.age}</dt><dd>{patient.data.age ?? c.notRecorded}</dd></div>
      <div><dt>{c.gender}</dt><dd>{displayText(patient.data.gender, c.notRecorded)}</dd></div>
      <div><dt>{c.phone}</dt><dd dir="ltr">{displayText(patient.data.phone_number, c.notRecorded)}</dd></div>
      <div><dt>{c.email}</dt><dd dir="ltr">{displayText(patient.data.email, c.notRecorded)}</dd></div>
      <div><dt>{c.address}</dt><dd>{displayText(patient.data.address, c.notRecorded)}</dd></div>
      <div><dt>{c.nationalId}</dt><dd>{displayText(patient.data.national_id_or_passport, c.notRecorded)}</dd></div>
      <div><dt>{c.bloodGroup}</dt><dd>{displayText(patient.data.blood_group, c.notRecorded)}</dd></div>
      <div><dt>{c.insurance}</dt><dd>{displayText(patient.data.insurance_info, c.notRecorded)}</dd></div>
      <div className="detail-wide"><dt>{c.emergencyContact}</dt><dd>{displayText(patient.data.emergency_contact, c.notRecorded)}</dd></div>
    </dl></Card>
    <Card className="active-visit-medical-history"><div className="section-header"><h3><HeartPulse size={20} aria-hidden="true" />{c.medicalHistory}</h3></div><p>{patient.data.medical_conditions_history || c.noMedicalConditions}</p></Card>
    <PatientVisitsSummary role={role} visits={visits.data} isLoading={visits.isLoading} error={visits.error} onRetry={() => void visits.refetch()} title={c.pastVisits} />
    <PatientAppointmentsSummary role={role} appointments={appointments.data} isLoading={appointments.isLoading} error={appointments.error} onRetry={() => void appointments.refetch()} title={c.upcomingAppointments} />
    <div className="active-visit-patient-footer"><Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`} onClick={openProfile}><ExternalLink size={17} aria-hidden="true" />{c.openPatient}</Link></div>
  </div>;
}

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const fields: Array<[keyof ClinicalNotesValues, string]> = [["symptoms", c.subjectiveNotes], ["clinical_notes", c.objectiveNotes], ["diagnosis", c.assessment], ["treatment", c.plan], ["follow_up_notes", c.generalNotes]];
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
  const saveStatus = isDirty ? c.notesUnsaved : saveNotice ? c.notesSaved : c.notesUpToDate;

  return <div className="visit-workspace">
    <div className="active-visit-context-stack">
      <PatientAndVisitSummary role={role} visit={visit} isDirty={isDirty} />
      <VisitTabs selected={selectedTab} onSelect={setSelectedTab} />
    </div>
    <section id={`visit-panel-${selectedTab}`} className="visit-tab-panel" role="tabpanel" aria-labelledby={`visit-tab-${selectedTab}`} tabIndex={0}>
      {selectedTab === "notes" ? <Card className="active-visit-notes-card"><div className="section-header"><h3>{c.clinicalNotes}</h3><p>{permissions.canEditClinicalNotes ? c.notesDescription : c.notesReadOnly}</p></div>{isConflict ? <StatePanel state="locked" title={c.conflictTitle} description={c.conflictDescription} action={onReloadVisit ? <button className="button secondary" type="button" onClick={() => void onReloadVisit()}>{c.refreshVisit}</button> : undefined} /> : null}{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => { setSaveNotice(false); setValues((current) => ({ ...current, [field]: value })); }} /> : <ReadOnlyNotes values={values} />}</Card> : null}
      {selectedTab === "patient" ? <PatientProfileTab role={role} visit={visit} isDirty={isDirty} /> : null}
      {selectedTab === "attachments" ? <ActiveVisitXrayWorkspace role={role} visit={visit} /> : null}
      {selectedTab === "billing" ? <VisitBillingSection role={role} visit={visit} /> : null}
    </section>
    {permissions.canEditClinicalNotes || permissions.canCompleteVisit ? <footer className="active-visit-action-bar">
      <p className={`active-visit-save-state${isDirty ? " is-dirty" : ""}`} role="status" aria-live="polite"><span aria-hidden="true" />{saveStatus}</p>
      <div className="active-visit-action-buttons">
        {permissions.canEditClinicalNotes ? <button className={`button ${isDirty ? "primary" : "secondary"}`} type="button" disabled={!isDirty || updateNotes.isPending} aria-busy={updateNotes.isPending || undefined} onClick={() => void saveNotes()}><Save size={17} aria-hidden="true" />{updateNotes.isPending ? c.saving : c.saveNotes}</button> : null}
        {permissions.canCompleteVisit ? <button className="button active-visit-complete" type="button" disabled={isCompleting} onClick={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }}>{c.completeVisit}</button> : null}
      </div>
    </footer> : null}
    {isConfirmOpen ? <CompleteVisitDialog patientName={visit.patient.full_name} hasUnsavedNotes={isDirty} isSubmitting={isCompleting} error={completionError} onCancel={() => setConfirmOpen(false)} onConfirm={() => void complete()} /> : null}
  </div>;
}
