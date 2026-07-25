import { useEffect, useState } from "react";

import { ErrorState } from "../../../components/ErrorState";
import { Button, Modal } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { getPatients } from "../../../api/endpoints/patients";
import { usePatientVisits } from "../../patients/hooks/usePatient";
import type { ExternalAttachPayload, ExternalXrayCase } from "../../../types/xrays";
import type { PatientListItem } from "../../../types/patients";

interface AttachDialogProps { external: ExternalXrayCase; error?: unknown; isSubmitting: boolean; onCancel: () => void; onSubmit: (payload: ExternalAttachPayload) => void; }

function VisitSelect({ patientId, onChange }: { patientId: number | null; onChange: (value: number | null) => void }) {
  const user = useAuthStore((state) => state.user);
  const visits = usePatientVisits(patientId ?? 0, Boolean(patientId));
  if (!patientId) return null;
  const ownVisits = (visits.data?.results ?? []).filter((visit) => visit.doctor.id === user?.id);
  return <label>Optional visit<select onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} defaultValue=""><option value="">No visit</option>{ownVisits.map((visit) => <option key={visit.id} value={visit.id}>Visit #{visit.id} ({visit.status})</option>)}</select></label>;
}

export function AttachExternalXrayDialog({ external, error, isSubmitting, onCancel, onSubmit }: AttachDialogProps) {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selected, setSelected] = useState<PatientListItem | null>(null);
  const [visitId, setVisitId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [searchError, setSearchError] = useState<unknown>(null);

  useEffect(() => { void getPatients({ search }).then((page) => { setPatients(page.results.filter((patient) => !patient.is_archived)); setSearchError(null); }).catch(setSearchError); }, [search]);
  function choose(patient: PatientListItem) { setSelected(patient); setVisitId(null); }
  return <Modal open wide title="Attach to patient" description="Attach this temporary external X-ray to an active patient. The original temporary case is not re-uploaded." onClose={onCancel} pending={isSubmitting}>
    <label className="dialog-field">Search patients<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient name or contact" /></label>
    {searchError ? <ErrorState error={searchError} title="Unable to search patients" /> : null}
    <div className="attach-patient-list">{patients.map((patient) => <button className={selected?.id === patient.id ? "button primary" : "button secondary"} type="button" key={patient.id} onClick={() => choose(patient)}>{patient.full_name}</button>)}</div>
    {selected ? <p className="form-note">Selected patient: {selected.full_name}</p> : null}
    <VisitSelect patientId={selected?.id ?? null} onChange={setVisitId} />
    <label className="dialog-field">Title override<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="dialog-field">Notes override<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    {error ? <ErrorState error={error} title="Unable to attach external X-ray" /> : null}
    <div className="xray-dialog-actions"><Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</Button><Button type="button" loading={isSubmitting} disabled={!selected} onClick={() => selected && onSubmit({ patient_id: selected.id, visit_id: visitId, title, notes })}>{isSubmitting ? "Attaching..." : "Attach to patient"}</Button></div>
  </Modal>;
}

interface DiscardDialogProps { external: ExternalXrayCase; error?: unknown; isSubmitting: boolean; onCancel: () => void; onConfirm: () => void; }
export function DiscardExternalXrayDialog({ external, error, isSubmitting, onCancel, onConfirm }: DiscardDialogProps) {
  return <Modal open title="Discard temporary case" description={`This removes ${external.title || external.original_file_name} from the active external workflow. It does not attach the file or create a patient X-ray.`} onClose={onCancel} pending={isSubmitting}>{error ? <ErrorState error={error} title="Unable to discard external case" /> : null}<div className="xray-dialog-actions"><Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>Keep case</Button><Button variant="danger" type="button" loading={isSubmitting} onClick={onConfirm}>{isSubmitting ? "Discarding..." : "Discard case"}</Button></div></Modal>;
}
