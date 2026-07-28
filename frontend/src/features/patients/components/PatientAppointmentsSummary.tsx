import { useNavigate } from "react-router-dom";

import { Card } from "../../../components/Card";
import { ClickableSummaryRow } from "../../../components/v2";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import { useFeatureT } from "../../../layouts/i18n";
import type { Page } from "../../../types/api";
import type { AppointmentList } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateRange } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

interface PatientAppointmentsSummaryProps {
  role: UserRole;
  appointments?: Page<AppointmentList>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function PatientAppointmentsSummary({ role, appointments, isLoading, error, onRetry }: PatientAppointmentsSummaryProps) {
  const t = useFeatureT(); const navigate = useNavigate();
  if (isLoading) return <LoadingState title={t("loadingAppointments")} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={t("unableToLoadAppointments")} />;
  const rows = appointments?.results ?? [];
  return <Card><SectionHeader title={t("appointments")} description={t("appointmentSummaryDescription")} />
    {rows.length ? <ul className="summary-list-flat">{rows.map((appointment) => <ClickableSummaryRow key={appointment.id} ariaLabel={`${appointment.patient.full_name}: ${formatDateRange(appointment.start_datetime, appointment.end_datetime)}`} onOpen={() => navigate(`/${role.toLowerCase()}/appointments/list?date=${encodeURIComponent(appointment.start_datetime.slice(0, 10))}&appointment=${appointment.id}`)}><div><strong className="bidi-isolate">{formatDateRange(appointment.start_datetime, appointment.end_datetime)}</strong><span className="bidi-isolate">{appointment.doctor.full_name}</span><span>{displayText(appointment.reason, t("notRecorded"))}</span></div><div><StatusPill status={appointment.status} /></div></ClickableSummaryRow>)}</ul> : <EmptyState title={t("noPatientAppointments")} />}
  </Card>;
}
