import { EmptyState } from "../../../components/EmptyState";
import { ClickableRow } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { getAppointmentPermissions } from "../utils/appointmentPermissions";

interface AppointmentTableProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit?: (appointment: AppointmentListItem) => void;
  onReschedule?: (appointment: AppointmentListItem) => void;
  onDetails?: (appointment: AppointmentListItem) => void;
  onStatusAction?: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show" | "start-visit") => void;
}

export function AppointmentTable({ role, appointments, onEdit, onReschedule, onDetails, onStatusAction }: AppointmentTableProps) {
  const t = useFeatureT();
  if (!appointments.length) return <EmptyState title={t("noAppointments")} />;
  return <div className="table-scroll"><table className="appointment-table"><thead><tr><th>{t("time")}</th><th>{t("patient")}</th><th>{t("doctor")}</th><th>{t("reason")}</th><th>{t("status")}</th><th>{t("actions")}</th><th aria-label={t("viewAppointment")} /></tr></thead><tbody>{appointments.map((appointment) => {
    const permissions = getAppointmentPermissions(role, appointment);
    return <ClickableRow key={appointment.id} onOpen={() => onDetails?.(appointment)}><td className="bidi-isolate"><strong>{formatDateTime(appointment.start_datetime)}</strong><span>{appointment.duration_minutes} {t("minutes")}</span></td><td className="bidi-isolate">{appointment.patient.full_name}</td><td className="bidi-isolate">{appointment.doctor.full_name}</td><td>{displayText(appointment.reason)}</td><td><AppointmentStatusBadge status={appointment.status} /></td><td data-row-action><div className="row-actions">{permissions.canEdit ? <button className="button secondary compact-button" type="button" onClick={() => onEdit?.(appointment)}>{t("editAppointment")}</button> : null}{permissions.canReschedule ? <button data-row-action className="button secondary compact-button" type="button" onClick={() => onReschedule?.(appointment)}>{t("reschedule")}</button> : null}{permissions.canCheckIn ? <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "check-in")}>{t("checkIn")}</button> : null}{permissions.canCancel ? <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "cancel")}>{t("cancelAppointment")}</button> : null}{permissions.canNoShow ? <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "no-show")}>{t("markNoShow")}</button> : null}{permissions.canStartVisit ? <button className="button primary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "start-visit")}>{t("startVisit")}</button> : null}</div></td></ClickableRow>;
  })}</tbody></table></div>;
}
