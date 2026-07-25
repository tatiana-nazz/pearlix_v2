import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { EmptyState } from "../../../components/EmptyState";
import type { UserRole } from "../../../types/auth";
import type { PatientListItem } from "../../../types/patients";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { patientProfilePath } from "../utils/patientPermissions";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { patientCopy } from "../i18n";

interface PatientTableProps {
  role: UserRole;
  patients: PatientListItem[];
  showArchivedStatus: boolean;
}

export function PatientTable({ role, patients, showArchivedStatus }: PatientTableProps) {
  const navigate = useNavigate();
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));

  if (!patients.length) return <EmptyState title={c.noPatients} />;

  return (
    <div className="table-scroll">
      <table className="patient-table">
        <thead>
          <tr>
            <th>{c.patient}</th><th>{c.contact}</th><th>{c.gender}</th><th>{c.age}</th>
            {showArchivedStatus ? <th>{c.status}</th> : null}
            {role === "DOCTOR" ? <th>{c.visits}</th> : null}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const profilePath = patientProfilePath(role, patient.id);
            return (
              <tr key={patient.id} tabIndex={0} className="clickable-row" onClick={() => navigate(profilePath)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(profilePath); }
              }}>
                <td>
                  <strong>{patient.full_name}</strong>
                </td>
                <td>{displayText(patient.phone_number || patient.email)}</td>
                <td>{patient.gender === "Female" ? c.female : c.male}</td>
                <td>{patient.age ?? c.notRecorded}</td>
                {showArchivedStatus ? (
                  <td>
                    <PatientStatusBadge patient={patient} />
                  </td>
                ) : null}
                {role === "DOCTOR" ? <td>{patient.last_visit_with_me_at ? formatDateTime(patient.last_visit_with_me_at) : c.notRecorded}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
