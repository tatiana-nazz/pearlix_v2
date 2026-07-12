import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "../../../components/EmptyState";
import type { UserRole } from "../../../types/auth";
import type { PatientListItem } from "../../../types/patients";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { getPatientPermissions, patientProfilePath } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { ClickableRow } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";

interface PatientTableProps {
  role: UserRole;
  patients: PatientListItem[];
  showArchivedStatus: boolean;
  onArchive: (patient: PatientListItem) => void;
  onUnarchive: (patient: PatientListItem) => void;
}

export function PatientTable({ role, patients, showArchivedStatus, onArchive, onUnarchive }: PatientTableProps) {
  const navigate = useNavigate();
  const t = useFeatureT();

  if (!patients.length) return <EmptyState title={t("noPatients")} />;

  return (
    <div className="table-scroll">
      <table className="patient-table">
        <thead>
          <tr>
            <th>{t("patient")}</th>
            <th>{t("contactIdentifiers")}</th>
            <th>{t("gender")} / age</th>
            {showArchivedStatus ? <th>{t("status")}</th> : null}
            {role === "DOCTOR" ? <th>{t("lastVisitWithMe")}</th> : null}
            <th>{t("editPatient")}</th>
            <th aria-label={t("patientProfile")} />
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const permissions = getPatientPermissions(role, patient);
            const profilePath = patientProfilePath(role, patient.id);
            return (
              <ClickableRow key={patient.id} onOpen={() => navigate(profilePath)}>
                <td>
                  <strong>{patient.full_name}</strong>
                </td>
                <td className="bidi-isolate">{displayText(patient.phone_number || patient.email)}</td>
                <td>{patient.gender} · {patient.age ?? "Not recorded"}</td>
                {showArchivedStatus ? (
                  <td>
                    <PatientStatusBadge patient={patient} />
                  </td>
                ) : null}
                {role === "DOCTOR" ? <td>{patient.last_visit_with_me_at ? formatDateTime(patient.last_visit_with_me_at) : "Not recorded"}</td> : null}
                <td data-row-action>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    {permissions.canEdit ? (
                      <Link className="button secondary compact-button" to={`${profilePath}?edit=1`}>
                        {t("editPatient")}
                      </Link>
                    ) : null}
                    {permissions.canArchive ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onArchive(patient)}>
                        {t("archivePatient")}
                      </button>
                    ) : null}
                    {permissions.canUnarchive ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onUnarchive(patient)}>
                        {t("unarchivePatient")}
                      </button>
                    ) : null}
                  </div>
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
