import { CalendarDays, ClipboardList, Clock3, FileImage, Mail, Phone, ReceiptText, Save, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { Modal, StatePanel } from "../../../components/v2";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { Currency } from "../../../types/clinic";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { VisitBillingSection, type VisitBillingDraft, type VisitBillingErrors } from "../../billing/components/VisitBillingSection";
import { usePatient } from "../../patients/hooks/usePatient";
import { ActiveVisitXrayWorkspace } from "../../xrays/components/ActiveVisitXrayWorkspace";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { visitCopy } from "../i18n";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";

interface VisitWorkspaceProps {
  role: UserRole;
  visit: VisitDetail;
  onReloadVisit?: () => Promise<unknown> | void;
}

type WorkspaceTab = "notes" | "attachments" | "billing";
const emptyBillingDraft: VisitBillingDraft = { description: "", amount: "", currency: "", note: "" };

function VisitTabs({ selected, onSelect }: { selected: WorkspaceTab; onSelect: (tab: WorkspaceTab) => void }) {
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof ClipboardList }> = [
    { id: "notes", label: c.visitNotes, icon: ClipboardList },
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
  return <section className="active-visit-summary" aria-labelledby="active-visit-patient-name">
    <Link className="active-visit-summary-section active-visit-identity" to={profilePath} aria-label={c.openPatientProfile.replace("{patient}", visit.patient.full_name)} onClick={guardProfile} onKeyDown={(event) => {
      if (event.key !== " ") return;
      event.preventDefault();
      event.currentTarget.click();
    }}>
      <span className="active-visit-avatar" aria-hidden="true">{initials}</span>
      <div><p className="active-visit-summary-kicker">{c.patient}</p><h2 id="active-visit-patient-name">{visit.patient.full_name}</h2><p>{displayText(visit.patient.gender, c.notRecorded)} · {visit.patient.age ? `${visit.patient.age} ${c.yearsOld}` : c.notRecorded}</p></div>
    </Link>
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
  </section>;
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
  const [billingDraft, setBillingDraft] = useState<VisitBillingDraft>(emptyBillingDraft);
  const [billingErrors, setBillingErrors] = useState<VisitBillingErrors>({});
  const [completionResult, setCompletionResult] = useState<{ amount: string; currency: Currency; invoiceNumber: string; invoiceStatus: string } | null>(null);
  const updateNotes = useUpdateClinicalNotes(visit.id);
  const completeVisit = useCompleteVisit(visit.id);

  useEffect(() => { setValues(initialValues); setSavedValues(initialValues); setBillingDraft(emptyBillingDraft); setBillingErrors({}); setCompletionResult(null); setConfirmOpen(false); }, [visit.id, initialValues]);
  useEffect(() => { if (!saveNotice) return undefined; const timer = window.setTimeout(() => setSaveNotice(false), 4000); return () => window.clearTimeout(timer); }, [saveNotice]);
  const notesDirty = !areClinicalNotesEqual(values, savedValues);
  const billingDirty = Boolean(billingDraft.description.trim() || billingDraft.amount.trim() || billingDraft.note.trim());
  const isDirty = notesDirty || billingDirty;
  useEffect(() => { if (!isDirty) return undefined; const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warnBeforeUnload); return () => window.removeEventListener("beforeunload", warnBeforeUnload); }, [isDirty]);

  async function saveNotes() { const updated = await updateNotes.mutateAsync(values); const updatedValues = clinicalNotesValues(updated); setValues(updatedValues); setSavedValues(updatedValues); setSaveNotice(true); return updated; }
  const updateBillingDraft = useCallback(<Key extends keyof VisitBillingDraft>(key: Key, value: VisitBillingDraft[Key]) => {
    setSaveNotice(false);
    setBillingDraft((current) => ({ ...current, [key]: value }));
    setBillingErrors((current) => {
      if (!current[key as keyof VisitBillingErrors]) return current;
      const next = { ...current };
      delete next[key as keyof VisitBillingErrors];
      return next;
    });
  }, []);
  function validateBilling() {
    const errors: VisitBillingErrors = {};
    if (!billingDraft.description.trim()) errors.description = c.billingDescriptionRequired;
    if (!billingDraft.amount.trim()) errors.amount = c.billingAmountRequired;
    else if (!/^\d+(?:\.\d{1,2})?$/.test(billingDraft.amount.trim()) || Number(billingDraft.amount) <= 0) errors.amount = c.invalidTreatmentCharge;
    if (!billingDraft.currency) errors.currency = c.billingCurrencyRequired;
    setBillingErrors(errors);
    return errors;
  }
  function prepareCompletion() {
    updateNotes.reset();
    completeVisit.reset();
    const errors = validateBilling();
    const firstInvalid = (Object.keys(errors) as Array<keyof VisitBillingErrors>)[0];
    if (firstInvalid) {
      setSelectedTab("billing");
      window.requestAnimationFrame(() => document.getElementById(`billing-${firstInvalid}`)?.focus());
      return;
    }
    setConfirmOpen(true);
  }
  async function complete() {
    const currency = billingDraft.currency as Currency;
    const result = await completeVisit.mutateAsync({
      version: visit.updated_at,
      notes: values,
      billing: {
        description: billingDraft.description.trim(),
        total_amount: billingDraft.amount.trim(),
        currency,
        note: billingDraft.note.trim(),
      },
    });
    setSavedValues(values);
    setCompletionResult({
      amount: billingDraft.amount.trim(),
      currency,
      invoiceNumber: result.created_invoice.invoice_number,
      invoiceStatus: result.created_invoice.status,
    });
    setConfirmOpen(false);
  }
  const isCompleting = updateNotes.isPending || completeVisit.isPending;
  const completionError = completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined);
  const isConflict = (updateNotes.error as { code?: string } | null)?.code === "VERSION_CONFLICT" || (completeVisit.error as { code?: string } | null)?.code === "VERSION_CONFLICT";
  const saveStatus = isDirty ? c.notesUnsaved : saveNotice ? c.notesSaved : c.notesUpToDate;

  if (completionResult) return <Card className="active-visit-completion-success"><StatePanel state="empty" title={c.visitCompleted} description={c.visitBillingSuccess} /><dl className="active-visit-billing-details"><div><dt>{c.invoiceReference}</dt><dd dir="ltr">{completionResult.invoiceNumber}</dd></div><div><dt>{c.invoiceStatus}</dt><dd>{completionResult.invoiceStatus}</dd></div><div><dt>{c.totalTreatmentCharge}</dt><dd dir="ltr">{new Intl.NumberFormat("en-US", { style: "currency", currency: completionResult.currency }).format(Number(completionResult.amount))}</dd></div></dl><div className="form-actions"><Link className="button secondary" to={`/${role.toLowerCase()}/appointments`}>{c.backAppointments}</Link><Link className="button primary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{c.openPatient.replace("{patient}", visit.patient.full_name)}</Link></div></Card>;

  return <div className="visit-workspace">
    <div className="active-visit-context-stack">
      <PatientAndVisitSummary role={role} visit={visit} isDirty={isDirty} />
      <VisitTabs selected={selectedTab} onSelect={setSelectedTab} />
    </div>
    <section id={`visit-panel-${selectedTab}`} className="visit-tab-panel" role="tabpanel" aria-labelledby={`visit-tab-${selectedTab}`} tabIndex={0}>
      {selectedTab === "notes" ? <Card className="active-visit-notes-card"><div className="section-header"><h3>{c.clinicalNotes}</h3><p>{permissions.canEditClinicalNotes ? c.notesDescription : c.notesReadOnly}</p></div>{isConflict ? <StatePanel state="locked" title={c.conflictTitle} description={c.conflictDescription} action={onReloadVisit ? <button className="button secondary" type="button" onClick={() => void onReloadVisit()}>{c.refreshVisit}</button> : undefined} /> : null}{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => { setSaveNotice(false); setValues((current) => ({ ...current, [field]: value })); }} /> : <ReadOnlyNotes values={values} />}</Card> : null}
      {selectedTab === "attachments" ? <ActiveVisitXrayWorkspace role={role} visit={visit} /> : null}
      {selectedTab === "billing" ? <VisitBillingSection role={role} visit={visit} draft={billingDraft} errors={billingErrors} onDraftChange={updateBillingDraft} /> : null}
    </section>
    {permissions.canEditClinicalNotes || permissions.canCompleteVisit ? <footer className="active-visit-action-bar">
      <p className={`active-visit-save-state${isDirty ? " is-dirty" : ""}`} role="status" aria-live="polite"><span aria-hidden="true" />{saveStatus}</p>
      <div className="active-visit-action-buttons">
        {Object.keys(billingErrors).length ? <span className="active-visit-billing-validation" role="alert">{c.completeBillingFirst}</span> : null}
        {permissions.canEditClinicalNotes ? <button className={`button ${notesDirty ? "primary" : "secondary"}`} type="button" disabled={!notesDirty || updateNotes.isPending} aria-busy={updateNotes.isPending || undefined} onClick={() => void saveNotes()}><Save size={17} aria-hidden="true" />{updateNotes.isPending ? c.saving : c.saveNotes}</button> : null}
        {permissions.canCompleteVisit ? <button className="button active-visit-complete" type="button" disabled={isCompleting} aria-busy={isCompleting || undefined} onClick={prepareCompletion}>{c.completeVisit}</button> : null}
      </div>
    </footer> : null}
    {isConfirmOpen ? <Modal open title={c.completeWithBillingTitle} description={c.completeWithBillingBody} onClose={() => setConfirmOpen(false)} pending={isCompleting}>
      <dl className="active-visit-billing-details active-visit-completion-summary"><div><dt>{c.patient}</dt><dd>{visit.patient.full_name}</dd></div><div><dt>{c.treatmentDescription}</dt><dd>{billingDraft.description.trim()}</dd></div><div><dt>{c.totalTreatmentCharge}</dt><dd dir="ltr">{Number(billingDraft.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div><div><dt>{c.currency}</dt><dd dir="ltr">{billingDraft.currency}</dd></div></dl>
      {completionError ? <ErrorState error={completionError} title={c.completeError} /> : null}
      <div className="form-actions"><button className="button secondary" type="button" disabled={isCompleting} onClick={() => setConfirmOpen(false)}>{c.cancel}</button><button className="button primary" type="button" disabled={isCompleting} onClick={() => void complete()}>{isCompleting ? c.completing : c.completeAndSend}</button></div>
    </Modal> : null}
  </div>;
}
