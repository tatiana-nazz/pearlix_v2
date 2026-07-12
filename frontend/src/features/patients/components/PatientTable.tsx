import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "../../../components/EmptyState";
import type { UserRole } from "../../../types/auth";
import type { PatientListItem } from "../../../types/patients";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { getPatientPermissions, patientProfilePath } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { ClickableRow, StatusBadge } from "../../../components/v2";

interface PatientTableProps {
  role: UserRole;
  patients: PatientListItem[];
  showArchivedStatus: boolean;
  onArchive: (patient: PatientListItem) => void;
  onUnarchive: (patient: PatientListItem) => void;
}

export function PatientTable({ role, patients, showArchivedStatus, onArchive, onUnarchive }: PatientTableProps) {
  const navigate = useNavigate();

  if (!patients.length) return <EmptyState title="No patients found for this filter." />;

  return (
    <div className="table-scroll">
      <table className="patient-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Contact</th>
            <th>Gender / age</th>
            {showArchivedStatus ? <th>Status</th> : null}
            {role === "DOCTOR" ? <th>Last Visit With Me</th> : null}
            <th>Actions</th>
            <th aria-label="Open profile" />
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
                <td>{displayText(patient.phone_number || patient.email)}</td>
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
                        Edit
                      </Link>
                    ) : null}
                    {permissions.canArchive ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onArchive(patient)}>
                        Archive
                      </button>
                    ) : null}
                    {permissions.canUnarchive ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onUnarchive(patient)}>
                        Unarchive
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
