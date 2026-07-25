import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { SectionHeader } from "../../../components/SectionHeader";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
import { getPatientPermissions } from "../utils/patientPermissions";
import { patientCopy } from "../i18n";

interface PatientMedicalSummaryProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
}

export function PatientMedicalSummary({ role, patient, onEdit }: PatientMedicalSummaryProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  const hasSummary = Boolean(patient.medical_conditions_history || patient.insurance_info || patient.general_notes);
  const canEdit = getPatientPermissions(role, patient).canEdit;

  return (
    <Card>
      <SectionHeader title={c.medicalHistory} description={c.medicalSummaryDescription} />
      {hasSummary ? (
        <div className="medical-summary-grid">
          <section>
            <h3>{c.medicalConditions}</h3>
            <p>{patient.medical_conditions_history || c.noMedicalHistory}</p>
          </section>
          <section>
            <h3>{c.insurance}</h3>
            <p>{patient.insurance_info || c.noInsurance}</p>
          </section>
          <section>
            <h3>{c.generalNotes}</h3>
            <p>{patient.general_notes || c.noNotes}</p>
          </section>
        </div>
      ) : (
        <EmptyState title={c.noMedicalSummary} />
      )}
      {canEdit ? (
        <button className="button secondary inline-action" type="button" onClick={onEdit}>
          {c.editSummary}
        </button>
      ) : null}
    </Card>
  );
}
