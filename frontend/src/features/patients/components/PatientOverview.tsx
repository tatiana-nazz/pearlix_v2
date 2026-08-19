import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import { useAuthStore } from "../../../auth/authStore";
import type { PatientDetail } from "../../../types/patients";
import { formatDate, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { patientCopy } from "../i18n";

interface PatientOverviewProps {
  patient: PatientDetail;
}

export function PatientOverview({ patient }: PatientOverviewProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  return (
    <Card>
      <SectionHeader title={c.overview} description={c.overviewDescription} />
      <dl className="detail-grid">
        <div>
          <dt>{c.phone}</dt>
          <dd>{displayText(patient.phone_number)}</dd>
        </div>
        <div>
          <dt>{c.email}</dt>
          <dd>{displayText(patient.email)}</dd>
        </div>
        <div>
          <dt>{c.nationalId}</dt>
          <dd>{displayText(patient.national_id_or_passport)}</dd>
        </div>
        <div>
          <dt>{c.emergencyContact}</dt>
          <dd>{displayText(patient.emergency_contact)}</dd>
        </div>
        <div>
          <dt>{c.gender}</dt>
          <dd>{patient.gender === "Female" ? c.female : c.male}</dd>
        </div>
        <div>
          <dt>{c.dateOfBirth}</dt>
          <dd>{patient.date_of_birth ? formatDate(patient.date_of_birth) : c.notRecorded}</dd>
        </div>
        <div>
          <dt>{c.age}</dt>
          <dd>{patient.age ?? c.notRecorded}</dd>
        </div>
        <div>
          <dt>{c.bloodGroup}</dt>
          <dd>{displayText(patient.blood_group)}</dd>
        </div>
        <div>
          <dt>{c.version}</dt>
          <dd>{patient.version}</dd>
        </div>
        <div className="detail-wide">
          <dt>{c.address}</dt>
          <dd>{displayText(patient.address)}</dd>
        </div>
        <div>
          <dt>{c.created}</dt>
          <dd>{formatDateTime(patient.created_at)}</dd>
        </div>
        <div>
          <dt>{c.updated}</dt>
          <dd>{formatDateTime(patient.updated_at)}</dd>
        </div>
        <div>
          <dt>{c.createdBy}</dt>
          <dd>{patient.created_by?.full_name ?? c.notRecorded}</dd>
        </div>
        <div>
          <dt>{c.updatedBy}</dt>
          <dd>{patient.updated_by?.full_name ?? c.notRecorded}</dd>
        </div>
      </dl>
    </Card>
  );
}
