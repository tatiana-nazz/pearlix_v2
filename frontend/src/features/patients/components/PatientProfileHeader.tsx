import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
import { displayText } from "../../../utils/formatters";
import { getPatientPermissions } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";

interface PatientProfileHeaderProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function PatientProfileHeader({ role, patient, onEdit, onArchive, onUnarchive }: PatientProfileHeaderProps) {
  const permissions = getPatientPermissions(role, patient);
  const canShowStatus = role !== "DOCTOR";

  return (
    <section className="profile-header">
      <div>
        <p className="eyebrow">Patient profile</p>
        <h2>{patient.full_name}</h2>
        <p>
          {displayText(patient.phone_number)} - {patient.age ? `${patient.age} years old` : "Age not recorded"} - {patient.gender}
        </p>
      </div>
      <div className="profile-actions">
        {canShowStatus ? <PatientStatusBadge patient={patient} /> : null}
        {permissions.canEdit ? (
          <button className="button secondary" type="button" onClick={onEdit}>
            Edit
          </button>
        ) : null}
        {permissions.canArchive ? (
          <button className="button secondary" type="button" onClick={onArchive}>
            Archive Patient
          </button>
        ) : null}
        {permissions.canUnarchive ? (
          <button className="button secondary" type="button" onClick={onUnarchive}>
            Unarchive Patient
          </button>
        ) : null}
      </div>
    </section>
  );
}
