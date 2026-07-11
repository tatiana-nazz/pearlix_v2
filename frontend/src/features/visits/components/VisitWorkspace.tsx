import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useCompleteVisit, useUpdateClinicalNotes } from "../hooks/useVisits";
import { areClinicalNotesEqual, clinicalNotesValues, type ClinicalNotesValues } from "../utils/visitForm";
import { getVisitPermissions } from "../utils/visitPermissions";
import { ClinicalNotesForm } from "./ClinicalNotesForm";
import { CompleteVisitDialog } from "./CompleteVisitDialog";

interface VisitWorkspaceProps {
  role: UserRole;
  visit: VisitDetail;
}

function DetailGrid({ visit }: { visit: VisitDetail }) {
  return (
    <dl className="detail-grid">
      <div><dt>Patient</dt><dd>{visit.patient.full_name}</dd></div>
      <div><dt>Doctor</dt><dd>{visit.doctor.full_name}</dd></div>
      <div><dt>Appointment</dt><dd>{formatDateRange(visit.appointment.start_datetime, visit.appointment.end_datetime)}</dd></div>
      <div><dt>Reason</dt><dd>{displayText(visit.appointment.reason)}</dd></div>
      <div><dt>Started</dt><dd>{formatDateTime(visit.started_at)}</dd></div>
      <div><dt>Status</dt><dd><StatusPill status={visit.status} /></dd></div>
      {visit.completed_at ? <div><dt>Completed</dt><dd>{formatDateTime(visit.completed_at)}</dd></div> : null}
    </dl>
  );
}

function ReadOnlyNotes({ values }: { values: ClinicalNotesValues }) {
  return (
    <dl className="visit-notes-readonly">
      <div><dt>Symptoms</dt><dd>{displayText(values.symptoms)}</dd></div>
      <div><dt>Diagnosis</dt><dd>{displayText(values.diagnosis)}</dd></div>
      <div><dt>Treatment</dt><dd>{displayText(values.treatment)}</dd></div>
      <div><dt>Clinical notes</dt><dd>{displayText(values.clinical_notes)}</dd></div>
      <div><dt>Follow-up notes</dt><dd>{displayText(values.follow_up_notes)}</dd></div>
    </dl>
  );
}

export function VisitWorkspace({ role, visit }: VisitWorkspaceProps) {
  const user = useAuthStore((state) => state.user);
  const permissions = useMemo(() => getVisitPermissions(role, user?.id, visit), [role, user?.id, visit]);
  const initialValues = useMemo(() => clinicalNotesValues(visit), [visit]);
  const [values, setValues] = useState<ClinicalNotesValues>(initialValues);
  const [savedValues, setSavedValues] = useState<ClinicalNotesValues>(initialValues);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const updateNotes = useUpdateClinicalNotes(visit.id);
  const completeVisit = useCompleteVisit(visit.id);

  useEffect(() => {
    setValues(initialValues);
    setSavedValues(initialValues);
    setConfirmOpen(false);
  }, [visit.id]);

  const isDirty = !areClinicalNotesEqual(values, savedValues);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  async function saveNotes() {
    const updated = await updateNotes.mutateAsync(values);
    const updatedValues = clinicalNotesValues(updated);
    setValues(updatedValues);
    setSavedValues(updatedValues);
    return updated;
  }

  async function complete() {
    if (isDirty) await saveNotes();
    await completeVisit.mutateAsync();
    setConfirmOpen(false);
  }

  const isCompleting = updateNotes.isPending || completeVisit.isPending;
  const completionError = completeVisit.error ?? (isConfirmOpen ? updateNotes.error : undefined);

  return (
    <div className="visit-workspace">
      <Card>
        <div className="visit-summary-header">
          <div>
            <p className="eyebrow">Visit #{visit.id}</p>
            <h3>{visit.patient.full_name}</h3>
          </div>
          <StatusPill status={visit.status} />
        </div>
        <DetailGrid visit={visit} />
      </Card>

      <Card>
        <div className="section-header">
          <h3>Clinical notes</h3>
          <p>{permissions.canEditClinicalNotes ? "Record the clinical encounter. Completed visits remain editable only for the owning doctor." : "Clinical notes are read-only for your role and this visit."}</p>
        </div>
        {permissions.canEditClinicalNotes ? (
          <ClinicalNotesForm
            values={values}
            isSaving={updateNotes.isPending}
            error={updateNotes.error}
            onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
            onSave={() => void saveNotes()}
          />
        ) : <ReadOnlyNotes values={values} />}
      </Card>

      <div className="visit-workspace-actions">
        <Link className="button secondary" to={`/${role.toLowerCase()}/patients/${visit.patient.id}`}>
          Patient profile
        </Link>
        {permissions.canCompleteVisit ? (
          <button className="button primary" type="button" onClick={() => { updateNotes.reset(); completeVisit.reset(); setConfirmOpen(true); }}>
            Complete Visit
          </button>
        ) : null}
      </div>

      {isConfirmOpen ? (
        <CompleteVisitDialog
          patientName={visit.patient.full_name}
          hasUnsavedNotes={isDirty}
          isSubmitting={isCompleting}
          error={completionError}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void complete()}
        />
      ) : null}
    </div>
  );
}
