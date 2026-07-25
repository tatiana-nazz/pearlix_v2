import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { Button, Modal } from "../../../components/v2";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { displayText } from "../../../utils/formatters";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { formatAppointmentDateTime } from "../utils/appointmentDates";
import { getAppointmentPermissions } from "../utils/appointmentPermissions";

interface AppointmentDetailsDialogProps {
  appointment: AppointmentListItem | null;
  role: UserRole;
  timezone?: string;
  onClose: () => void;
  onEdit: (appointment: AppointmentListItem) => void;
  onReschedule: (appointment: AppointmentListItem) => void;
  onStatusAction: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show") => void;
}

export function AppointmentDetailsDialog({ appointment, role, timezone, onClose, onEdit, onReschedule, onStatusAction }: AppointmentDetailsDialogProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  if (!appointment) return null;
  const permissions = getAppointmentPermissions(role, appointment);
  return (
      <Modal open title={c.details} onClose={onClose}>
        <div>
          <p className="eyebrow">{c.details}</p>
          <h3>{appointment.patient.full_name}</h3>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>{c.time}</dt>
            <dd>{formatAppointmentDateTime(appointment.start_datetime, language)} – {formatAppointmentDateTime(appointment.end_datetime, language)}</dd>
          </div>
          <div>
            <dt>{c.status}</dt>
            <dd>
              <AppointmentStatusBadge status={appointment.status} />
            </dd>
          </div>
          <div>
            <dt>{c.doctor}</dt>
            <dd>{appointment.doctor.full_name}</dd>
          </div>
          <div>
            <dt>{c.reason}</dt>
            <dd>{displayText(appointment.reason)}</dd>
          </div>
          <div><dt>{c.created}</dt><dd>{formatAppointmentDateTime(appointment.created_at, language, timezone)}</dd></div>
          <div><dt>{c.updated}</dt><dd>{formatAppointmentDateTime(appointment.updated_at, language, timezone)}</dd></div>
        </dl>
        {(permissions.canEdit || permissions.canReschedule || permissions.canCheckIn || permissions.canNoShow || permissions.canCancel) ? (
          <div className="form-actions">
            {permissions.canEdit ? <Button type="button" variant="secondary" onClick={() => onEdit(appointment)}>{c.edit}</Button> : null}
            {permissions.canReschedule ? <Button type="button" variant="secondary" onClick={() => onReschedule(appointment)}>{c.reschedule}</Button> : null}
            {permissions.canCheckIn ? <Button type="button" variant="secondary" onClick={() => onStatusAction(appointment, "check-in")}>{c.checkIn}</Button> : null}
            {permissions.canNoShow ? <Button type="button" variant="secondary" onClick={() => onStatusAction(appointment, "no-show")}>{c.noShow}</Button> : null}
            {permissions.canCancel ? <Button type="button" variant="danger" onClick={() => onStatusAction(appointment, "cancel")}>{c.cancel}</Button> : null}
          </div>
        ) : null}
      </Modal>
  );
}
