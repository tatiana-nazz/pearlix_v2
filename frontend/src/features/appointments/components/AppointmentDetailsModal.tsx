import { Button, Modal, StatePanel, StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { AppointmentDetail } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useAppointment } from "../hooks/useAppointments";
import { getAppointmentPermissions } from "../utils/appointmentPermissions";

type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";

interface AppointmentDetailsModalProps {
  appointmentId: number | null;
  role: UserRole;
  onClose: () => void;
  onEdit: (appointment: AppointmentDetail, mode: "edit" | "reschedule") => void;
  onStatusAction: (appointment: AppointmentDetail, action: StatusAction) => void;
}

function DetailFields({ appointment }: { appointment: AppointmentDetail }) {
  const t = useFeatureT();
  return <dl className="detail-grid appointment-details">
    <div><dt>{t("patient")}</dt><dd className="bidi-isolate">{appointment.patient.full_name}</dd></div>
    <div><dt>{t("doctor")}</dt><dd className="bidi-isolate">{appointment.doctor.full_name}</dd></div>
    <div><dt>{t("status")}</dt><dd><StatusBadge status={appointment.status} /></dd></div>
    <div><dt>{t("date")}</dt><dd className="bidi-isolate">{formatDateTime(appointment.start_datetime)}</dd></div>
    <div><dt>{t("duration")}</dt><dd className="bidi-isolate">{appointment.duration_minutes} {t("minutes")}</dd></div>
    <div><dt>{t("reason")}</dt><dd className="bidi-isolate">{displayText(appointment.reason, t("notRecorded"))}</dd></div>
    <div><dt>{t("notes")}</dt><dd className="bidi-isolate">{displayText(appointment.notes, t("notRecorded"))}</dd></div>
    <div><dt>{t("previousStatus")}</dt><dd>{appointment.reschedule_previous_status ? <StatusBadge status={appointment.reschedule_previous_status} /> : t("notRecorded")}</dd></div>
    <div><dt>{t("rescheduleSource")}</dt><dd className="bidi-isolate">{appointment.reschedule_source_label || t("notRecorded")}</dd></div>
    <div><dt>{t("created")}</dt><dd className="bidi-isolate">{formatDateTime(appointment.created_at)}</dd></div>
    <div><dt>{t("updated")}</dt><dd className="bidi-isolate">{formatDateTime(appointment.updated_at)}</dd></div>
  </dl>;
}

export function AppointmentDetailsModal({ appointmentId, role, onClose, onEdit, onStatusAction }: AppointmentDetailsModalProps) {
  const t = useFeatureT();
  const detail = useAppointment(appointmentId ?? 0);
  const appointment = detail.data;
  const permissions = getAppointmentPermissions(role, appointment);
  const isNotFound = detail.isError && typeof detail.error === "object" && detail.error !== null && "status" in detail.error && Number(detail.error.status) === 404;

  return <Modal open={appointmentId !== null} title={t("appointmentDetails")} onClose={onClose} wide>
    {detail.isLoading ? <StatePanel state="loading" title={t("loadingAppointmentDetails")} /> : null}
    {isNotFound ? <StatePanel state="notFound" title={t("appointmentNotFound")} /> : null}
    {detail.isError && !isNotFound ? <StatePanel state="error" title={t("unableToLoadAppointmentDetails")} action={<Button variant="secondary" onClick={() => void detail.refetch()}>{t("retry")}</Button>} /> : null}
    {appointment ? <><DetailFields appointment={appointment} /><div className="modal-action-area">
      {permissions.canEdit ? <Button variant="secondary" onClick={() => onEdit(appointment, "edit")}>{t("editAppointment")}</Button> : null}
      {permissions.canReschedule ? <Button variant="secondary" onClick={() => onEdit(appointment, "reschedule")}>{t("reschedule")}</Button> : null}
      {permissions.canCheckIn ? <Button variant="secondary" onClick={() => onStatusAction(appointment, "check-in")}>{t("checkIn")}</Button> : null}
      {permissions.canCancel ? <Button variant="danger" onClick={() => onStatusAction(appointment, "cancel")}>{t("cancelAppointment")}</Button> : null}
      {permissions.canNoShow ? <Button variant="danger" onClick={() => onStatusAction(appointment, "no-show")}>{t("markNoShow")}</Button> : null}
      {permissions.canStartVisit ? <Button onClick={() => onStatusAction(appointment, "start-visit")}>{t("startVisit")}</Button> : null}
    </div></> : null}
  </Modal>;
}
