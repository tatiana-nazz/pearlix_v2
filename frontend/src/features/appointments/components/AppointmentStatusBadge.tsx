import { StatusBadge } from "../../../components/v2";
import type { AppointmentStatus } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentStatusLabel } from "../i18n";
import { appointmentStatusClass } from "../utils/appointmentStatusPresentation";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  return <StatusBadge className={appointmentStatusClass("appointment-status-badge", status)} status={status} label={appointmentStatusLabel(language, status)} />;
}
