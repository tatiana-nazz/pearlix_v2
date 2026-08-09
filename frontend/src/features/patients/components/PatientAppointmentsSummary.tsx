import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import type { Page } from "../../../types/api";
import type { AppointmentList } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateRange } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../../appointments/i18n";
import { appointmentDetailPath } from "../../appointments/utils/appointmentPermissions";

interface PatientAppointmentsSummaryProps {
  role: UserRole;
  appointments?: Page<AppointmentList>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  title?: string;
  description?: string;
}

export function PatientAppointmentsSummary({ role, appointments, isLoading, error, onRetry, title = "Appointments", description = "Read-only patient appointment summary." }: PatientAppointmentsSummaryProps) {
  const user = useAuthStore((state) => state.user);
  const language = user?.language_preference ?? "EN";
  const c = appointmentCopy(language);
  if (isLoading) return <LoadingState title="Loading appointments..." />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Unable to load appointments" />;
  const rows = appointments?.results ?? [];

  return (
    <Card>
      <SectionHeader title={title} description={description} />
      {rows.length ? (
        <ul className="summary-list-flat">
          {rows.map((appointment) => (
            <li className="summary-row" key={appointment.id}>
              <div>
                <strong>{formatDateRange(appointment.start_datetime, appointment.end_datetime)}</strong>
                <span>{appointment.doctor.full_name}</span>
                <span>{displayText(appointment.reason, "No reason recorded")}</span>
              </div>
              <div className="row-actions">
                <StatusPill status={appointment.status} />
                {role !== "DOCTOR" || appointment.doctor.id === user?.id ? (
                  <Link className="button secondary compact-button" to={appointmentDetailPath(role, appointment.id)}>
                    {c.openAppointment}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No appointments found for this patient." />
      )}
    </Card>
  );
}
