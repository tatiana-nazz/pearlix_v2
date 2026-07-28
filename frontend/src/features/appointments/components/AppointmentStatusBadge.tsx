import { StatusBadge } from "../../../components/v2";
import type { AppointmentStatus } from "../../../types/appointments";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <StatusBadge status={status} />;
}
