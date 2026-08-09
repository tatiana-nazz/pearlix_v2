import type { UserRole } from "../../../types/auth";
import { useAuthStore } from "../../../auth/authStore";
import type { PatientDetail } from "../../../types/patients";
import { getPatientPermissions } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { patientCopy } from "../i18n";

interface PatientProfileHeaderProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
  showEdit?: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function PatientProfileHeader({ role, patient, onEdit, showEdit = true, onArchive, onUnarchive }: PatientProfileHeaderProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  const permissions = getPatientPermissions(role, patient);
  const canShowStatus = role !== "DOCTOR";

  return (
    <section className="profile-header">
      <div>
        <p className="eyebrow">{c.patientProfile}</p>
        <h2>{patient.full_name}</h2>
        <p>{c.overviewDescription}</p>
      </div>
      <div className="profile-actions">
        {canShowStatus ? <PatientStatusBadge patient={patient} /> : null}
        {permissions.canEdit && showEdit ? (
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
