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
          <dd>{displayText(patient.phone_number)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{displayText(patient.email)}</dd>
        </div>
        <div>
          <dt>National ID or passport</dt>
          <dd>{displayText(patient.national_id_or_passport)}</dd>
        </div>
        <div>
          <dt>Emergency contact</dt>
          <dd>{displayText(patient.emergency_contact)}</dd>
        </div>
        <div>
          <dt>Gender</dt>
          <dd>{patient.gender}</dd>
        </div>
        <div>
          <dt>Date of birth</dt>
          <dd>{patient.date_of_birth ? formatDate(patient.date_of_birth) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{patient.age ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Blood group</dt>
          <dd>{displayText(patient.blood_group)}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{patient.version}</dd>
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
