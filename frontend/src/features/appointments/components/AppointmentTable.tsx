import { EmptyState } from "../../../components/EmptyState";
import { ClickableRow } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { appointmentRecordClass } from "../utils/appointmentStatusAppearance";

interface AppointmentTableProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onDetails: (appointment: AppointmentListItem) => void;
}

export function AppointmentTable({ appointments, onDetails }: AppointmentTableProps) {
  const t = useFeatureT();
  if (!appointments.length) return <EmptyState title={t("noAppointments")} />;
  return <div className="table-scroll"><table className="appointment-table"><thead><tr><th>{t("time")}</th><th>{t("patient")}</th><th>{t("doctor")}</th><th>{t("reason")}</th><th>{t("status")}</th></tr></thead><tbody>{appointments.map((appointment) => <ClickableRow key={appointment.id} showDisclosure={false} ariaLabel={`${appointment.patient.full_name}: ${formatDateTime(appointment.start_datetime)}`} onOpen={() => onDetails(appointment)}><td className={`${appointmentRecordClass(appointment.status)} bidi-isolate`}><strong>{formatDateTime(appointment.start_datetime)}</strong><span>{appointment.duration_minutes} {t("minutes")}</span></td><td className={appointmentRecordClass(appointment.status)}><bdi>{appointment.patient.full_name}</bdi></td><td className={appointmentRecordClass(appointment.status)}><bdi>{appointment.doctor.full_name}</bdi></td><td className={appointmentRecordClass(appointment.status)}><bdi>{displayText(appointment.reason)}</bdi></td><td className={appointmentRecordClass(appointment.status)}><AppointmentStatusBadge status={appointment.status} /></td></ClickableRow>)}</tbody></table></div>;
}
