import type { UserRole } from "../../../types/auth";
import { useAuthStore } from "../../../auth/authStore";
import type { PatientDetail } from "../../../types/patients";
import { displayText } from "../../../utils/formatters";
import { getPatientPermissions } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { patientCopy } from "../i18n";

interface PatientProfileHeaderProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function PatientProfileHeader({ role, patient, onEdit, onArchive, onUnarchive }: PatientProfileHeaderProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  const permissions = getPatientPermissions(role, patient);
  const canShowStatus = role !== "DOCTOR";

  return (
    <section className="profile-header">
      <div>
        <p className="eyebrow">{c.patientProfile}</p>
        <h2>{patient.full_name}</h2>
        <p>
          {displayText(patient.phone_number)} - {patient.age ? `${patient.age} ${c.yearsOld}` : c.ageNotRecorded} - {patient.gender === "Female" ? c.female : c.male}
        </p>
      </div>
      <div className="profile-actions">
        {canShowStatus ? <PatientStatusBadge patient={patient} /> : null}
        {permissions.canEdit ? (
          <button className="button secondary" type="button" onClick={onEdit}>
            {c.edit}
          </button>
        ) : null}
        {permissions.canArchive ? (
          <button className="button secondary" type="button" onClick={onArchive}>
            {c.archivePatient}
          </button>
        ) : null}
        {permissions.canUnarchive ? (
          <button className="button secondary" type="button" onClick={onUnarchive}>
            {c.unarchivePatient}
          </button>
        ) : null}
      </div>
    </section>
  );
}
