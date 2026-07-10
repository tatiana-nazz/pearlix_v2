import { StatusPill } from "../../../components/StatusPill";
import type { AppointmentStatus } from "../../../types/appointments";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <StatusPill status={status} />;
}
