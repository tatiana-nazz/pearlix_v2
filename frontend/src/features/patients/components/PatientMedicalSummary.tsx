import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { SectionHeader } from "../../../components/SectionHeader";
import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
import { getPatientPermissions } from "../utils/patientPermissions";

interface PatientMedicalSummaryProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
}

export function PatientMedicalSummary({ role, patient, onEdit }: PatientMedicalSummaryProps) {
  const hasSummary = Boolean(patient.medical_conditions_history || patient.insurance_info || patient.general_notes);
  const canEdit = getPatientPermissions(role, patient).canEdit;

  return (
    <Card>
      <SectionHeader title="Medical Summary" description="Profile-level summary and general notes. Clinical visit notes are handled in the Visits phase." />
      {hasSummary ? (
        <div className="medical-summary-grid">
          <section>
            <h3>Medical conditions history</h3>
            <p>{patient.medical_conditions_history || "No medical history has been recorded."}</p>
          </section>
          <section>
            <h3>Insurance information</h3>
            <p>{patient.insurance_info || "No insurance information has been recorded."}</p>
          </section>
          <section>
            <h3>General notes</h3>
            <p>{patient.general_notes || "No general notes have been recorded."}</p>
          </section>
        </div>
      ) : (
        <EmptyState title="No medical summary has been recorded." />
      )}
      {canEdit ? (
        <button className="button secondary inline-action" type="button" onClick={onEdit}>
          Edit summary
        </button>
      ) : null}
    </Card>
  );
}
