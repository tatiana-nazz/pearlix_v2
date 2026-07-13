import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
import { displayText } from "../../../utils/formatters";
import { getPatientPermissions } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { useFeatureT } from "../../../layouts/i18n";

interface PatientProfileHeaderProps {
  role: UserRole;
  patient: PatientDetail;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function PatientProfileHeader({ role, patient, onEdit, onArchive, onUnarchive }: PatientProfileHeaderProps) {
  const t = useFeatureT();
  const permissions = getPatientPermissions(role, patient);
  const canShowStatus = role !== "DOCTOR";

  return (
    <section className="profile-header">
      <div>
        <p className="eyebrow">{t("patientProfile")}</p>
        <h2 className="bidi-isolate">{patient.full_name}</h2>
        <p>
          <span className="bidi-isolate">{displayText(patient.phone_number)}</span> - <span className="bidi-isolate">{patient.age ? `${patient.age} ${t("yearsOld")}` : t("ageNotRecorded")}</span> - {patient.gender === "Male" ? t("male") : t("female")}
        </p>
      </div>
      <div className="profile-actions">
        {canShowStatus ? <PatientStatusBadge patient={patient} /> : null}
        {permissions.canEdit ? (
          <button className="button secondary" type="button" onClick={onEdit}>
            {t("editPatient")}
          </button>
        ) : null}
        {permissions.canArchive ? (
          <button className="button secondary" type="button" onClick={onArchive}>
            {t("archivePatient")}
          </button>
        ) : null}
        {permissions.canUnarchive ? (
          <button className="button secondary" type="button" onClick={onUnarchive}>
            {t("unarchivePatient")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
