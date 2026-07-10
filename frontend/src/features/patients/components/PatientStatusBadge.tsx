import { StatusPill } from "../../../components/StatusPill";
import type { PatientDetail, PatientListItem } from "../../../types/patients";

interface PatientStatusBadgeProps {
  patient: PatientDetail | PatientListItem;
}

export function PatientStatusBadge({ patient }: PatientStatusBadgeProps) {
  return <StatusPill status={patient.is_archived ? "ARCHIVED" : "ACTIVE"} tone={patient.is_archived ? "attention" : "success"} />;
}
