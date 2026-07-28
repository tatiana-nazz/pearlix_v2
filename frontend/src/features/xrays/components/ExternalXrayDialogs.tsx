import { useEffect, useRef, useState } from "react";

import { getPatients } from "../../../api/endpoints/patients";
import { useAuthStore } from "../../../auth/authStore";
import { Button, ConfirmDialog, SelectField, StatePanel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { PatientListItem } from "../../../types/patients";
import type { ExternalAttachPayload, ExternalXrayCase } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { usePatientVisits } from "../../patients/hooks/usePatient";

interface AttachDialogProps {
  external: ExternalXrayCase;
  error?: unknown;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: ExternalAttachPayload) => void;
}

function VisitSelect({ patientId, value, onChange }: { patientId: number | null; value: number | null; onChange: (value: number | null) => void }) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const visits = usePatientVisits(patientId ?? 0, Boolean(patientId));
  if (!patientId) return null;
  if (visits.isLoading) return <StatePanel state="loading" title={t("loadingVisit")} />;
  if (visits.isError) return <StatePanel state="error" title={t("visitUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void visits.refetch()}>{t("retry")}</Button>} />;
  return <SelectField label={t("optionalVisit")} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
    <option value="">{t("noVisit")}</option>
    {(visits.data?.results ?? []).filter((visit) => visit.doctor.id === user?.id).map((visit) => <option key={visit.id} value={visit.id}>{formatDateTime(visit.started_at)} · {visit.status === "ACTIVE" ? t("activeVisit") : t("completed")}</option>)}
  </SelectField>;
}

export function AttachExternalXrayDialog({ external, error, isSubmitting, onCancel, onSubmit }: AttachDialogProps) {
  const t = useFeatureT();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selected, setSelected] = useState<PatientListItem | null>(null);
  const [visitId, setVisitId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const request = useRef(0);
  const dirty = Boolean(selected || title || notes);

  useEffect(() => {
    const query = search.trim();
    if (!query) { setPatients([]); setSearchError(null); setSearching(false); return undefined; }
    const sequence = ++request.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void getPatients({ search: query }).then((page) => {
        if (sequence !== request.current) return;
        setPatients(page.results.filter((patient) => !patient.is_archived));
        setSearchError(null);
      }).catch((nextError: unknown) => {
        if (sequence === request.current) setSearchError(nextError);
      }).finally(() => {
        if (sequence === request.current) setSearching(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); request.current += 1; };
  }, [search]);

  function choose(patient: PatientListItem) { setSelected(patient); setVisitId(null); }
  return <ConfirmDialog open title={t("attachToPatient")} description={t("attachExplanation")} onClose={onCancel} pending={isSubmitting} dirty={dirty} wide>
    <form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (selected && !isSubmitting) onSubmit({ patient_id: selected.id, visit_id: visitId, title: title.trim() || undefined, notes: notes.trim() || undefined }); }}>
      <label className="v2-field"><span>{t("searchPatients")}</span><input value={search} disabled={isSubmitting} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPatientPlaceholder")} /></label>
      {searching ? <p aria-live="polite">{t("searchingPatients")}</p> : null}
      {searchError ? <StatePanel state="error" title={t("patientsUnavailable")} /> : null}
      {!searching && search.trim() && !searchError && !patients.length ? <p role="status">{t("noPatientsFound")}</p> : null}
      <div className="attach-patient-list" aria-label={t("searchPatients")}>{patients.map((patient) => <Button variant={selected?.id === patient.id ? "primary" : "secondary"} type="button" key={patient.id} disabled={isSubmitting} onClick={() => choose(patient)}><bdi>{patient.full_name}</bdi></Button>)}</div>
      {selected ? <p className="form-note">{t("selectedPatient")}: <bdi>{selected.full_name}</bdi></p> : null}
      <VisitSelect patientId={selected?.id ?? null} value={visitId} onChange={setVisitId} />
      <label className="v2-field"><span>{t("titleOverride")}</span><input value={title} disabled={isSubmitting} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="v2-field"><span>{t("notesOverride")}</span><textarea rows={3} disabled={isSubmitting} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error ? <p className="form-error" role="alert">{t("attachUnavailable")}</p> : null}
      <div className="form-actions"><Button variant="secondary" type="button" disabled={isSubmitting} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={isSubmitting} disabled={!selected}>{isSubmitting ? t("attaching") : t("attachToPatient")}</Button></div>
    </form>
  </ConfirmDialog>;
}

interface DiscardDialogProps { external: ExternalXrayCase; error?: unknown; isSubmitting: boolean; onCancel: () => void; onConfirm: () => void; }
export function DiscardExternalXrayDialog({ external, error, isSubmitting, onCancel, onConfirm }: DiscardDialogProps) {
  const t = useFeatureT();
  return <ConfirmDialog open title={t("discardCase")} description={t("discardExplanation")} onClose={onCancel} pending={isSubmitting}>
    <p>{t("discardHistoryExplanation")}</p>
    {error ? <p className="form-error" role="alert">{t("discardUnavailable")}</p> : null}
    <div className="form-actions"><Button variant="secondary" type="button" disabled={isSubmitting} onClick={onCancel}>{t("keepCase")}</Button><Button variant="danger" type="button" loading={isSubmitting} onClick={onConfirm}>{isSubmitting ? t("discarding") : t("discardCase")}</Button></div>
  </ConfirmDialog>;
}
