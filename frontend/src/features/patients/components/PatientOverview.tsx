import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import type { PatientDetail } from "../../../types/patients";
import { formatDate, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

interface PatientOverviewProps {
  patient: PatientDetail;
}

export function PatientOverview({ patient }: PatientOverviewProps) {
  return (
    <Card>
      <SectionHeader title="Overview" description="Contact, demographic, and record metadata." />
      <dl className="detail-grid">
        <div>
          <dt>Phone</dt>
          <dd>{displayText(patient.phone)}</dd>
        </div>
        <div>
          <dt>Gender</dt>
          <dd>{patient.gender.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Birth date</dt>
          <dd>{patient.birth_date ? formatDate(patient.birth_date) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{patient.age ?? "Not recorded"}</dd>
        </div>
        <div className="detail-wide">
          <dt>Address</dt>
          <dd>{displayText(patient.address)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(patient.created_at)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDateTime(patient.updated_at)}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{patient.created_by?.full_name ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Updated by</dt>
          <dd>{patient.updated_by?.full_name ?? "Not recorded"}</dd>
        </div>
      </dl>
    </Card>
  );
}
