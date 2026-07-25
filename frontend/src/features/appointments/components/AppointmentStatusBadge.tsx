import { StatusBadge } from "../../../components/v2";
import type { AppointmentStatus } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentStatusLabel } from "../i18n";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  return <StatusBadge status={status} label={appointmentStatusLabel(language, status)} />;
}
