import { CalendarDays, ClipboardList, Clock3, FileImage, Mail, Phone, ReceiptText, Save, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ConfirmDialog, Modal, StatePanel, StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { Currency } from "../../../types/clinic";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { VisitBillingSection, type VisitBillingDraft, type VisitBillingErrors } from "../../billing/components/VisitBillingSection";
import { usePatient } from "../../patients/hooks/usePatient";
import { ActiveVisitXrayWorkspace } from "../../xrays/components/ActiveVisitXrayWorkspace";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";

interface VisitWorkspaceProps { role: UserRole; visit: VisitDetail; onReloadVisit?: () => Promise<unknown> | void; }
type WorkspaceTab = "notes" | "xrays" | "billing";
const emptyBillingDraft: VisitBillingDraft = { description: "", amount: "", currency: "", note: "" };

function VisitTabs({ selected, onSelect }: { selected: WorkspaceTab; onSelect: (tab: WorkspaceTab) => void }) {
  const t = useFeatureT();
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof ClipboardList }> = [
    { id: "notes", label: t("visitNotes"), icon: ClipboardList },
    { id: "xrays", label: t("xraysAi"), icon: FileImage },
    { id: "billing", label: t("billing"), icon: ReceiptText },
  ];
  return <div className="visit-workspace-tabs" role="tablist" aria-label={t("activeVisit")}>{tabs.map((tab, index) => { const Icon = tab.icon; return <button key={tab.id} id={`visit-tab-${tab.id}`} className={selected === tab.id ? "active" : undefined} type="button" role="tab" aria-selected={selected === tab.id} aria-controls={`visit-panel-${tab.id}`} tabIndex={selected === tab.id ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={(event) => { if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return; event.preventDefault(); const rtl = getComputedStyle(event.currentTarget.parentElement ?? event.currentTarget).direction === "rtl"; const visualForward = event.key === "ArrowRight" ? 1 : -1; const delta = rtl ? -visualForward : visualForward; const next = (index + delta + tabs.length) % tabs.length; onSelect(tabs[next].id); window.requestAnimationFrame(() => event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus()); }}><Icon size={18} aria-hidden="true" /><span>{tab.label}</span></button>; })}</div>;
}

function PatientAndVisitSummary({ role, visit, isDirty }: { role: UserRole; visit: VisitDetail; isDirty: boolean }) {
  const t = useFeatureT();
  const patient = usePatient(visit.patient.id);
  const detail = patient.data;
  const initials = `${visit.patient.first_name.slice(0, 1)}${visit.patient.last_name.slice(0, 1)}`.toUpperCase();
  return <section className="active-visit-summary" aria-labelledby="active-visit-patient-name"><Link className="active-visit-summary-section active-visit-identity" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`} aria-label={t("openPatientProfile")} onClick={(event) => { if (isDirty && !window.confirm(t("discardVisitChanges"))) event.preventDefault(); }}><span className="active-visit-avatar" aria-hidden="true">{initials}</span><div><p className="active-visit-summary-kicker">{t("patient")}</p><h2 id="active-visit-patient-name">{visit.patient.full_name}</h2><p>{displayText(visit.patient.gender, t("notRecorded"))} · {visit.patient.age ? `${visit.patient.age} ${t("yearsOld")}` : t("ageNotRecorded")}</p></div></Link><div className="active-visit-summary-section active-visit-contact"><p className="active-visit-summary-kicker">{t("contact")}</p><dl className="active-visit-summary-list"><div><dt><Phone size={16} aria-hidden="true" />{t("phone")}</dt><dd dir="ltr">{displayText(detail?.phone_number ?? visit.patient.phone_number, t("notRecorded"))}</dd></div><div><dt><Mail size={16} aria-hidden="true" />{t("email")}</dt><dd dir="ltr">{displayText(detail?.email ?? visit.patient.email, t("notRecorded"))}</dd></div><div><dt>{t("emergencyContact")}</dt><dd>{displayText(detail?.emergency_contact, t("notRecorded"))}</dd></div></dl></div><div className="active-visit-summary-section active-visit-visit-context"><p className="active-visit-summary-kicker">{t("appointmentContext")}</p><dl className="active-visit-summary-list"><div><dt><CalendarDays size={16} aria-hidden="true" />{t("appointment")}</dt><dd dir="ltr">{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime)}</dd></div><div><dt><Stethoscope size={16} aria-hidden="true" />{t("doctor")}</dt><dd>{visit.doctor.full_name}</dd></div><div><dt>{t("reason")}</dt><dd>{displayText(visit.appointment.reason, t("notRecorded"))}</dd></div><div className="active-visit-status-pair"><dt>{t("status")}</dt><dd><StatusBadge status={visit.appointment.status} /><StatusBadge status={visit.status} /></dd></div><div><dt><Clock3 size={16} aria-hidden="true" />{t("started")}</dt><dd dir="ltr">{formatDateTime(visit.started_at)}</dd></div></dl></div></section>;
}

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  const t = useFeatureT();
  const fields: Array<[keyof ClinicalNotesValues, Parameters<typeof t>[0]]> = [["symptoms", "subjectiveNotes"], ["clinical_notes", "objectiveNotes"], ["diagnosis", "assessment"], ["treatment", "plan"], ["follow_up_notes", "generalNotes"]];
  return <dl className="visit-notes-readonly">{fields.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{displayText(values[key], t("notRecorded"))}</dd></div>)}</dl>;
}

export function VisitWorkspace({ role, visit, onReloadVisit }: VisitWorkspaceProps) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const permissions = useMemo(() => getVisitPermissions(role, user?.id, visit), [role, user?.id, visit]);
  const initialValues = useMemo(() => clinicalNotesValues(visit), [visit]);
  const [values, setValues] = useState<ClinicalNotesValues>(initialValues);
  const [savedValues, setSavedValues] = useState<ClinicalNotesValues>(initialValues);
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("notes");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [billingDraft, setBillingDraft] = useState<VisitBillingDraft>(emptyBillingDraft);
  const [billingErrors, setBillingErrors] = useState<VisitBillingErrors>({});
  const [completionResult, setCompletionResult] = useState<{ amount: string; currency: Currency } | null>(null);
  const approvedNavigation = useRef(false);
  const updateNotes = useUpdateClinicalNotes(visit.id);
  const completeVisit = useCompleteVisit(visit.id);
  const notesDirty = !areClinicalNotesEqual(values, savedValues);
  const billingDirty = Boolean(billingDraft.description.trim() || billingDraft.amount.trim() || billingDraft.note.trim());
  const isDirty = notesDirty || billingDirty;
  const blocker = useBlocker(() => !approvedNavigation.current && (isDirty || updateNotes.isPending || completeVisit.isPending));

  useEffect(() => { setValues(clinicalNotesValues(visit)); setSavedValues(clinicalNotesValues(visit)); setBillingDraft(emptyBillingDraft); setBillingErrors({}); setCompletionResult(null); setConfirmOpen(false); }, [visit.id]);
  useEffect(() => { if (!saveNotice) return undefined; const timer = window.setTimeout(() => setSaveNotice(false), 4000); return () => window.clearTimeout(timer); }, [saveNotice]);
  useEffect(() => { if (blocker.state === "blocked") setConfirmLeave(true); }, [blocker.state]);
  useEffect(() => { if (!isDirty) return undefined; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [isDirty]);

  async function saveNotes() { const updated = await updateNotes.mutateAsync(values); const next = clinicalNotesValues(updated); setValues(next); setSavedValues(next); setSaveNotice(true); return updated; }
  const updateBillingDraft = useCallback(<Key extends keyof VisitBillingDraft>(key: Key, value: VisitBillingDraft[Key]) => { setSaveNotice(false); setBillingDraft((current) => ({ ...current, [key]: value })); setBillingErrors((current) => { if (!current[key as keyof VisitBillingErrors]) return current; const next = { ...current }; delete next[key as keyof VisitBillingErrors]; return next; }); }, []);
  function validateBilling() { const errors: VisitBillingErrors = {}; if (!billingDraft.description.trim()) errors.description = t("billingDescriptionRequired"); if (!billingDraft.amount.trim()) errors.amount = t("billingAmountRequired"); else if (!/^\d+(?:\.\d{1,2})?$/.test(billingDraft.amount.trim()) || Number(billingDraft.amount) <= 0) errors.amount = t("invalidTreatmentCharge"); if (!billingDraft.currency) errors.currency = t("billingCurrencyRequired"); setBillingErrors(errors); return errors; }
  function prepareCompletion() { updateNotes.reset(); completeVisit.reset(); const errors = validateBilling(); const firstInvalid = Object.keys(errors)[0] as keyof VisitBillingErrors | undefined; if (firstInvalid) { setSelectedTab("billing"); window.requestAnimationFrame(() => document.getElementById(`billing-${firstInvalid}`)?.focus()); return; } setConfirmOpen(true); }
  async function complete() { const currency = billingDraft.currency as Currency; await completeVisit.mutateAsync({ version: visit.updated_at, notes: values, billing_handoff: { description: billingDraft.description.trim(), suggested_amount: billingDraft.amount.trim(), currency, note: billingDraft.note.trim() } }); setSavedValues(values); setCompletionResult({ amount: billingDraft.amount.trim(), currency }); setConfirmOpen(false); }
  const isCompleting = updateNotes.isPending || completeVisit.isPending;
  const isConflict = (updateNotes.error as { code?: string } | null)?.code === "VERSION_CONFLICT" || (completeVisit.error as { code?: string } | null)?.code === "VERSION_CONFLICT";

  if (completionResult) return <Card className="active-visit-completion-success"><StatePanel state="empty" title={t("visitCompleted")} description={t("visitBillingSuccess")} /><dl className="active-visit-billing-details"><div><dt>{t("sentToStaffBilling")}</dt><dd>{t("handoffStatus")}: PENDING</dd></div><div><dt>{t("totalTreatmentCharge")}</dt><dd dir="ltr">{new Intl.NumberFormat("en-US", { style: "currency", currency: completionResult.currency }).format(Number(completionResult.amount))}</dd></div></dl><div className="form-actions"><Link className="button secondary" to={`/${role.toLowerCase()}/appointments/day`}>{t("backAppointments")}</Link><Link className="button primary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>{t("openPatientProfile")}</Link></div></Card>;

  return <div className="visit-workspace"><div className="active-visit-context-stack"><PatientAndVisitSummary role={role} visit={visit} isDirty={isDirty} /><VisitTabs selected={selectedTab} onSelect={setSelectedTab} /></div><section id={`visit-panel-${selectedTab}`} className="visit-tab-panel" role="tabpanel" aria-labelledby={`visit-tab-${selectedTab}`} tabIndex={0}>{selectedTab === "notes" ? <Card className="active-visit-notes-card"><div className="section-header"><h3>{t("clinicalNotes")}</h3><p>{permissions.canEditClinicalNotes ? t("clinicalNotesDescription") : t("clinicalNotesReadOnly")}</p></div>{isConflict ? <StatePanel state="locked" title={t("conflictTitle")} description={t("conflictDescription")} action={onReloadVisit ? <button className="button secondary" type="button" onClick={() => void onReloadVisit()}>{t("refreshVisit")}</button> : undefined} /> : null}{permissions.canEditClinicalNotes ? <ClinicalNotesForm values={values} isSaving={updateNotes.isPending} error={updateNotes.error} onChange={(field, value) => { setSaveNotice(false); setValues((current) => ({ ...current, [field]: value })); }} /> : <ReadOnlyNotes values={values} />}</Card> : null}{selectedTab === "xrays" ? <ActiveVisitXrayWorkspace role={role} visit={visit} /> : null}{selectedTab === "billing" ? <VisitBillingSection role={role} visit={visit} draft={billingDraft} errors={billingErrors} onDraftChange={updateBillingDraft} /> : null}</section>{permissions.canEditClinicalNotes || permissions.canCompleteVisit ? <footer className="active-visit-action-bar"><p className={`active-visit-save-state${isDirty ? " is-dirty" : ""}`} role="status"><span aria-hidden="true" />{isDirty ? t("notesUnsaved") : saveNotice ? t("notesSavedNow") : t("notesUpToDate")}</p><div className="active-visit-action-buttons">{Object.keys(billingErrors).length ? <span className="active-visit-billing-validation" role="alert">{t("completeBillingFirst")}</span> : null}{permissions.canEditClinicalNotes ? <button className={`button ${notesDirty ? "primary" : "secondary"}`} type="button" disabled={!notesDirty || updateNotes.isPending} onClick={() => void saveNotes()}><Save size={17} aria-hidden="true" />{updateNotes.isPending ? t("savingNotes") : t("saveNotes")}</button> : null}{permissions.canCompleteVisit ? <button className="button active-visit-complete" type="button" disabled={isCompleting} onClick={prepareCompletion}>{t("completeVisit")}</button> : null}</div></footer> : null}{confirmOpen ? <Modal open title={t("completeWithBillingTitle")} description={t("completeWithBillingBody")} onClose={() => setConfirmOpen(false)} pending={isCompleting}><dl className="active-visit-billing-details active-visit-completion-summary"><div><dt>{t("patient")}</dt><dd>{visit.patient.full_name}</dd></div><div><dt>{t("treatmentDescription")}</dt><dd>{billingDraft.description.trim()}</dd></div><div><dt>{t("totalTreatmentCharge")}</dt><dd dir="ltr">{billingDraft.amount}</dd></div><div><dt>{t("currency")}</dt><dd>{billingDraft.currency}</dd></div></dl>{completeVisit.error ? <StatePanel state="error" title={t("unableToCompleteVisit")} /> : null}<div className="form-actions"><button className="button secondary" type="button" disabled={isCompleting} onClick={() => setConfirmOpen(false)}>{t("cancel")}</button><button className="button primary" type="button" disabled={isCompleting} onClick={() => void complete()}>{isCompleting ? t("completingVisit") : t("completeAndSend")}</button></div></Modal> : null}<ConfirmDialog open={confirmLeave} title={t("discardVisitChanges")} description={t("discardVisitChanges")} onClose={() => { setConfirmLeave(false); if (blocker.state === "blocked") blocker.reset(); }} pending={isCompleting}><button className="button secondary" type="button" onClick={() => { setConfirmLeave(false); if (blocker.state === "blocked") blocker.reset(); }}>{t("keepEditing")}</button><button className="button danger" type="button" onClick={() => { approvedNavigation.current = true; setConfirmLeave(false); if (blocker.state === "blocked") blocker.proceed(); }}>{t("discard")}</button></ConfirmDialog></div>;
}
